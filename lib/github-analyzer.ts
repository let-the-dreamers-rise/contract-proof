// GitHub repository analyzer - fetch and analyze repositories

import { Octokit } from "octokit";
import simpleGit, { SimpleGit } from "simple-git";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch?: string;
}

export interface FileInfo {
  path: string;
  content: string;
  type: "backend" | "frontend" | "documentation" | "test" | "unknown";
}

export class GitHubAnalyzer {
  private octokit: Octokit | null = null;
  private git: SimpleGit;
  private tempDir: string;

  constructor(githubToken?: string) {
    if (githubToken) {
      this.octokit = new Octokit({ auth: githubToken });
    }
    this.git = simpleGit();
    this.tempDir = path.join(os.tmpdir(), "contract-proof-analysis");
  }

  /**
   * Parse GitHub URL to extract owner and repo
   */
  parseGitHubUrl(url: string): GitHubRepoInfo | null {
    try {
      // Validate URL format
      if (!url || typeof url !== "string") {
        return null;
      }

      // Remove whitespace
      url = url.trim();

      // Support various GitHub URL formats
      const patterns = [
        /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
        /github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)/,
        /github\.com\/([^\/]+)\/([^\/]+)/,
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          const owner = match[1];
          const repo = match[2].replace(/\.git$/, "");
          const branch = match[3] || "main";

          // Validate owner and repo names
          if (!this.isValidGitHubName(owner) || !this.isValidGitHubName(repo)) {
            return null;
          }

          return { owner, repo, branch };
        }
      }

      return null;
    } catch (error) {
      console.error("Error parsing GitHub URL:", error);
      return null;
    }
  }

  /**
   * Validate GitHub username/repo name
   */
  private isValidGitHubName(name: string): boolean {
    // GitHub names can contain alphanumeric characters and hyphens
    // Cannot start with a hyphen
    // Max length is 39 characters for usernames, 100 for repos
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,98}[a-zA-Z0-9])?$/.test(name);
  }

  /**
   * Clone or fetch repository
   */
  async cloneRepository(repoInfo: GitHubRepoInfo): Promise<string> {
    const repoPath = path.join(
      this.tempDir,
      `${repoInfo.owner}-${repoInfo.repo}-${Date.now()}`
    );

    try {
      // Validate disk space (basic check)
      await this.checkDiskSpace();

      // Clean up existing directory
      if (fs.existsSync(repoPath)) {
        fs.rmSync(repoPath, { recursive: true, force: true });
      }

      // Create temp directory
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }

      // Clone repository with timeout
      const cloneUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}.git`;
      console.log(`Cloning repository: ${cloneUrl}`);

      const clonePromise = this.git.clone(cloneUrl, repoPath, [
        "--depth",
        "1",
        "--branch",
        repoInfo.branch || "main",
        "--single-branch",
      ]);

      // Add timeout (60 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Clone timeout after 60 seconds")), 60000)
      );

      await Promise.race([clonePromise, timeoutPromise]);

      // Verify clone was successful
      if (!fs.existsSync(path.join(repoPath, ".git"))) {
        throw new Error("Repository clone verification failed");
      }

      return repoPath;
    } catch (error: any) {
      // Clean up on failure
      if (fs.existsSync(repoPath)) {
        try {
          fs.rmSync(repoPath, { recursive: true, force: true });
        } catch (cleanupError) {
          console.warn("Failed to cleanup after clone error:", cleanupError);
        }
      }

      // Try with 'master' branch if 'main' fails
      if (repoInfo.branch === "main" && !error.message.includes("timeout")) {
        try {
          const cloneUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}.git`;
          const masterPath = path.join(
            this.tempDir,
            `${repoInfo.owner}-${repoInfo.repo}-${Date.now()}`
          );

          await this.git.clone(cloneUrl, masterPath, [
            "--depth",
            "1",
            "--branch",
            "master",
            "--single-branch",
          ]);

          return masterPath;
        } catch (masterError: any) {
          throw new Error(
            `Failed to clone repository: ${error.message}. Also tried 'master' branch: ${masterError.message}`
          );
        }
      }

      // Provide helpful error messages
      if (error.message.includes("timeout")) {
        throw new Error(
          "Repository clone timed out. The repository may be too large or network is slow."
        );
      } else if (error.message.includes("not found") || error.message.includes("404")) {
        throw new Error(
          "Repository not found. Please check the URL and ensure the repository is public."
        );
      } else if (error.message.includes("authentication")) {
        throw new Error(
          "Authentication required. Please provide a GitHub token for private repositories."
        );
      }

      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  /**
   * Check available disk space
   */
  private async checkDiskSpace(): Promise<void> {
    try {
      // Basic check - ensure temp directory is writable
      const testFile = path.join(this.tempDir, `.test-${Date.now()}`);
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
    } catch (error) {
      throw new Error(
        "Insufficient disk space or temp directory not writable"
      );
    }
  }

  /**
   * Get all relevant files from repository
   */
  async getRepositoryFiles(repoPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const maxFileSize = 1024 * 1024; // 1MB max per file
    const maxTotalFiles = 10000; // Safety limit

    const walkDir = (dir: string) => {
      // Safety check
      if (files.length >= maxTotalFiles) {
        console.warn(`Reached maximum file limit of ${maxTotalFiles}`);
        return;
      }

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (files.length >= maxTotalFiles) break;

          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(repoPath, fullPath);

          // Skip common directories to ignore
          if (this.shouldSkipPath(relativePath)) {
            continue;
          }

          if (entry.isDirectory()) {
            try {
              walkDir(fullPath);
            } catch (error) {
              console.warn(`Failed to read directory ${relativePath}:`, error);
            }
          } else if (entry.isFile()) {
            const fileType = this.detectFileType(relativePath);
            if (fileType !== "unknown") {
              try {
                // Check file size before reading
                const stats = fs.statSync(fullPath);
                if (stats.size > maxFileSize) {
                  console.warn(
                    `Skipping large file ${relativePath} (${stats.size} bytes)`
                  );
                  continue;
                }

                const content = fs.readFileSync(fullPath, "utf-8");
                files.push({
                  path: relativePath,
                  content,
                  type: fileType,
                });
              } catch (error: any) {
                // Skip binary files or files with encoding issues
                if (
                  error.code !== "ENOENT" &&
                  !error.message.includes("EISDIR")
                ) {
                  console.warn(`Failed to read file ${relativePath}:`, error);
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to read directory ${dir}:`, error);
      }
    };

    if (!fs.existsSync(repoPath)) {
      throw new Error(`Repository path does not exist: ${repoPath}`);
    }

    walkDir(repoPath);

    if (files.length === 0) {
      console.warn("No analyzable files found in repository");
    }

    return files;
  }

  /**
   * Check if path should be skipped
   */
  private shouldSkipPath(relativePath: string): boolean {
    const skipPatterns = [
      /^\.git/,
      /^node_modules/,
      /^dist/,
      /^build/,
      /^\.next/,
      /^out/,
      /^coverage/,
      /^\.vscode/,
      /^\.idea/,
      /^__pycache__/,
      /^venv/,
      /^env/,
      /\.pyc$/,
      /\.map$/,
      /\.min\.js$/,
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/,
    ];

    return skipPatterns.some((pattern) => pattern.test(relativePath));
  }

  /**
   * Detect file type based on path and extension
   */
  private detectFileType(
    filePath: string
  ): "backend" | "frontend" | "documentation" | "test" | "unknown" {
    const lowerPath = filePath.toLowerCase();

    // Test files
    if (
      lowerPath.includes("test") ||
      lowerPath.includes("spec") ||
      lowerPath.includes("__tests__")
    ) {
      return "test";
    }

    // Documentation
    if (
      lowerPath.endsWith(".md") ||
      lowerPath.includes("docs/") ||
      lowerPath.includes("documentation/")
    ) {
      return "documentation";
    }

    // Backend files
    if (
      lowerPath.includes("backend") ||
      lowerPath.includes("server") ||
      lowerPath.includes("api") ||
      lowerPath.includes("routes") ||
      lowerPath.includes("controllers") ||
      lowerPath.includes("endpoints") ||
      (lowerPath.endsWith(".py") && !lowerPath.includes("frontend"))
    ) {
      return "backend";
    }

    // Frontend files
    if (
      lowerPath.includes("frontend") ||
      lowerPath.includes("client") ||
      lowerPath.includes("components") ||
      lowerPath.includes("pages") ||
      lowerPath.includes("views") ||
      lowerPath.includes("src") ||
      lowerPath.endsWith(".jsx") ||
      lowerPath.endsWith(".tsx") ||
      lowerPath.endsWith(".vue")
    ) {
      return "frontend";
    }

    // Check file extensions for general classification
    const ext = path.extname(lowerPath);
    if ([".js", ".ts", ".mjs", ".cjs"].includes(ext)) {
      // Default to backend for JS/TS files if not clearly frontend
      return "backend";
    }

    return "unknown";
  }

  /**
   * Validate repository exists and is accessible
   */
  async validateRepository(repoInfo: GitHubRepoInfo): Promise<boolean> {
    try {
      if (this.octokit) {
        // Use GitHub API to check if repo exists
        await this.octokit.rest.repos.get({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
        });
        return true;
      } else {
        // Try to clone without API (for public repos)
        const cloneUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}.git`;
        const result = await this.git.listRemote([cloneUrl]);
        return result.length > 0;
      }
    } catch (error) {
      console.error("Repository validation failed:", error);
      return false;
    }
  }

  /**
   * Clean up temporary files
   */
  cleanup(repoPath?: string): void {
    try {
      if (repoPath && fs.existsSync(repoPath)) {
        fs.rmSync(repoPath, { recursive: true, force: true });
      } else if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn("Failed to cleanup temporary files:", error);
    }
  }

  /**
   * Get repository metadata
   */
  async getRepositoryMetadata(
    repoInfo: GitHubRepoInfo
  ): Promise<{
    name: string;
    description: string;
    stars: number;
    language: string;
    updatedAt: string;
  } | null> {
    try {
      if (!this.octokit) {
        return null;
      }

      const { data } = await this.octokit.rest.repos.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
      });

      return {
        name: data.name,
        description: data.description || "",
        stars: data.stargazers_count,
        language: data.language || "Unknown",
        updatedAt: data.updated_at,
      };
    } catch (error) {
      console.error("Failed to get repository metadata:", error);
      return null;
    }
  }
}

// Made with Bob
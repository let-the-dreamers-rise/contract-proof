// GitHub App integration for ContractProof
// Handles authentication, PR comments, status checks, and webhooks

import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { Webhooks } from "@octokit/webhooks";

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  webhookSecret?: string;
  installationId?: string;
}

export interface PRCommentOptions {
  owner: string;
  repo: string;
  prNumber: number;
  body: string;
  updateExisting?: boolean;
}

export interface StatusCheckOptions {
  owner: string;
  repo: string;
  sha: string;
  state: "error" | "failure" | "pending" | "success";
  context: string;
  description: string;
  targetUrl?: string;
}

export interface FileAnnotation {
  path: string;
  startLine: number;
  endLine: number;
  annotationLevel: "notice" | "warning" | "failure";
  message: string;
  title: string;
  rawDetails?: string;
}

export interface CheckRunOptions {
  owner: string;
  repo: string;
  name: string;
  headSha: string;
  status: "queued" | "in_progress" | "completed";
  conclusion?: "success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out" | "action_required";
  output?: {
    title: string;
    summary: string;
    text?: string;
    annotations?: FileAnnotation[];
  };
}

export class GitHubApp {
  private octokit: Octokit | null = null;
  private webhooks: Webhooks | null = null;
  private config: GitHubAppConfig;

  constructor(config: GitHubAppConfig) {
    this.config = config;
    this.initializeOctokit();
    
    if (config.webhookSecret) {
      this.initializeWebhooks();
    }
  }

  /**
   * Initialize Octokit with GitHub App authentication
   */
  private initializeOctokit(): void {
    try {
      const auth = createAppAuth({
        appId: this.config.appId,
        privateKey: this.config.privateKey,
        installationId: this.config.installationId,
      });

      this.octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: this.config.appId,
          privateKey: this.config.privateKey,
          installationId: this.config.installationId,
        },
      });
    } catch (error) {
      console.error("Failed to initialize GitHub App:", error);
      throw error;
    }
  }

  /**
   * Initialize webhook handler
   */
  private initializeWebhooks(): void {
    if (!this.config.webhookSecret) return;

    this.webhooks = new Webhooks({
      secret: this.config.webhookSecret,
    });

    // Register webhook event handlers
    this.registerWebhookHandlers();
  }

  /**
   * Register webhook event handlers
   */
  private registerWebhookHandlers(): void {
    if (!this.webhooks) return;

    // Handle pull request events
    this.webhooks.on("pull_request.opened", async ({ payload }) => {
      console.log(`PR opened: ${payload.pull_request.html_url}`);
      // Trigger analysis
    });

    this.webhooks.on("pull_request.synchronize", async ({ payload }) => {
      console.log(`PR updated: ${payload.pull_request.html_url}`);
      // Re-run analysis
    });

    // Handle push events
    this.webhooks.on("push", async ({ payload }) => {
      console.log(`Push to ${payload.ref}`);
      // Trigger analysis for main branch
    });
  }

  /**
   * Post or update a comment on a pull request
   */
  async postPRComment(options: PRCommentOptions): Promise<void> {
    if (!this.octokit) {
      throw new Error("GitHub App not initialized");
    }

    try {
      const { owner, repo, prNumber, body, updateExisting = true } = options;

      if (updateExisting) {
        // Find existing ContractProof comment
        const { data: comments } = await this.octokit.rest.issues.listComments({
          owner,
          repo,
          issue_number: prNumber,
        });

        const existingComment = comments.find(
          (comment) =>
            comment.user?.type === "Bot" &&
            comment.body?.includes("ContractProof API Drift Analysis")
        );

        if (existingComment) {
          // Update existing comment
          await this.octokit.rest.issues.updateComment({
            owner,
            repo,
            comment_id: existingComment.id,
            body,
          });
          console.log(`Updated PR comment #${prNumber}`);
          return;
        }
      }

      // Create new comment
      await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
      console.log(`Created PR comment #${prNumber}`);
    } catch (error) {
      console.error("Failed to post PR comment:", error);
      throw error;
    }
  }

  /**
   * Create or update a status check
   */
  async createStatusCheck(options: StatusCheckOptions): Promise<void> {
    if (!this.octokit) {
      throw new Error("GitHub App not initialized");
    }

    try {
      const { owner, repo, sha, state, context, description, targetUrl } = options;

      await this.octokit.rest.repos.createCommitStatus({
        owner,
        repo,
        sha,
        state,
        context,
        description,
        target_url: targetUrl,
      });

      console.log(`Created status check: ${context} - ${state}`);
    } catch (error) {
      console.error("Failed to create status check:", error);
      throw error;
    }
  }

  /**
   * Create a check run with file annotations
   */
  async createCheckRun(options: CheckRunOptions): Promise<number> {
    if (!this.octokit) {
      throw new Error("GitHub App not initialized");
    }

    try {
      const { owner, repo, name, headSha, status, conclusion, output } = options;

      const response = await this.octokit.rest.checks.create({
        owner,
        repo,
        name,
        head_sha: headSha,
        status,
        conclusion,
        output: output
          ? {
              title: output.title,
              summary: output.summary,
              text: output.text,
              annotations: output.annotations?.map((ann) => ({
                path: ann.path,
                start_line: ann.startLine,
                end_line: ann.endLine,
                annotation_level: ann.annotationLevel,
                message: ann.message,
                title: ann.title,
                raw_details: ann.rawDetails,
              })),
            }
          : undefined,
      });

      console.log(`Created check run: ${name} (ID: ${response.data.id})`);
      return response.data.id;
    } catch (error) {
      console.error("Failed to create check run:", error);
      throw error;
    }
  }

  /**
   * Update an existing check run
   */
  async updateCheckRun(
    checkRunId: number,
    options: Omit<CheckRunOptions, "headSha">
  ): Promise<void> {
    if (!this.octokit) {
      throw new Error("GitHub App not initialized");
    }

    try {
      const { owner, repo, name, status, conclusion, output } = options;

      await this.octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: checkRunId,
        name,
        status,
        conclusion,
        output: output
          ? {
              title: output.title,
              summary: output.summary,
              text: output.text,
              annotations: output.annotations?.map((ann) => ({
                path: ann.path,
                start_line: ann.startLine,
                end_line: ann.endLine,
                annotation_level: ann.annotationLevel,
                message: ann.message,
                title: ann.title,
                raw_details: ann.rawDetails,
              })),
            }
          : undefined,
      });

      console.log(`Updated check run: ${name} (ID: ${checkRunId})`);
    } catch (error) {
      console.error("Failed to update check run:", error);
      throw error;
    }
  }

  /**
   * Add labels to a pull request
   */
  async addLabels(
    owner: string,
    repo: string,
    prNumber: number,
    labels: string[]
  ): Promise<void> {
    if (!this.octokit) {
      throw new Error("GitHub App not initialized");
    }

    try {
      await this.octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: prNumber,
        labels,
      });

      console.log(`Added labels to PR #${prNumber}: ${labels.join(", ")}`);
    } catch (error) {
      console.error("Failed to add labels:", error);
      throw error;
    }
  }

  /**
   * Remove labels from a pull request
   */
  async removeLabels(
    owner: string,
    repo: string,
    prNumber: number,
    labels: string[]
  ): Promise<void> {
    if (!this.octokit) {
      throw new Error("GitHub App not initialized");
    }

    try {
      for (const label of labels) {
        try {
          await this.octokit.rest.issues.removeLabel({
            owner,
            repo,
            issue_number: prNumber,
            name: label,
          });
        } catch (error) {
          // Ignore if label doesn't exist
          console.warn(`Label not found: ${label}`);
        }
      }

      console.log(`Removed labels from PR #${prNumber}: ${labels.join(", ")}`);
    } catch (error) {
      console.error("Failed to remove labels:", error);
      throw error;
    }
  }

  /**
   * Get pull request files
   */
  async getPRFiles(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<Array<{ filename: string; status: string; patch?: string }>> {
    if (!this.octokit) {
      throw new Error("GitHub App not initialized");
    }

    try {
      const { data: files } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
      });

      return files.map((file) => ({
        filename: file.filename,
        status: file.status,
        patch: file.patch,
      }));
    } catch (error) {
      console.error("Failed to get PR files:", error);
      throw error;
    }
  }

  /**
   * Get repository content
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string> {
    if (!this.octokit) {
      throw new Error("GitHub App not initialized");
    }

    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if ("content" in data && data.content) {
        return Buffer.from(data.content, "base64").toString("utf-8");
      }

      throw new Error("File content not found");
    } catch (error) {
      console.error("Failed to get file content:", error);
      throw error;
    }
  }

  /**
   * Handle webhook payload
   */
  async handleWebhook(
    eventName: string,
    signature: string,
    payload: string
  ): Promise<void> {
    if (!this.webhooks) {
      throw new Error("Webhooks not initialized");
    }

    try {
      await this.webhooks.verifyAndReceive({
        id: Date.now().toString(),
        name: eventName as any,
        signature,
        payload,
      });
    } catch (error) {
      console.error("Failed to handle webhook:", error);
      throw error;
    }
  }

  /**
   * Get installation access token
   */
  async getInstallationToken(): Promise<string> {
    if (!this.octokit) {
      throw new Error("GitHub App not initialized");
    }

    try {
      const { token } = await this.octokit.auth({
        type: "installation",
      }) as { token: string };

      return token;
    } catch (error) {
      console.error("Failed to get installation token:", error);
      throw error;
    }
  }
}

/**
 * Create a GitHub App instance from environment variables
 */
export function createGitHubAppFromEnv(): GitHubApp {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const installationId = process.env.GITHUB_INSTALLATION_ID;

  if (!appId || !privateKey) {
    throw new Error(
      "Missing required environment variables: GITHUB_APP_ID, GITHUB_PRIVATE_KEY"
    );
  }

  return new GitHubApp({
    appId,
    privateKey,
    webhookSecret,
    installationId,
  });
}

// Made with Bob

// API route for analyzing repositories

import { NextRequest, NextResponse } from "next/server";
import { GitHubAnalyzer } from "@/lib/github-analyzer";
import { RealBackendAnalyzer } from "@/lib/analyzers/real-backend-analyzer";
import { RealFrontendAnalyzer } from "@/lib/analyzers/real-frontend-analyzer";
import { RealDriftDetector } from "@/lib/analyzers/real-drift-detector";
import { AnalysisResult, ApiEndpoint } from "@/lib/types";
import { ProgressTracker, createProgressStream } from "@/lib/analysis-progress";

export const maxDuration = 60; // 60 seconds timeout for analysis
export const runtime = "nodejs"; // Ensure Node.js runtime for streaming

interface AnalyzeRequest {
  githubUrl: string;
  githubToken?: string;
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const stream = url.searchParams.get("stream") === "true";

  try {
    const body: AnalyzeRequest = await request.json();
    const { githubUrl, githubToken } = body;

    if (!githubUrl) {
      return NextResponse.json(
        { error: "GitHub URL is required" },
        { status: 400 }
      );
    }

    // If streaming is requested, use Server-Sent Events
    if (stream) {
      return handleStreamingAnalysis(githubUrl, githubToken);
    }

    // Otherwise, return regular JSON response
    return handleRegularAnalysis(githubUrl, githubToken);
  } catch (error: any) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: `Analysis failed: ${error.message}` },
      { status: 500 }
    );
  }
}

async function handleStreamingAnalysis(
  githubUrl: string,
  githubToken?: string
) {
  const { stream, sendProgress, close } = createProgressStream();
  const progress = new ProgressTracker(sendProgress);

  // Start analysis in background
  (async () => {
    try {
      progress.setStage("validating", "Validating repository...");

      const githubAnalyzer = new GitHubAnalyzer(githubToken);
      const repoInfo = githubAnalyzer.parseGitHubUrl(githubUrl);

      if (!repoInfo) {
        progress.setError("Invalid GitHub URL format");
        close();
        return;
      }

      const isValid = await githubAnalyzer.validateRepository(repoInfo);
      if (!isValid) {
        progress.setError(
          "Repository not found or not accessible. Make sure the repository is public or provide a valid GitHub token."
        );
        close();
        return;
      }

      progress.setStage("cloning", "Cloning repository...");
      const repoPath = await githubAnalyzer.cloneRepository(repoInfo);

      progress.setStage("scanning", "Scanning files...");
      const files = await githubAnalyzer.getRepositoryFiles(repoPath);
      progress.setTotalFiles(files.length);

      const backendAnalyzer = new RealBackendAnalyzer();
      const frontendAnalyzer = new RealFrontendAnalyzer();
      const driftDetector = new RealDriftDetector();

      const backendEndpoints: ApiEndpoint[] = [];
      const frontendEndpoints: ApiEndpoint[] = [];
      const documentationEndpoints: ApiEndpoint[] = [];
      const testEndpoints: ApiEndpoint[] = [];

      // Analyze files with progress updates
      for (const file of files) {
        try {
          if (file.type === "backend") {
            progress.setStage(
              "analyzing_backend",
              "Analyzing backend code..."
            );
            const endpoints = backendAnalyzer.analyzeFile(
              file.content,
              file.path
            );
            backendEndpoints.push(...endpoints);
          } else if (file.type === "frontend") {
            progress.setStage(
              "analyzing_frontend",
              "Analyzing frontend code..."
            );
            const endpoints = frontendAnalyzer.analyzeFile(
              file.content,
              file.path
            );
            frontendEndpoints.push(...endpoints);
          } else if (file.type === "test") {
            progress.setStage("analyzing_tests", "Analyzing test files...");
            const backendTests = backendAnalyzer.analyzeFile(
              file.content,
              file.path
            );
            const frontendTests = frontendAnalyzer.analyzeFile(
              file.content,
              file.path
            );
            backendTests.forEach((e) => (e.type = "test"));
            frontendTests.forEach((e) => (e.type = "test"));
            testEndpoints.push(...backendTests, ...frontendTests);
          } else if (file.type === "documentation") {
            const docEndpoints = extractDocumentationEndpoints(
              file.content,
              file.path
            );
            documentationEndpoints.push(...docEndpoints);
          }

          progress.incrementFilesProcessed(file.path);
        } catch (error) {
          console.error(`Error analyzing file ${file.path}:`, error);
        }
      }

      progress.setStage("detecting_drift", "Detecting API drift...");
      let findings = driftDetector.detectDrift(
        backendEndpoints,
        frontendEndpoints,
        documentationEndpoints,
        testEndpoints
      );

      findings = driftDetector.markBobFixableFindings(findings);

      const summary = {
        total: findings.length,
        critical: findings.filter((f) => f.severity === "critical").length,
        high: findings.filter((f) => f.severity === "high").length,
        medium: findings.filter((f) => f.severity === "medium").length,
        low: findings.filter((f) => f.severity === "low").length,
      };

      const result: AnalysisResult = {
        findings,
        summary,
        scannedFiles: {
          backend: files.filter((f) => f.type === "backend").length,
          frontend: files.filter((f) => f.type === "frontend").length,
          documentation: files.filter((f) => f.type === "documentation")
            .length,
          tests: files.filter((f) => f.type === "test").length,
        },
        timestamp: new Date().toISOString(),
      };

      // Send final result
      sendProgress({
        stage: "complete",
        percentage: 100,
        message: "Analysis complete!",
        filesProcessed: files.length,
        totalFiles: files.length,
      });

      // Send result as final event
      const encoder = new TextEncoder();
      const resultData = `data: ${JSON.stringify({
        type: "result",
        data: result,
      })}\n\n`;
      sendProgress({
        stage: "complete",
        percentage: 100,
        message: JSON.stringify(result),
      });

      githubAnalyzer.cleanup(repoPath);
      close();
    } catch (error: any) {
      progress.setError(error.message);
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function handleRegularAnalysis(githubUrl: string, githubToken?: string) {
  const githubAnalyzer = new GitHubAnalyzer(githubToken);
  const backendAnalyzer = new RealBackendAnalyzer();
  const frontendAnalyzer = new RealFrontendAnalyzer();
  const driftDetector = new RealDriftDetector();

  const repoInfo = githubAnalyzer.parseGitHubUrl(githubUrl);
  if (!repoInfo) {
    return NextResponse.json(
      { error: "Invalid GitHub URL format" },
      { status: 400 }
    );
  }

  const isValid = await githubAnalyzer.validateRepository(repoInfo);
  if (!isValid) {
    return NextResponse.json(
      {
        error:
          "Repository not found or not accessible. Make sure the repository is public or provide a valid GitHub token.",
      },
      { status: 404 }
    );
  }

  let repoPath: string;
  try {
    repoPath = await githubAnalyzer.cloneRepository(repoInfo);
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to clone repository: ${error.message}` },
      { status: 500 }
    );
  }

  const files = await githubAnalyzer.getRepositoryFiles(repoPath);

  const backendEndpoints: ApiEndpoint[] = [];
  const frontendEndpoints: ApiEndpoint[] = [];
  const documentationEndpoints: ApiEndpoint[] = [];
  const testEndpoints: ApiEndpoint[] = [];

  for (const file of files) {
    try {
      if (file.type === "backend") {
        const endpoints = backendAnalyzer.analyzeFile(file.content, file.path);
        backendEndpoints.push(...endpoints);
      } else if (file.type === "frontend") {
        const endpoints = frontendAnalyzer.analyzeFile(file.content, file.path);
        frontendEndpoints.push(...endpoints);
      } else if (file.type === "test") {
        const backendTests = backendAnalyzer.analyzeFile(
          file.content,
          file.path
        );
        const frontendTests = frontendAnalyzer.analyzeFile(
          file.content,
          file.path
        );
        backendTests.forEach((e) => (e.type = "test"));
        frontendTests.forEach((e) => (e.type = "test"));
        testEndpoints.push(...backendTests, ...frontendTests);
      } else if (file.type === "documentation") {
        const docEndpoints = extractDocumentationEndpoints(
          file.content,
          file.path
        );
        documentationEndpoints.push(...docEndpoints);
      }
    } catch (error) {
      console.error(`Error analyzing file ${file.path}:`, error);
    }
  }

  let findings = driftDetector.detectDrift(
    backendEndpoints,
    frontendEndpoints,
    documentationEndpoints,
    testEndpoints
  );

  findings = driftDetector.markBobFixableFindings(findings);

  const summary = {
    total: findings.length,
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };

  const result: AnalysisResult = {
    findings,
    summary,
    scannedFiles: {
      backend: files.filter((f) => f.type === "backend").length,
      frontend: files.filter((f) => f.type === "frontend").length,
      documentation: files.filter((f) => f.type === "documentation").length,
      tests: files.filter((f) => f.type === "test").length,
    },
    timestamp: new Date().toISOString(),
  };

  githubAnalyzer.cleanup(repoPath);

  return NextResponse.json(result);
}

/**
 * Extract API endpoints from documentation files
 */
function extractDocumentationEndpoints(
  content: string,
  filePath: string
): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const lines = content.split("\n");

  // Common documentation patterns
  const patterns = [
    // GET /api/users/:id
    /^(GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s]+)/i,
    // `GET /api/users/:id`
    /`(GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s]+)`/i,
    // **GET** /api/users/:id
    /\*\*(GET|POST|PUT|DELETE|PATCH)\*\*\s+(\/[^\s]+)/i,
  ];

  lines.forEach((line, index) => {
    patterns.forEach((pattern) => {
      const match = line.match(pattern);
      if (match) {
        const method = match[1].toUpperCase() as any;
        const path = match[2];

        // Only include if it looks like an API path
        if (
          path.startsWith("/api/") ||
          path.startsWith("/v1/") ||
          path.startsWith("/v2/")
        ) {
          endpoints.push({
            path,
            method,
            location: {
              file: filePath,
              line: index + 1,
              code: line.trim(),
              context: getContext(lines, index),
            },
            type: "documentation",
          });
        }
      }
    });
  });

  return endpoints;
}

/**
 * Get surrounding lines for context
 */
function getContext(
  lines: string[],
  index: number,
  contextLines: number = 2
): string[] {
  const start = Math.max(0, index - contextLines);
  const end = Math.min(lines.length, index + contextLines + 1);
  return lines.slice(start, end);
}

// Made with Bob
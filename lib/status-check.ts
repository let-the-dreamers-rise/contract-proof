// Status Check Manager for ContractProof
// Manages GitHub status checks and check runs

import { GitHubApp } from "./github-app";
import { AnalysisResults } from "./pr-comment-template";

export interface StatusCheckConfig {
  context?: string;
  targetUrl?: string;
  includeAnnotations?: boolean;
  maxAnnotations?: number;
}

export class StatusCheckManager {
  private githubApp: GitHubApp;
  private config: StatusCheckConfig;

  constructor(githubApp: GitHubApp, config?: StatusCheckConfig) {
    this.githubApp = githubApp;
    this.config = {
      context: "ContractProof / API Drift Check",
      includeAnnotations: true,
      maxAnnotations: 50,
      ...config,
    };
  }

  /**
   * Create a commit status check
   */
  async createCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    results: AnalysisResults,
    threshold: string = "high"
  ): Promise<void> {
    const state = this.determineState(results, threshold);
    const description = this.generateDescription(results, threshold);

    await this.githubApp.createStatusCheck({
      owner,
      repo,
      sha,
      state,
      context: this.config.context!,
      description,
      targetUrl: this.config.targetUrl,
    });
  }

  /**
   * Create a check run with annotations
   */
  async createCheckRun(
    owner: string,
    repo: string,
    headSha: string,
    results: AnalysisResults,
    threshold: string = "high"
  ): Promise<number> {
    const conclusion = this.determineConclusion(results, threshold);
    const annotations = this.config.includeAnnotations
      ? this.generateAnnotations(results)
      : undefined;

    const checkRunId = await this.githubApp.createCheckRun({
      owner,
      repo,
      name: "ContractProof API Drift Analysis",
      headSha,
      status: "completed",
      conclusion,
      output: {
        title: this.generateTitle(results),
        summary: this.generateSummary(results),
        text: this.generateDetailedText(results),
        annotations,
      },
    });

    return checkRunId;
  }

  /**
   * Update an existing check run
   */
  async updateCheckRun(
    checkRunId: number,
    owner: string,
    repo: string,
    results: AnalysisResults,
    threshold: string = "high"
  ): Promise<void> {
    const conclusion = this.determineConclusion(results, threshold);
    const annotations = this.config.includeAnnotations
      ? this.generateAnnotations(results)
      : undefined;

    await this.githubApp.updateCheckRun(checkRunId, {
      owner,
      repo,
      name: "ContractProof API Drift Analysis",
      status: "completed",
      conclusion,
      output: {
        title: this.generateTitle(results),
        summary: this.generateSummary(results),
        text: this.generateDetailedText(results),
        annotations,
      },
    });
  }

  /**
   * Create a pending check run
   */
  async createPendingCheckRun(
    owner: string,
    repo: string,
    headSha: string
  ): Promise<number> {
    const checkRunId = await this.githubApp.createCheckRun({
      owner,
      repo,
      name: "ContractProof API Drift Analysis",
      headSha,
      status: "in_progress",
      output: {
        title: "Analyzing API drift...",
        summary: "ContractProof is analyzing your code for API contract drift.",
      },
    });

    return checkRunId;
  }

  /**
   * Determine status check state based on results and threshold
   */
  private determineState(
    results: AnalysisResults,
    threshold: string
  ): "error" | "failure" | "pending" | "success" {
    const { critical, high, medium, low } = results.summary;

    switch (threshold) {
      case "critical":
        return critical > 0 ? "failure" : "success";
      case "high":
        return critical > 0 || high > 0 ? "failure" : "success";
      case "medium":
        return critical > 0 || high > 0 || medium > 0 ? "failure" : "success";
      case "low":
        return critical > 0 || high > 0 || medium > 0 || low > 0
          ? "failure"
          : "success";
      default:
        return critical > 0 || high > 0 ? "failure" : "success";
    }
  }

  /**
   * Determine check run conclusion based on results and threshold
   */
  private determineConclusion(
    results: AnalysisResults,
    threshold: string
  ): "success" | "failure" | "neutral" {
    const state = this.determineState(results, threshold);
    
    if (state === "failure") {
      return "failure";
    } else if (results.findings.length > 0) {
      return "neutral"; // Has findings but below threshold
    } else {
      return "success";
    }
  }

  /**
   * Generate status check description
   */
  private generateDescription(
    results: AnalysisResults,
    threshold: string
  ): string {
    const { critical, high, medium, low, total } = results.summary;

    if (total === 0) {
      return "✅ No API drift detected";
    }

    const parts: string[] = [];
    if (critical > 0) parts.push(`${critical} critical`);
    if (high > 0) parts.push(`${high} high`);
    if (medium > 0) parts.push(`${medium} medium`);
    if (low > 0) parts.push(`${low} low`);

    const description = `Found ${parts.join(", ")} severity ${total === 1 ? "issue" : "issues"}`;
    
    // Truncate if too long (GitHub has a 140 character limit)
    return description.length > 140 ? description.substring(0, 137) + "..." : description;
  }

  /**
   * Generate check run title
   */
  private generateTitle(results: AnalysisResults): string {
    const { total } = results.summary;

    if (total === 0) {
      return "✅ No API Drift Detected";
    }

    return `⚠️ Found ${total} API Drift ${total === 1 ? "Issue" : "Issues"}`;
  }

  /**
   * Generate check run summary
   */
  private generateSummary(results: AnalysisResults): string {
    const { critical, high, medium, low, total } = results.summary;

    let summary = "## ContractProof Analysis Results\n\n";

    if (total === 0) {
      summary += "✅ **No API drift detected!** Your API contracts are in perfect sync.\n\n";
      summary += "All backend endpoints and frontend API calls are properly aligned.";
      return summary;
    }

    summary += "### Summary\n\n";
    summary += `- 🔴 **Critical:** ${critical}\n`;
    summary += `- 🟠 **High:** ${high}\n`;
    summary += `- 🟡 **Medium:** ${medium}\n`;
    summary += `- 🔵 **Low:** ${low}\n`;
    summary += `- **Total:** ${total}\n\n`;

    // Add quick stats
    if (results.metadata) {
      summary += "### Analysis Details\n\n";
      summary += `- Files analyzed: ${results.metadata.analyzedFiles}\n`;
      summary += `- Backend endpoints: ${results.metadata.backendEndpoints}\n`;
      summary += `- Frontend API calls: ${results.metadata.frontendCalls}\n`;
    }

    return summary;
  }

  /**
   * Generate detailed text for check run
   */
  private generateDetailedText(results: AnalysisResults): string {
    if (results.findings.length === 0) {
      return "";
    }

    let text = "## Findings\n\n";

    // Group by severity
    const grouped = this.groupBySeverity(results.findings);

    for (const severity of ["critical", "high", "medium", "low"] as const) {
      const findings = grouped[severity] || [];
      if (findings.length === 0) continue;

      const emoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🔵" }[severity];
      text += `### ${emoji} ${severity.toUpperCase()} (${findings.length})\n\n`;

      findings.forEach((finding, idx) => {
        text += `${idx + 1}. **${finding.title}**\n`;
        text += `   - Location: \`${finding.file}:${finding.line}\`\n`;
        text += `   - ${finding.description}\n`;
        
        if (finding.suggestion) {
          text += `   - 💡 Suggestion: ${finding.suggestion}\n`;
        }
        
        text += "\n";
      });
    }

    return text;
  }

  /**
   * Generate file annotations for check run
   */
  private generateAnnotations(results: AnalysisResults): Array<{
    path: string;
    startLine: number;
    endLine: number;
    annotationLevel: "notice" | "warning" | "failure";
    message: string;
    title: string;
    rawDetails?: string;
  }> {
    const maxAnnotations = this.config.maxAnnotations || 50;
    const annotations: Array<{
      path: string;
      startLine: number;
      endLine: number;
      annotationLevel: "notice" | "warning" | "failure";
      message: string;
      title: string;
      rawDetails?: string;
    }> = [];

    // Sort findings by severity (critical first)
    const sortedFindings = [...results.findings].sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Take only the first maxAnnotations findings
    const findingsToAnnotate = sortedFindings.slice(0, maxAnnotations);

    for (const finding of findingsToAnnotate) {
      const annotationLevel = this.getAnnotationLevel(finding.severity);
      
      annotations.push({
        path: finding.file,
        startLine: finding.line,
        endLine: finding.line,
        annotationLevel,
        title: `[${finding.severity.toUpperCase()}] ${finding.title}`,
        message: finding.description,
        rawDetails: finding.suggestion
          ? `💡 Suggestion:\n${finding.suggestion}`
          : undefined,
      });
    }

    return annotations;
  }

  /**
   * Get annotation level based on severity
   */
  private getAnnotationLevel(
    severity: string
  ): "notice" | "warning" | "failure" {
    switch (severity) {
      case "critical":
        return "failure";
      case "high":
        return "failure";
      case "medium":
        return "warning";
      case "low":
        return "notice";
      default:
        return "notice";
    }
  }

  /**
   * Group findings by severity
   */
  private groupBySeverity(
    findings: AnalysisResults["findings"]
  ): Record<string, AnalysisResults["findings"]> {
    return findings.reduce((acc, finding) => {
      const severity = finding.severity;
      if (!acc[severity]) {
        acc[severity] = [];
      }
      acc[severity].push(finding);
      return acc;
    }, {} as Record<string, AnalysisResults["findings"]>);
  }

  /**
   * Add labels to PR based on findings
   */
  async addLabelsBasedOnFindings(
    owner: string,
    repo: string,
    prNumber: number,
    results: AnalysisResults,
    labelConfig?: Record<string, string>
  ): Promise<void> {
    const defaultLabels = {
      critical: "⚠️ api-drift-critical",
      high: "🔴 api-drift-high",
      medium: "🟡 api-drift-medium",
      low: "🔵 api-drift-low",
      clean: "✅ no-drift",
    };

    const labels = { ...defaultLabels, ...labelConfig };
    const labelsToAdd: string[] = [];
    const labelsToRemove: string[] = Object.values(labels);

    const { critical, high, medium, low, total } = results.summary;

    if (total === 0) {
      labelsToAdd.push(labels.clean);
    } else {
      if (critical > 0) labelsToAdd.push(labels.critical);
      if (high > 0) labelsToAdd.push(labels.high);
      if (medium > 0) labelsToAdd.push(labels.medium);
      if (low > 0) labelsToAdd.push(labels.low);
    }

    // Remove all drift labels first
    await this.githubApp.removeLabels(owner, repo, prNumber, labelsToRemove);

    // Add appropriate labels
    if (labelsToAdd.length > 0) {
      await this.githubApp.addLabels(owner, repo, prNumber, labelsToAdd);
    }
  }
}

/**
 * Create a status check manager from environment variables
 */
export function createStatusCheckManagerFromEnv(): StatusCheckManager {
  const githubApp = new GitHubApp({
    appId: process.env.GITHUB_APP_ID || "",
    privateKey: process.env.GITHUB_PRIVATE_KEY || "",
    installationId: process.env.GITHUB_INSTALLATION_ID,
  });

  return new StatusCheckManager(githubApp, {
    targetUrl: process.env.GITHUB_SERVER_URL
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined,
  });
}

// Made with Bob

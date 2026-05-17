// Bob-powered drift fixer - integrates Bob AI for automated fixes

import { DriftFinding } from "../types";
import {
  BobClient,
  BobAnalysisContext,
  BobAnalysisResult,
  FixSuggestion,
  FixPreview,
  FixResult,
} from "../bob-client";

export interface BobFixerConfig {
  apiKey: string;
  autoApply?: boolean; // Automatically apply low-risk fixes
  requireConfirmation?: boolean; // Require user confirmation before applying
  maxConcurrentFixes?: number; // Max number of fixes to apply concurrently
}

export interface FixStatus {
  findingId: string;
  status: "pending" | "analyzing" | "ready" | "applying" | "applied" | "failed" | "rolled_back";
  suggestion?: FixSuggestion;
  preview?: FixPreview;
  result?: FixResult;
  error?: string;
  timestamp: string;
}

export class BobDriftFixer {
  private bobClient: BobClient;
  private config: BobFixerConfig;
  private fixStatuses: Map<string, FixStatus>;

  constructor(config: BobFixerConfig) {
    this.config = config;
    this.bobClient = new BobClient({
      apiKey: config.apiKey,
    });
    this.fixStatuses = new Map();
  }

  /**
   * Analyze a finding with Bob and get fix suggestions
   */
  async analyzeFinding(finding: DriftFinding): Promise<BobAnalysisResult> {
    this.updateFixStatus(finding.id, {
      findingId: finding.id,
      status: "analyzing",
      timestamp: new Date().toISOString(),
    });

    try {
      const context: BobAnalysisContext = {
        finding,
        repositoryContext: this.extractRepositoryContext(finding),
      };

      const result = await this.bobClient.analyze(context);

      if (result.success && result.suggestions.length > 0) {
        this.updateFixStatus(finding.id, {
          findingId: finding.id,
          status: "ready",
          suggestion: result.suggestions[0], // Use the best suggestion
          timestamp: new Date().toISOString(),
        });
      } else {
        this.updateFixStatus(finding.id, {
          findingId: finding.id,
          status: "failed",
          error: "No fix suggestions available",
          timestamp: new Date().toISOString(),
        });
      }

      return result;
    } catch (error: any) {
      this.updateFixStatus(finding.id, {
        findingId: finding.id,
        status: "failed",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Auto-fix a finding (analyze + apply in one step)
   */
  async autoFixFinding(finding: DriftFinding): Promise<FixResult> {
    // First analyze
    const analysis = await this.analyzeFinding(finding);

    if (!analysis.success || analysis.suggestions.length === 0) {
      throw new Error("No fix suggestions available for this finding");
    }

    const suggestion = analysis.suggestions[0];

    // Check if auto-apply is allowed
    if (!this.config.autoApply && suggestion.riskLevel !== "low") {
      throw new Error("Auto-apply is disabled for medium/high risk fixes");
    }

    // Preview the fix
    const preview = await this.previewFix(finding);

    // Apply the fix
    return await this.applyFixWithConfirmation(finding, true);
  }

  /**
   * Preview a fix before applying
   */
  async previewFix(finding: DriftFinding): Promise<FixPreview> {
    const status = this.fixStatuses.get(finding.id);

    if (!status || !status.suggestion) {
      // Generate suggestion if not already done
      await this.analyzeFinding(finding);
      const updatedStatus = this.fixStatuses.get(finding.id);
      if (!updatedStatus || !updatedStatus.suggestion) {
        throw new Error("Failed to generate fix suggestion");
      }
      return await this.bobClient.previewFix(updatedStatus.suggestion);
    }

    const preview = await this.bobClient.previewFix(status.suggestion);

    this.updateFixStatus(finding.id, {
      ...status,
      preview,
    });

    return preview;
  }

  /**
   * Apply fix with optional confirmation
   */
  async applyFixWithConfirmation(
    finding: DriftFinding,
    confirmed: boolean = false
  ): Promise<FixResult> {
    const status = this.fixStatuses.get(finding.id);

    if (!status || !status.suggestion) {
      throw new Error("No fix suggestion available. Run analyzeFinding first.");
    }

    if (this.config.requireConfirmation && !confirmed) {
      throw new Error("User confirmation required before applying fix");
    }

    this.updateFixStatus(finding.id, {
      ...status,
      status: "applying",
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await this.bobClient.applyFix(status.suggestion);

      this.updateFixStatus(finding.id, {
        ...status,
        status: result.success ? "applied" : "failed",
        result,
        error: result.success ? undefined : result.message,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error: any) {
      this.updateFixStatus(finding.id, {
        ...status,
        status: "failed",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Rollback a previously applied fix
   */
  async rollbackFix(finding: DriftFinding): Promise<void> {
    const status = this.fixStatuses.get(finding.id);

    if (!status || !status.result || status.status !== "applied") {
      throw new Error("No applied fix to rollback");
    }

    try {
      await this.bobClient.rollbackFix(status.result.fixId);

      this.updateFixStatus(finding.id, {
        ...status,
        status: "rolled_back",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Batch fix multiple findings
   */
  async batchFixFindings(
    findings: DriftFinding[],
    options: {
      onProgress?: (current: number, total: number, finding: DriftFinding) => void;
      stopOnError?: boolean;
    } = {}
  ): Promise<Map<string, FixResult>> {
    const results = new Map<string, FixResult>();
    const maxConcurrent = this.config.maxConcurrentFixes || 3;

    // Process in batches
    for (let i = 0; i < findings.length; i += maxConcurrent) {
      const batch = findings.slice(i, i + maxConcurrent);
      const promises = batch.map(async (finding) => {
        try {
          if (options.onProgress) {
            options.onProgress(i + 1, findings.length, finding);
          }

          const result = await this.autoFixFinding(finding);
          results.set(finding.id, result);
          return result;
        } catch (error: any) {
          const errorResult: FixResult = {
            success: false,
            fixId: `error-${finding.id}`,
            appliedChanges: [],
            rollbackId: "",
            message: error.message,
            errors: [error.message],
          };
          results.set(finding.id, errorResult);

          if (options.stopOnError) {
            throw error;
          }

          return errorResult;
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  /**
   * Get fix status for a finding
   */
  getFixStatus(findingId: string): FixStatus | undefined {
    return this.fixStatuses.get(findingId);
  }

  /**
   * Get all fix statuses
   */
  getAllFixStatuses(): FixStatus[] {
    return Array.from(this.fixStatuses.values());
  }

  /**
   * Get statistics about fixes
   */
  getFixStatistics(): {
    total: number;
    pending: number;
    analyzing: number;
    ready: number;
    applying: number;
    applied: number;
    failed: number;
    rolledBack: number;
  } {
    const statuses = this.getAllFixStatuses();

    return {
      total: statuses.length,
      pending: statuses.filter((s) => s.status === "pending").length,
      analyzing: statuses.filter((s) => s.status === "analyzing").length,
      ready: statuses.filter((s) => s.status === "ready").length,
      applying: statuses.filter((s) => s.status === "applying").length,
      applied: statuses.filter((s) => s.status === "applied").length,
      failed: statuses.filter((s) => s.status === "failed").length,
      rolledBack: statuses.filter((s) => s.status === "rolled_back").length,
    };
  }

  /**
   * Clear fix history
   */
  clearHistory(): void {
    this.fixStatuses.clear();
  }

  /**
   * Export fix history for reporting
   */
  exportHistory(): {
    timestamp: string;
    statistics: {
      total: number;
      pending: number;
      analyzing: number;
      ready: number;
      applying: number;
      applied: number;
      failed: number;
      rolledBack: number;
    };
    fixes: FixStatus[];
  } {
    return {
      timestamp: new Date().toISOString(),
      statistics: this.getFixStatistics(),
      fixes: this.getAllFixStatuses(),
    };
  }

  /**
   * Update fix status
   */
  private updateFixStatus(findingId: string, status: FixStatus): void {
    this.fixStatuses.set(findingId, status);
  }

  /**
   * Extract repository context from finding
   */
  private extractRepositoryContext(finding: DriftFinding): {
    files: string[];
    framework: string;
    language: string;
  } {
    const files: string[] = [];

    if (finding.backend) {
      files.push(finding.backend.location.file);
    }

    if (finding.frontend) {
      finding.frontend.forEach((fe) => files.push(fe.location.file));
    }

    // Determine framework
    let framework = "unknown";
    if (finding.backend?.framework) {
      framework = finding.backend.framework;
    } else if (finding.frontend?.[0]?.framework) {
      framework = finding.frontend[0].framework;
    }

    // Determine language from file extensions
    const extensions = files.map((f) => f.split(".").pop() || "");
    const language = this.detectLanguage(extensions);

    return {
      files: [...new Set(files)], // Remove duplicates
      framework,
      language,
    };
  }

  /**
   * Detect programming language from file extensions
   */
  private detectLanguage(extensions: string[]): string {
    const languageMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      py: "python",
      java: "java",
      go: "go",
      rb: "ruby",
      php: "php",
      cs: "csharp",
    };

    for (const ext of extensions) {
      if (languageMap[ext]) {
        return languageMap[ext];
      }
    }

    return "javascript"; // Default
  }
}

/**
 * Helper function to create a Bob fixer instance
 */
export function createBobFixer(apiKey: string, options?: Partial<BobFixerConfig>): BobDriftFixer {
  return new BobDriftFixer({
    apiKey,
    autoApply: options?.autoApply ?? false,
    requireConfirmation: options?.requireConfirmation ?? true,
    maxConcurrentFixes: options?.maxConcurrentFixes ?? 3,
  });
}

/**
 * Helper function to check if a finding can be auto-fixed
 */
export function canAutoFix(finding: DriftFinding): boolean {
  // Critical issues should always be reviewed
  if (finding.severity === "critical") {
    return false;
  }

  // Check if we have enough context
  const hasBackend = !!finding.backend;
  const hasFrontend = !!finding.frontend && finding.frontend.length > 0;

  return hasBackend || hasFrontend;
}

/**
 * Helper function to estimate fix complexity
 */
export function estimateFixComplexity(finding: DriftFinding): "simple" | "moderate" | "complex" {
  let complexity = 0;

  // Count affected files
  const files = new Set<string>();
  if (finding.backend) files.add(finding.backend.location.file);
  if (finding.frontend) finding.frontend.forEach((f) => files.add(f.location.file));

  complexity += files.size;

  // Check severity
  if (finding.severity === "critical") complexity += 3;
  else if (finding.severity === "high") complexity += 2;
  else if (finding.severity === "medium") complexity += 1;

  // Check if tests are needed
  if (!finding.tests || finding.tests.length === 0) complexity += 1;

  if (complexity <= 2) return "simple";
  if (complexity <= 4) return "moderate";
  return "complex";
}

// Made with Bob
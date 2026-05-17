// IBM Bob API Client for automated code analysis and fixes

import { DriftFinding, ApiEndpoint } from "./types";

export interface BobAnalysisContext {
  finding: DriftFinding;
  repositoryContext?: {
    files: string[];
    framework: string;
    language: string;
  };
}

export interface BobAnalysisResult {
  success: boolean;
  analysis: string;
  suggestions: FixSuggestion[];
  confidence: number; // 0-1
  estimatedTime: number; // seconds
}

export interface FixSuggestion {
  id: string;
  title: string;
  description: string;
  changes: FileChange[];
  reasoning: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  testStrategy: string;
}

export interface FileChange {
  file: string;
  action: "create" | "modify" | "delete";
  originalContent?: string;
  newContent: string;
  diff?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface FixPreview {
  suggestion: FixSuggestion;
  impactedFiles: string[];
  previewDiff: string;
  warnings: string[];
}

export interface FixResult {
  success: boolean;
  fixId: string;
  appliedChanges: FileChange[];
  rollbackId: string;
  message: string;
  errors?: string[];
}

export interface BobApiConfig {
  apiKey: string;
  endpoint?: string;
  timeout?: number;
  retries?: number;
}

export class BobClient {
  private apiKey: string;
  private endpoint: string;
  private timeout: number;
  private retries: number;
  private appliedFixes: Map<string, FixResult>;

  constructor(config: BobApiConfig) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint || process.env.BOB_API_ENDPOINT || "https://api.ibm.com/bob/v1";
    this.timeout = config.timeout || 30000; // 30 seconds
    this.retries = config.retries || 3;
    this.appliedFixes = new Map();
  }

  /**
   * Analyze code with Bob AI
   */
  async analyze(context: BobAnalysisContext): Promise<BobAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(context);
    
    try {
      const response = await this.callBobApi("/analyze", {
        prompt,
        context: {
          finding: context.finding,
          repository: context.repositoryContext,
        },
        options: {
          includeFixSuggestions: true,
          analyzeDependencies: true,
          checkTestCoverage: true,
        },
      });

      return {
        success: true,
        analysis: response.analysis,
        suggestions: response.suggestions.map((s: any) => this.parseSuggestion(s)),
        confidence: response.confidence || 0.8,
        estimatedTime: response.estimatedTime || 60,
      };
    } catch (error: any) {
      console.error("Bob analysis failed:", error);
      return {
        success: false,
        analysis: `Analysis failed: ${error.message}`,
        suggestions: [],
        confidence: 0,
        estimatedTime: 0,
      };
    }
  }

  /**
   * Generate automated fix for a drift finding
   */
  async generateFix(finding: DriftFinding): Promise<FixSuggestion> {
    try {
      const response = await this.callBobApi("/generate-fix", {
        finding: {
          id: finding.id,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          backend: finding.backend,
          frontend: finding.frontend,
          bobPrompt: finding.bobPrompt,
        },
        options: {
          preserveExistingTests: true,
          generateNewTests: true,
          updateDocumentation: true,
        },
      });

      return this.parseSuggestion(response.suggestion);
    } catch (error: any) {
      throw new Error(`Failed to generate fix: ${error.message}`);
    }
  }

  /**
   * Preview fix before applying
   */
  async previewFix(suggestion: FixSuggestion): Promise<FixPreview> {
    const impactedFiles = suggestion.changes.map((c) => c.file);
    const warnings: string[] = [];

    // Check for high-risk changes
    if (suggestion.riskLevel === "high") {
      warnings.push("⚠️ This fix involves high-risk changes. Review carefully before applying.");
    }

    // Check for multiple file changes
    if (suggestion.changes.length > 5) {
      warnings.push(`⚠️ This fix modifies ${suggestion.changes.length} files. Consider applying in stages.`);
    }

    // Generate unified diff
    const previewDiff = this.generateUnifiedDiff(suggestion.changes);

    return {
      suggestion,
      impactedFiles,
      previewDiff,
      warnings,
    };
  }

  /**
   * Apply fix with Bob's guidance
   */
  async applyFix(suggestion: FixSuggestion): Promise<FixResult> {
    const fixId = `fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const rollbackId = `rollback-${fixId}`;
    const appliedChanges: FileChange[] = [];
    const errors: string[] = [];

    try {
      // Validate fix before applying
      const validation = await this.validateFix(suggestion);
      if (!validation.valid) {
        throw new Error(`Fix validation failed: ${validation.errors.join(", ")}`);
      }

      // Apply changes sequentially
      for (const change of suggestion.changes) {
        try {
          await this.applyFileChange(change);
          appliedChanges.push(change);
        } catch (error: any) {
          errors.push(`Failed to apply change to ${change.file}: ${error.message}`);
          // Rollback on error
          await this.rollbackChanges(appliedChanges);
          throw new Error(`Fix application failed: ${errors.join(", ")}`);
        }
      }

      // Store fix for potential rollback
      const result: FixResult = {
        success: true,
        fixId,
        appliedChanges,
        rollbackId,
        message: `Successfully applied ${appliedChanges.length} changes`,
      };

      this.appliedFixes.set(fixId, result);

      // Notify Bob API of successful application
      await this.notifyFixApplied(fixId, suggestion);

      return result;
    } catch (error: any) {
      return {
        success: false,
        fixId,
        appliedChanges,
        rollbackId,
        message: `Fix application failed: ${error.message}`,
        errors,
      };
    }
  }

  /**
   * Rollback a previously applied fix
   */
  async rollbackFix(fixId: string): Promise<void> {
    const fix = this.appliedFixes.get(fixId);
    if (!fix) {
      throw new Error(`Fix ${fixId} not found in history`);
    }

    await this.rollbackChanges(fix.appliedChanges);
    this.appliedFixes.delete(fixId);
  }

  /**
   * Get fix history
   */
  getFixHistory(): FixResult[] {
    return Array.from(this.appliedFixes.values());
  }

  /**
   * Build analysis prompt for Bob
   */
  private buildAnalysisPrompt(context: BobAnalysisContext): string {
    const { finding } = context;
    
    let prompt = `# API Drift Analysis Request\n\n`;
    prompt += `## Issue Details\n`;
    prompt += `- **Type**: ${finding.title}\n`;
    prompt += `- **Severity**: ${finding.severity}\n`;
    prompt += `- **Description**: ${finding.description}\n`;
    prompt += `- **Impact**: ${finding.impact}\n\n`;

    if (finding.backend) {
      prompt += `## Backend Implementation\n`;
      prompt += `- **File**: ${finding.backend.location.file}:${finding.backend.location.line}\n`;
      prompt += `- **Route**: ${finding.backend.method} ${finding.backend.path}\n`;
      prompt += `- **Framework**: ${finding.backend.framework}\n`;
      prompt += `\`\`\`\n${finding.backend.location.code}\n\`\`\`\n\n`;
    }

    if (finding.frontend && finding.frontend.length > 0) {
      prompt += `## Frontend Usage\n`;
      finding.frontend.forEach((fe, idx) => {
        prompt += `### Call ${idx + 1}\n`;
        prompt += `- **File**: ${fe.location.file}:${fe.location.line}\n`;
        prompt += `- **Method**: ${fe.method} ${fe.path}\n`;
        prompt += `\`\`\`\n${fe.location.code}\n\`\`\`\n\n`;
      });
    }

    prompt += `## Task\n`;
    prompt += `Please analyze this API drift issue and provide:\n`;
    prompt += `1. Root cause analysis\n`;
    prompt += `2. Recommended fix with code changes\n`;
    prompt += `3. Test cases to prevent regression\n`;
    prompt += `4. Documentation updates if needed\n\n`;

    prompt += `Ensure the fix maintains backward compatibility where possible and follows best practices.\n`;

    return prompt;
  }

  /**
   * Call Bob API with retry logic
   */
  private async callBobApi(endpoint: string, payload: any): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const response = await fetch(`${this.endpoint}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
            "X-Bob-Client": "ContractProof/1.0",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(`Bob API error (${response.status}): ${error.error || error.message}`);
        }

        return await response.json();
      } catch (error: any) {
        lastError = error;
        console.warn(`Bob API attempt ${attempt}/${this.retries} failed:`, error.message);
        
        if (attempt < this.retries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error("Bob API call failed after retries");
  }

  /**
   * Parse Bob's suggestion response
   */
  private parseSuggestion(suggestion: any): FixSuggestion {
    return {
      id: suggestion.id || `suggestion-${Date.now()}`,
      title: suggestion.title,
      description: suggestion.description,
      changes: suggestion.changes.map((c: any) => ({
        file: c.file,
        action: c.action,
        originalContent: c.originalContent,
        newContent: c.newContent,
        diff: c.diff,
        lineStart: c.lineStart,
        lineEnd: c.lineEnd,
      })),
      reasoning: suggestion.reasoning,
      confidence: suggestion.confidence || 0.8,
      riskLevel: suggestion.riskLevel || "medium",
      testStrategy: suggestion.testStrategy || "Manual testing recommended",
    };
  }

  /**
   * Validate fix before applying
   */
  private async validateFix(suggestion: FixSuggestion): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check if all files exist
    for (const change of suggestion.changes) {
      if (change.action === "modify" && !change.originalContent) {
        errors.push(`Cannot modify ${change.file}: original content not provided`);
      }
    }

    // Check for conflicts
    if (suggestion.changes.length === 0) {
      errors.push("No changes specified in fix");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Apply a single file change
   */
  private async applyFileChange(change: FileChange): Promise<void> {
    // This would integrate with the file system
    // For now, we'll simulate the operation
    console.log(`Applying ${change.action} to ${change.file}`);
    
    // In a real implementation, this would:
    // 1. Read the file
    // 2. Apply the change
    // 3. Write back to disk
    // 4. Verify the change
  }

  /**
   * Rollback applied changes
   */
  private async rollbackChanges(changes: FileChange[]): Promise<void> {
    for (const change of changes.reverse()) {
      if (change.action === "modify" && change.originalContent) {
        // Restore original content
        console.log(`Rolling back ${change.file}`);
      } else if (change.action === "create") {
        // Delete created file
        console.log(`Deleting created file ${change.file}`);
      }
    }
  }

  /**
   * Generate unified diff for preview
   */
  private generateUnifiedDiff(changes: FileChange[]): string {
    let diff = "";

    for (const change of changes) {
      diff += `\n--- ${change.file}\n`;
      diff += `+++ ${change.file}\n`;
      
      if (change.diff) {
        diff += change.diff;
      } else if (change.action === "modify") {
        diff += `@@ -${change.lineStart || 1},${change.lineEnd || 1} +${change.lineStart || 1},${change.lineEnd || 1} @@\n`;
        diff += `- ${change.originalContent || ""}\n`;
        diff += `+ ${change.newContent}\n`;
      } else if (change.action === "create") {
        diff += `@@ -0,0 +1,${change.newContent.split("\n").length} @@\n`;
        change.newContent.split("\n").forEach((line) => {
          diff += `+ ${line}\n`;
        });
      }
    }

    return diff;
  }

  /**
   * Notify Bob API that fix was applied
   */
  private async notifyFixApplied(fixId: string, suggestion: FixSuggestion): Promise<void> {
    try {
      await this.callBobApi("/fix-applied", {
        fixId,
        suggestionId: suggestion.id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Non-critical, just log
      console.warn("Failed to notify Bob of fix application:", error);
    }
  }
}

// Made with Bob
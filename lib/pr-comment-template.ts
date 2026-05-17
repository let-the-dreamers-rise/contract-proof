// PR Comment Template Generator for ContractProof
// Creates professional, actionable PR comments with drift findings

export interface DriftFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  type: string;
  title: string;
  description: string;
  file: string;
  line: number;
  suggestion?: string;
  codeSnippet?: string;
  language?: string;
  impact?: string;
  effort?: string;
}

export interface AnalysisResults {
  findings: DriftFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  metadata?: {
    analyzedFiles: number;
    backendEndpoints: number;
    frontendCalls: number;
    timestamp: string;
  };
}

export interface PRCommentConfig {
  severity_threshold?: string;
  include_suggestions?: boolean;
  include_code_snippets?: boolean;
  max_findings_per_severity?: number;
  show_metadata?: boolean;
}

const SEVERITY_EMOJI = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
};

const SEVERITY_LABELS = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

/**
 * Generate a professional PR comment from analysis results
 */
export function generatePRComment(
  results: AnalysisResults,
  config?: PRCommentConfig
): string {
  const {
    include_suggestions = true,
    include_code_snippets = true,
    max_findings_per_severity = 10,
    show_metadata = true,
  } = config || {};

  let comment = "";

  // Header
  comment += generateHeader(results);

  // Summary section
  comment += generateSummary(results);

  // Status badge
  comment += generateStatusBadge(results, config?.severity_threshold);

  // Findings section
  if (results.findings.length > 0) {
    comment += generateFindings(
      results,
      include_suggestions,
      include_code_snippets,
      max_findings_per_severity
    );
  } else {
    comment += generateSuccessMessage();
  }

  // Metadata section
  if (show_metadata && results.metadata) {
    comment += generateMetadata(results.metadata);
  }

  // Footer
  comment += generateFooter(config?.severity_threshold);

  return comment;
}

/**
 * Generate comment header
 */
function generateHeader(results: AnalysisResults): string {
  const icon = results.findings.length === 0 ? "✅" : "🔍";
  return `## ${icon} ContractProof API Drift Analysis\n\n`;
}

/**
 * Generate summary table
 */
function generateSummary(results: AnalysisResults): string {
  let summary = "### 📊 Summary\n\n";
  summary += "| Severity | Count |\n";
  summary += "|----------|-------|\n";
  summary += `| ${SEVERITY_EMOJI.critical} Critical | **${results.summary.critical}** |\n`;
  summary += `| ${SEVERITY_EMOJI.high} High | **${results.summary.high}** |\n`;
  summary += `| ${SEVERITY_EMOJI.medium} Medium | **${results.summary.medium}** |\n`;
  summary += `| ${SEVERITY_EMOJI.low} Low | **${results.summary.low}** |\n`;
  summary += `| **Total** | **${results.summary.total}** |\n\n`;
  return summary;
}

/**
 * Generate status badge
 */
function generateStatusBadge(
  results: AnalysisResults,
  threshold?: string
): string {
  const { critical, high, medium, low } = results.summary;
  let status = "✅ PASSED";
  let color = "green";

  // Determine status based on threshold
  switch (threshold) {
    case "critical":
      if (critical > 0) {
        status = "❌ FAILED";
        color = "red";
      }
      break;
    case "high":
      if (critical > 0 || high > 0) {
        status = "❌ FAILED";
        color = "red";
      }
      break;
    case "medium":
      if (critical > 0 || high > 0 || medium > 0) {
        status = "❌ FAILED";
        color = "red";
      }
      break;
    case "low":
      if (critical > 0 || high > 0 || medium > 0 || low > 0) {
        status = "❌ FAILED";
        color = "red";
      }
      break;
    default:
      if (critical > 0 || high > 0) {
        status = "❌ FAILED";
        color = "red";
      }
  }

  return `**Status:** ![${status}](https://img.shields.io/badge/${encodeURIComponent(status)}-${color}?style=flat-square)\n\n`;
}

/**
 * Generate findings section
 */
function generateFindings(
  results: AnalysisResults,
  includeSuggestions: boolean,
  includeCodeSnippets: boolean,
  maxPerSeverity: number
): string {
  let findings = "### 📋 Findings\n\n";

  // Group findings by severity
  const grouped = groupBySeverity(results.findings);

  // Generate sections for each severity level
  for (const severity of ["critical", "high", "medium", "low"] as const) {
    const severityFindings = grouped[severity] || [];
    
    if (severityFindings.length === 0) continue;

    const displayCount = Math.min(severityFindings.length, maxPerSeverity);
    const hasMore = severityFindings.length > maxPerSeverity;

    findings += `<details>\n`;
    findings += `<summary>${SEVERITY_EMOJI[severity]} <strong>${SEVERITY_LABELS[severity]}</strong> (${severityFindings.length} ${severityFindings.length === 1 ? "issue" : "issues"})</summary>\n\n`;

    // Display findings
    for (let i = 0; i < displayCount; i++) {
      const finding = severityFindings[i];
      findings += generateFindingDetail(
        finding,
        i + 1,
        includeSuggestions,
        includeCodeSnippets
      );
    }

    if (hasMore) {
      findings += `\n*... and ${severityFindings.length - maxPerSeverity} more ${severity} severity ${severityFindings.length - maxPerSeverity === 1 ? "issue" : "issues"}*\n\n`;
    }

    findings += `</details>\n\n`;
  }

  return findings;
}

/**
 * Generate individual finding detail
 */
function generateFindingDetail(
  finding: DriftFinding,
  index: number,
  includeSuggestions: boolean,
  includeCodeSnippets: boolean
): string {
  let detail = `#### ${index}. ${finding.title}\n\n`;

  // Basic info
  detail += `**Type:** \`${finding.type}\`\n\n`;
  detail += `**Location:** [\`${finding.file}:${finding.line}\`](${finding.file}#L${finding.line})\n\n`;
  detail += `**Description:** ${finding.description}\n\n`;

  // Impact and effort
  if (finding.impact) {
    detail += `**Impact:** ${finding.impact}\n\n`;
  }
  if (finding.effort) {
    detail += `**Effort to Fix:** ${finding.effort}\n\n`;
  }

  // Code snippet
  if (includeCodeSnippets && finding.codeSnippet) {
    detail += "**Code:**\n\n";
    detail += "```" + (finding.language || "typescript") + "\n";
    detail += finding.codeSnippet + "\n";
    detail += "```\n\n";
  }

  // Suggestion
  if (includeSuggestions && finding.suggestion) {
    detail += `💡 **Suggested Fix:**\n\n`;
    detail += `${finding.suggestion}\n\n`;
  }

  detail += "---\n\n";

  return detail;
}

/**
 * Generate success message
 */
function generateSuccessMessage(): string {
  return `### ✅ No API Drift Detected!\n\n` +
    `Your API contracts are in perfect sync. Great job! 🎉\n\n` +
    `All backend endpoints and frontend API calls are properly aligned.\n\n`;
}

/**
 * Generate metadata section
 */
function generateMetadata(metadata: NonNullable<AnalysisResults["metadata"]>): string {
  let meta = "### 📈 Analysis Details\n\n";
  meta += "| Metric | Value |\n";
  meta += "|--------|-------|\n";
  meta += `| Files Analyzed | ${metadata.analyzedFiles} |\n`;
  meta += `| Backend Endpoints | ${metadata.backendEndpoints} |\n`;
  meta += `| Frontend API Calls | ${metadata.frontendCalls} |\n`;
  meta += `| Analysis Time | ${new Date(metadata.timestamp).toLocaleString()} |\n\n`;
  return meta;
}

/**
 * Generate footer
 */
function generateFooter(threshold?: string): string {
  let footer = "---\n\n";
  footer += `<sub>`;
  footer += `🤖 Powered by [ContractProof](https://github.com/contractproof/contractproof) | `;
  footer += `Threshold: \`${threshold || "high"}\` | `;
  footer += `[Documentation](https://github.com/contractproof/contractproof/blob/main/docs/CI_CD_INTEGRATION.md) | `;
  footer += `[Report Issue](https://github.com/contractproof/contractproof/issues)`;
  footer += `</sub>\n`;
  return footer;
}

/**
 * Group findings by severity
 */
function groupBySeverity(findings: DriftFinding[]): Record<string, DriftFinding[]> {
  return findings.reduce((acc, finding) => {
    const severity = finding.severity;
    if (!acc[severity]) {
      acc[severity] = [];
    }
    acc[severity].push(finding);
    return acc;
  }, {} as Record<string, DriftFinding[]>);
}

/**
 * Generate a compact summary for status checks
 */
export function generateStatusCheckSummary(results: AnalysisResults): string {
  const { critical, high, medium, low } = results.summary;
  
  if (results.findings.length === 0) {
    return "No API drift detected";
  }

  const parts: string[] = [];
  if (critical > 0) parts.push(`${critical} critical`);
  if (high > 0) parts.push(`${high} high`);
  if (medium > 0) parts.push(`${medium} medium`);
  if (low > 0) parts.push(`${low} low`);

  return `Found ${parts.join(", ")} severity ${results.findings.length === 1 ? "issue" : "issues"}`;
}

/**
 * Generate a Slack-formatted message
 */
export function generateSlackMessage(results: AnalysisResults, prNumber?: number): any {
  const { critical, high, medium, low, total } = results.summary;
  
  const color = critical > 0 ? "danger" : high > 0 ? "warning" : "good";
  const status = total === 0 ? "✅ No drift detected" : `⚠️ ${total} ${total === 1 ? "issue" : "issues"} found`;

  return {
    text: `ContractProof Analysis ${prNumber ? `for PR #${prNumber}` : ""}`,
    attachments: [
      {
        color,
        title: status,
        fields: [
          {
            title: "Critical",
            value: critical.toString(),
            short: true,
          },
          {
            title: "High",
            value: high.toString(),
            short: true,
          },
          {
            title: "Medium",
            value: medium.toString(),
            short: true,
          },
          {
            title: "Low",
            value: low.toString(),
            short: true,
          },
        ],
        footer: "ContractProof",
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };
}

/**
 * Generate a Discord-formatted embed
 */
export function generateDiscordEmbed(results: AnalysisResults, prNumber?: number): any {
  const { critical, high, medium, low, total } = results.summary;
  
  const color = critical > 0 ? 0xff0000 : high > 0 ? 0xffa500 : 0x00ff00;
  const status = total === 0 ? "✅ No drift detected" : `⚠️ ${total} ${total === 1 ? "issue" : "issues"} found`;

  return {
    embeds: [
      {
        title: `ContractProof Analysis ${prNumber ? `for PR #${prNumber}` : ""}`,
        description: status,
        color,
        fields: [
          {
            name: "🔴 Critical",
            value: critical.toString(),
            inline: true,
          },
          {
            name: "🟠 High",
            value: high.toString(),
            inline: true,
          },
          {
            name: "🟡 Medium",
            value: medium.toString(),
            inline: true,
          },
          {
            name: "🔵 Low",
            value: low.toString(),
            inline: true,
          },
        ],
        footer: {
          text: "ContractProof",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

// Made with Bob

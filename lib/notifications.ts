// Notification Manager for ContractProof
// Handles Slack, Discord, and Email notifications

import { AnalysisResults, generateSlackMessage, generateDiscordEmbed } from "./pr-comment-template";

export interface NotificationConfig {
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel?: string;
    mentionOnCritical?: boolean;
    mentionUsers?: string[];
  };
  discord?: {
    enabled: boolean;
    webhookUrl: string;
    mentionOnCritical?: boolean;
    mentionRoles?: string[];
  };
  email?: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    from: string;
    to: string[];
  };
}

export interface NotificationOptions {
  prNumber?: number;
  prUrl?: string;
  repoName?: string;
  branch?: string;
  author?: string;
  channel?: "slack" | "discord" | "email";
}

export class NotificationManager {
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  /**
   * Send notification to all enabled channels
   */
  async sendNotification(
    results: AnalysisResults,
    options?: NotificationOptions
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.slack?.enabled) {
      promises.push(this.sendSlackNotification(results, options));
    }

    if (this.config.discord?.enabled) {
      promises.push(this.sendDiscordNotification(results, options));
    }

    if (this.config.email?.enabled) {
      promises.push(this.sendEmailNotification(results, options));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification(
    results: AnalysisResults,
    options?: NotificationOptions
  ): Promise<void> {
    if (!this.config.slack?.enabled || !this.config.slack.webhookUrl) {
      throw new Error("Slack notifications not configured");
    }

    try {
      const message = this.buildSlackMessage(results, options);

      const response = await fetch(this.config.slack.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.statusText}`);
      }

      console.log("✅ Slack notification sent successfully");
    } catch (error) {
      console.error("❌ Failed to send Slack notification:", error);
      throw error;
    }
  }

  /**
   * Send Discord notification
   */
  async sendDiscordNotification(
    results: AnalysisResults,
    options?: NotificationOptions
  ): Promise<void> {
    if (!this.config.discord?.enabled || !this.config.discord.webhookUrl) {
      throw new Error("Discord notifications not configured");
    }

    try {
      const message = this.buildDiscordMessage(results, options);

      const response = await fetch(this.config.discord.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.statusText}`);
      }

      console.log("✅ Discord notification sent successfully");
    } catch (error) {
      console.error("❌ Failed to send Discord notification:", error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(
    results: AnalysisResults,
    options?: NotificationOptions
  ): Promise<void> {
    if (!this.config.email?.enabled) {
      throw new Error("Email notifications not configured");
    }

    try {
      // Note: In a real implementation, you would use nodemailer or similar
      // This is a placeholder implementation
      console.log("📧 Email notification would be sent to:", this.config.email.to);
      console.log("Subject:", this.buildEmailSubject(results, options));
      console.log("Body:", this.buildEmailBody(results, options));

      // TODO: Implement actual email sending with nodemailer
      // const transporter = nodemailer.createTransport({...});
      // await transporter.sendMail({...});

      console.log("✅ Email notification sent successfully");
    } catch (error) {
      console.error("❌ Failed to send email notification:", error);
      throw error;
    }
  }

  /**
   * Build Slack message
   */
  private buildSlackMessage(
    results: AnalysisResults,
    options?: NotificationOptions
  ): any {
    const baseMessage = generateSlackMessage(results, options?.prNumber);
    
    // Add additional context
    let text = baseMessage.text;
    
    if (options?.repoName) {
      text += ` in ${options.repoName}`;
    }
    
    if (options?.prUrl) {
      text += ` - <${options.prUrl}|View PR>`;
    }

    // Add mentions for critical issues
    if (
      this.config.slack?.mentionOnCritical &&
      results.summary.critical > 0 &&
      this.config.slack.mentionUsers
    ) {
      text += `\n${this.config.slack.mentionUsers.join(" ")} - Critical issues detected!`;
    }

    // Add channel override
    const message: any = {
      ...baseMessage,
      text,
    };

    if (this.config.slack?.channel) {
      message.channel = this.config.slack.channel;
    }

    // Add additional fields
    if (options) {
      const additionalFields: any[] = [];

      if (options.repoName) {
        additionalFields.push({
          title: "Repository",
          value: options.repoName,
          short: true,
        });
      }

      if (options.branch) {
        additionalFields.push({
          title: "Branch",
          value: options.branch,
          short: true,
        });
      }

      if (options.author) {
        additionalFields.push({
          title: "Author",
          value: options.author,
          short: true,
        });
      }

      if (additionalFields.length > 0) {
        message.attachments[0].fields.push(...additionalFields);
      }
    }

    return message;
  }

  /**
   * Build Discord message
   */
  private buildDiscordMessage(
    results: AnalysisResults,
    options?: NotificationOptions
  ): any {
    const baseMessage = generateDiscordEmbed(results, options?.prNumber);
    
    // Add content with mentions for critical issues
    let content = "";
    
    if (
      this.config.discord?.mentionOnCritical &&
      results.summary.critical > 0 &&
      this.config.discord.mentionRoles
    ) {
      content = this.config.discord.mentionRoles.join(" ") + " - Critical API drift detected!";
    }

    // Add additional fields
    if (options) {
      const additionalFields: any[] = [];

      if (options.repoName) {
        additionalFields.push({
          name: "📦 Repository",
          value: options.repoName,
          inline: true,
        });
      }

      if (options.branch) {
        additionalFields.push({
          name: "🌿 Branch",
          value: options.branch,
          inline: true,
        });
      }

      if (options.author) {
        additionalFields.push({
          name: "👤 Author",
          value: options.author,
          inline: true,
        });
      }

      if (options.prUrl) {
        additionalFields.push({
          name: "🔗 Pull Request",
          value: `[View PR](${options.prUrl})`,
          inline: false,
        });
      }

      if (additionalFields.length > 0) {
        baseMessage.embeds[0].fields.push(...additionalFields);
      }
    }

    return {
      content,
      ...baseMessage,
    };
  }

  /**
   * Build email subject
   */
  private buildEmailSubject(
    results: AnalysisResults,
    options?: NotificationOptions
  ): string {
    const { critical, high, total } = results.summary;
    
    let subject = "ContractProof: ";
    
    if (total === 0) {
      subject += "✅ No API Drift Detected";
    } else if (critical > 0) {
      subject += `🔴 Critical API Drift (${total} issues)`;
    } else if (high > 0) {
      subject += `🟠 High Severity API Drift (${total} issues)`;
    } else {
      subject += `⚠️ API Drift Detected (${total} issues)`;
    }

    if (options?.repoName) {
      subject += ` - ${options.repoName}`;
    }

    if (options?.prNumber) {
      subject += ` PR #${options.prNumber}`;
    }

    return subject;
  }

  /**
   * Build email body
   */
  private buildEmailBody(
    results: AnalysisResults,
    options?: NotificationOptions
  ): string {
    let body = "<html><body style='font-family: Arial, sans-serif;'>";
    
    // Header
    body += "<h1>ContractProof API Drift Analysis</h1>";
    
    if (options?.repoName) {
      body += `<p><strong>Repository:</strong> ${options.repoName}</p>`;
    }
    
    if (options?.prNumber && options?.prUrl) {
      body += `<p><strong>Pull Request:</strong> <a href="${options.prUrl}">#${options.prNumber}</a></p>`;
    }
    
    if (options?.branch) {
      body += `<p><strong>Branch:</strong> ${options.branch}</p>`;
    }
    
    if (options?.author) {
      body += `<p><strong>Author:</strong> ${options.author}</p>`;
    }

    // Summary
    body += "<h2>Summary</h2>";
    body += "<table style='border-collapse: collapse; width: 100%;'>";
    body += "<tr style='background-color: #f2f2f2;'>";
    body += "<th style='border: 1px solid #ddd; padding: 8px; text-align: left;'>Severity</th>";
    body += "<th style='border: 1px solid #ddd; padding: 8px; text-align: left;'>Count</th>";
    body += "</tr>";
    
    const { critical, high, medium, low, total } = results.summary;
    
    body += `<tr><td style='border: 1px solid #ddd; padding: 8px;'>🔴 Critical</td><td style='border: 1px solid #ddd; padding: 8px;'>${critical}</td></tr>`;
    body += `<tr><td style='border: 1px solid #ddd; padding: 8px;'>🟠 High</td><td style='border: 1px solid #ddd; padding: 8px;'>${high}</td></tr>`;
    body += `<tr><td style='border: 1px solid #ddd; padding: 8px;'>🟡 Medium</td><td style='border: 1px solid #ddd; padding: 8px;'>${medium}</td></tr>`;
    body += `<tr><td style='border: 1px solid #ddd; padding: 8px;'>🔵 Low</td><td style='border: 1px solid #ddd; padding: 8px;'>${low}</td></tr>`;
    body += `<tr style='background-color: #f2f2f2; font-weight: bold;'><td style='border: 1px solid #ddd; padding: 8px;'>Total</td><td style='border: 1px solid #ddd; padding: 8px;'>${total}</td></tr>`;
    body += "</table>";

    // Findings
    if (results.findings.length > 0) {
      body += "<h2>Findings</h2>";
      
      // Group by severity
      const grouped = this.groupBySeverity(results.findings);
      
      for (const severity of ["critical", "high", "medium", "low"] as const) {
        const findings = grouped[severity] || [];
        if (findings.length === 0) continue;

        const emoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🔵" }[severity];
        body += `<h3>${emoji} ${severity.toUpperCase()} (${findings.length})</h3>`;
        body += "<ul>";

        findings.forEach((finding) => {
          body += `<li>`;
          body += `<strong>${finding.title}</strong><br>`;
          body += `<em>Location:</em> ${finding.file}:${finding.line}<br>`;
          body += `<em>Description:</em> ${finding.description}`;
          
          if (finding.suggestion) {
            body += `<br><em>💡 Suggestion:</em> ${finding.suggestion}`;
          }
          
          body += `</li>`;
        });

        body += "</ul>";
      }
    } else {
      body += "<p style='color: green; font-size: 18px;'>✅ No API drift detected! Your contracts are in sync.</p>";
    }

    // Footer
    body += "<hr>";
    body += "<p style='color: #666; font-size: 12px;'>";
    body += "This is an automated notification from ContractProof. ";
    body += "For more information, visit the <a href='https://github.com/contractproof/contractproof'>ContractProof documentation</a>.";
    body += "</p>";
    
    body += "</body></html>";

    return body;
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
   * Test notification configuration
   */
  async testNotification(channel: "slack" | "discord" | "email"): Promise<boolean> {
    const testResults: AnalysisResults = {
      findings: [
        {
          id: "test-1",
          severity: "high",
          type: "test",
          title: "Test Finding",
          description: "This is a test notification from ContractProof",
          file: "test.ts",
          line: 1,
          suggestion: "This is a test - no action required",
        },
      ],
      summary: {
        total: 1,
        critical: 0,
        high: 1,
        medium: 0,
        low: 0,
      },
    };

    try {
      switch (channel) {
        case "slack":
          await this.sendSlackNotification(testResults, {
            repoName: "test-repo",
            branch: "test-branch",
          });
          break;
        case "discord":
          await this.sendDiscordNotification(testResults, {
            repoName: "test-repo",
            branch: "test-branch",
          });
          break;
        case "email":
          await this.sendEmailNotification(testResults, {
            repoName: "test-repo",
            branch: "test-branch",
          });
          break;
      }
      return true;
    } catch (error) {
      console.error(`Test notification failed for ${channel}:`, error);
      return false;
    }
  }
}

/**
 * Create notification manager from environment variables
 */
export function createNotificationManagerFromEnv(): NotificationManager {
  return new NotificationManager({
    slack: {
      enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
      webhookUrl: process.env.SLACK_WEBHOOK_URL || "",
      channel: process.env.SLACK_CHANNEL,
      mentionOnCritical: process.env.SLACK_MENTION_ON_CRITICAL === "true",
      mentionUsers: process.env.SLACK_MENTION_USERS?.split(","),
    },
    discord: {
      enabled: process.env.DISCORD_WEBHOOK_URL ? true : false,
      webhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
      mentionOnCritical: process.env.DISCORD_MENTION_ON_CRITICAL === "true",
      mentionRoles: process.env.DISCORD_MENTION_ROLES?.split(","),
    },
    email: {
      enabled: process.env.SMTP_HOST ? true : false,
      smtpHost: process.env.SMTP_HOST || "",
      smtpPort: parseInt(process.env.SMTP_PORT || "587"),
      smtpUser: process.env.SMTP_USER || "",
      smtpPassword: process.env.SMTP_PASSWORD || "",
      from: process.env.EMAIL_FROM || "contractproof@example.com",
      to: process.env.EMAIL_TO?.split(",") || [],
    },
  });
}

// Made with Bob

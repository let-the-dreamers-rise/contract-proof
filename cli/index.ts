#!/usr/bin/env node

// ContractProof CLI - Command-line interface for API drift detection

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { GitHubAnalyzer } from "../lib/github-analyzer";
import { RealBackendAnalyzer } from "../lib/analyzers/real-backend-analyzer";
import { RealFrontendAnalyzer } from "../lib/analyzers/real-frontend-analyzer";
import { RealDriftDetector } from "../lib/analyzers/real-drift-detector";
import { GitHubApp } from "../lib/github-app";
import { generatePRComment } from "../lib/pr-comment-template";
import { StatusCheckManager } from "../lib/status-check";
import { NotificationManager } from "../lib/notifications";

const program = new Command();

// Version
program
  .name("contractproof")
  .description("Bob-Powered API Drift Guard - Detect API contract drift across your entire stack")
  .version("1.0.0");

// Analyze command
program
  .command("analyze")
  .description("Analyze a repository for API drift")
  .argument("<repo-url>", "GitHub repository URL or local path")
  .option("-b, --branch <branch>", "Branch to analyze", "main")
  .option("-f, --format <format>", "Output format (json|markdown|text)", "text")
  .option("-o, --output <file>", "Output file path")
  .option("--config <path>", "Path to .contractproof.yml config file")
  .option("--no-cache", "Disable caching")
  .action(async (repoUrl, options) => {
    const spinner = ora("Initializing analysis...").start();

    try {
      // Load configuration
      const config = loadConfig(options.config);
      spinner.text = "Configuration loaded";

      // Initialize analyzer
      const githubToken = process.env.GITHUB_TOKEN;
      const analyzer = new GitHubAnalyzer(githubToken);

      // Parse repository URL
      spinner.text = "Parsing repository...";
      const repoInfo = analyzer.parseGitHubUrl(repoUrl);
      
      if (!repoInfo) {
        spinner.fail(chalk.red("Invalid repository URL"));
        process.exit(1);
      }

      // Clone or load repository
      spinner.text = `Cloning ${repoInfo.owner}/${repoInfo.repo}...`;
      const localPath = await analyzer.cloneRepository(repoInfo);

      // Get all files
      spinner.text = "Scanning files...";
      const files = await analyzer.getRepositoryFiles(localPath);
      spinner.succeed(chalk.green(`Found ${files.length} files`));

      // Analyze backend
      spinner.start("Analyzing backend APIs...");
      const backendAnalyzer = new RealBackendAnalyzer();
      const backendEndpoints = files.flatMap(f => backendAnalyzer.analyzeFile(f.content, f.path));
      spinner.succeed(chalk.green(`Found ${backendEndpoints.length} backend endpoints`));

      // Analyze frontend
      spinner.start("Analyzing frontend API calls...");
      const frontendAnalyzer = new RealFrontendAnalyzer();
      const frontendEndpoints = files.flatMap(f => frontendAnalyzer.analyzeFile(f.content, f.path));
      spinner.succeed(chalk.green(`Found ${frontendEndpoints.length} frontend API calls`));

      // Detect drift
      spinner.start("Detecting API drift...");
      const driftDetector = new RealDriftDetector();
      const findings = driftDetector.detectDrift(backendEndpoints, frontendEndpoints, [], []);
      const driftResults = {
        findings: findings.map(f => ({ ...f, type: f.title?.split(':')[0] || 'drift', file: f.backend?.location.file || f.frontend?.[0]?.location.file || '', line: f.backend?.location.line || f.frontend?.[0]?.location.line || 0 })),
        summary: {
          total: findings.length,
          critical: findings.filter(f => f.severity === 'critical').length,
          high: findings.filter(f => f.severity === 'high').length,
          medium: findings.filter(f => f.severity === 'medium').length,
          low: findings.filter(f => f.severity === 'low').length,
        },
        metadata: {
          analyzedFiles: files.length,
          backendEndpoints: backendEndpoints.length,
          frontendCalls: frontendEndpoints.length,
          timestamp: new Date().toISOString(),
        },
      };
      
      const totalIssues = findings.length;
      const criticalCount = findings.filter(f => f.severity === "critical").length;
      const highCount = findings.filter(f => f.severity === "high").length;
      
      if (totalIssues === 0) {
        spinner.succeed(chalk.green("✅ No API drift detected!"));
      } else {
        spinner.warn(chalk.yellow(`⚠️  Found ${totalIssues} drift issues`));
      }

      // Format output
      const output = formatOutput(driftResults, options.format);

      // Save to file or print
      if (options.output) {
        fs.writeFileSync(options.output, output);
        console.log(chalk.green(`\n✅ Results saved to ${options.output}`));
      } else {
        console.log("\n" + output);
      }

      // Print summary
      printSummary(driftResults);

      // Exit with appropriate code
      const threshold = config?.severity_threshold || "high";
      const shouldFail = shouldFailBasedOnThreshold(driftResults, threshold);
      
      if (shouldFail) {
        console.log(chalk.red(`\n❌ Analysis failed: Issues exceed ${threshold} severity threshold`));
        process.exit(1);
      } else {
        console.log(chalk.green("\n✅ Analysis passed"));
        process.exit(0);
      }

    } catch (error) {
      spinner.fail(chalk.red("Analysis failed"));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Check PR command
program
  .command("check")
  .description("Check a pull request for API drift")
  .option("--pr <number>", "Pull request number", parseInt)
  .option("--repo <repo>", "Repository (owner/repo)")
  .option("-f, --format <format>", "Output format (json|markdown|text)", "json")
  .option("--config <path>", "Path to .contractproof.yml config file")
  .action(async (options) => {
    const spinner = ora("Checking pull request...").start();

    try {
      // Validate options
      if (!options.pr) {
        spinner.fail(chalk.red("PR number is required"));
        process.exit(1);
      }

      // Load configuration
      const config = loadConfig(options.config);

      // Get repository info from environment or option
      const repo = options.repo || process.env.GITHUB_REPOSITORY;
      if (!repo) {
        spinner.fail(chalk.red("Repository not specified"));
        process.exit(1);
      }

      const [owner, repoName] = repo.split("/");

      // Initialize GitHub App
      const githubApp = new GitHubApp({
        appId: process.env.GITHUB_APP_ID || "",
        privateKey: process.env.GITHUB_PRIVATE_KEY || "",
        installationId: process.env.GITHUB_INSTALLATION_ID,
      });

      // Get PR files
      spinner.text = "Fetching PR files...";
      const prFiles = await githubApp.getPRFiles(owner, repoName, options.pr);
      spinner.succeed(chalk.green(`Found ${prFiles.length} changed files`));

      // Analyze changed files
      spinner.start("Analyzing changes...");
      const files = await Promise.all(
        prFiles.map(async (file) => ({
          path: file.filename,
          content: await githubApp.getFileContent(owner, repoName, file.filename),
          type: "unknown" as const,
        }))
      );

      // Run analysis
      const backendAnalyzer = new RealBackendAnalyzer();
      const frontendAnalyzer = new RealFrontendAnalyzer();
      const driftDetector = new RealDriftDetector();

      const backendEndpoints = files.flatMap(f => backendAnalyzer.analyzeFile(f.content, f.path));
      const frontendEndpoints = files.flatMap(f => frontendAnalyzer.analyzeFile(f.content, f.path));
      const driftFindings = driftDetector.detectDrift(backendEndpoints, frontendEndpoints, [], []);
      const driftResults = {
        findings: driftFindings.map(f => ({ ...f, type: f.title?.split(':')[0] || 'drift', file: f.backend?.location.file || f.frontend?.[0]?.location.file || '', line: f.backend?.location.line || f.frontend?.[0]?.location.line || 0 })),
        summary: {
          total: driftFindings.length,
          critical: driftFindings.filter(f => f.severity === 'critical').length,
          high: driftFindings.filter(f => f.severity === 'high').length,
          medium: driftFindings.filter(f => f.severity === 'medium').length,
          low: driftFindings.filter(f => f.severity === 'low').length,
        },
        metadata: {
          analyzedFiles: files.length,
          backendEndpoints: backendEndpoints.length,
          frontendCalls: frontendEndpoints.length,
          timestamp: new Date().toISOString(),
        },
      };

      spinner.succeed(chalk.green("Analysis complete"));

      // Generate PR comment
      const comment = generatePRComment(driftResults, config);

      // Post comment
      if (process.env.GITHUB_TOKEN) {
        spinner.start("Posting PR comment...");
        await githubApp.postPRComment({
          owner,
          repo: repoName,
          prNumber: options.pr,
          body: comment,
          updateExisting: true,
        });
        spinner.succeed(chalk.green("PR comment posted"));
      }

      // Output results
      const output = formatOutput(driftResults, options.format);
      console.log("\n" + output);

      // Exit with appropriate code
      const threshold = config?.severity_threshold || "high";
      const shouldFail = shouldFailBasedOnThreshold(driftResults, threshold);
      process.exit(shouldFail ? 1 : 0);

    } catch (error) {
      spinner.fail(chalk.red("PR check failed"));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Init command
program
  .command("init")
  .description("Initialize ContractProof configuration")
  .option("-f, --force", "Overwrite existing configuration")
  .action((options) => {
    const configPath = ".contractproof.yml";

    if (fs.existsSync(configPath) && !options.force) {
      console.log(chalk.yellow("⚠️  Configuration file already exists. Use --force to overwrite."));
      process.exit(1);
    }

    const defaultConfig = `# ContractProof Configuration File
version: 1

severity_threshold: high

ignore_patterns:
  - "**/*.test.ts"
  - "**/*.test.js"
  - "**/node_modules/**"
  - "**/dist/**"

frameworks:
  backend: [express, nextjs]
  frontend: [react, axios]

notifications:
  slack:
    enabled: false
  discord:
    enabled: false

github:
  pr_comments: true
  status_checks: true
  file_annotations: true
`;

    fs.writeFileSync(configPath, defaultConfig);
    console.log(chalk.green(`✅ Created ${configPath}`));
    console.log(chalk.blue("\nNext steps:"));
    console.log("  1. Edit .contractproof.yml to customize settings");
    console.log("  2. Run 'contractproof analyze <repo-url>' to test");
    console.log("  3. Add .github/workflows/drift-check.yml for CI/CD");
  });

// Fix command
program
  .command("fix")
  .description("Auto-fix a specific drift issue")
  .argument("<finding-id>", "Finding ID to fix")
  .option("--dry-run", "Show what would be fixed without making changes")
  .action(async (findingId, options) => {
    const spinner = ora("Loading finding...").start();

    try {
      // Load previous analysis results
      const resultsPath = ".contractproof-cache/latest-results.json";
      
      if (!fs.existsSync(resultsPath)) {
        spinner.fail(chalk.red("No previous analysis found. Run 'contractproof analyze' first."));
        process.exit(1);
      }

      const results = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
      const finding = results.findings.find((f: any) => f.id === findingId);

      if (!finding) {
        spinner.fail(chalk.red(`Finding ${findingId} not found`));
        process.exit(1);
      }

      spinner.succeed(chalk.green("Finding loaded"));

      // Generate fix
      console.log(chalk.blue("\n📝 Suggested fix:"));
      console.log(chalk.gray("─".repeat(50)));
      
      if (finding.suggestion) {
        console.log(finding.suggestion);
      } else {
        console.log(chalk.yellow("No automatic fix available for this issue."));
        console.log(chalk.gray("\nManual intervention required:"));
        console.log(`  File: ${finding.file}`);
        console.log(`  Line: ${finding.line}`);
        console.log(`  Issue: ${finding.description}`);
      }

      console.log(chalk.gray("─".repeat(50)));

      if (options.dryRun) {
        console.log(chalk.yellow("\n🔍 Dry run mode - no changes made"));
      } else {
        console.log(chalk.yellow("\n⚠️  Auto-fix not yet implemented. Please apply changes manually."));
      }

    } catch (error) {
      spinner.fail(chalk.red("Fix failed"));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Notify command
program
  .command("notify")
  .description("Send notifications about analysis results")
  .argument("<channel>", "Notification channel (slack|discord|email)")
  .option("--webhook <url>", "Webhook URL")
  .option("--results <file>", "Path to analysis results JSON file")
  .option("--pr <number>", "Pull request number")
  .action(async (channel, options) => {
    const spinner = ora(`Sending ${channel} notification...`).start();

    try {
      // Load results
      const resultsPath = options.results || ".contractproof-cache/latest-results.json";
      
      if (!fs.existsSync(resultsPath)) {
        spinner.fail(chalk.red("Results file not found"));
        process.exit(1);
      }

      const results = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));

      // Initialize notification manager
      const notificationManager = new NotificationManager({
        slack: {
          enabled: channel === "slack",
          webhookUrl: options.webhook || process.env.SLACK_WEBHOOK_URL || "",
        },
        discord: {
          enabled: channel === "discord",
          webhookUrl: options.webhook || process.env.DISCORD_WEBHOOK_URL || "",
        },
      });

      // Send notification
      await notificationManager.sendNotification(results, {
        prNumber: options.pr ? parseInt(options.pr) : undefined,
        channel: channel as "slack" | "discord",
      });

      spinner.succeed(chalk.green(`${channel} notification sent`));

    } catch (error) {
      spinner.fail(chalk.red("Notification failed"));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Helper functions

function loadConfig(configPath?: string): any {
  const defaultPath = ".contractproof.yml";
  const path = configPath || defaultPath;

  if (!fs.existsSync(path)) {
    return null;
  }

  try {
    const content = fs.readFileSync(path, "utf-8");
    return yaml.load(content);
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Failed to load config from ${path}`));
    return null;
  }
}

function formatOutput(results: any, format: string): string {
  switch (format) {
    case "json":
      return JSON.stringify(results, null, 2);
    
    case "markdown":
      return formatMarkdown(results);
    
    case "text":
    default:
      return formatText(results);
  }
}

function formatMarkdown(results: any): string {
  let output = "# ContractProof Analysis Results\n\n";
  
  output += "## Summary\n\n";
  output += `- **Total Findings:** ${results.findings.length}\n`;
  output += `- **Critical:** ${results.findings.filter((f: any) => f.severity === "critical").length}\n`;
  output += `- **High:** ${results.findings.filter((f: any) => f.severity === "high").length}\n`;
  output += `- **Medium:** ${results.findings.filter((f: any) => f.severity === "medium").length}\n`;
  output += `- **Low:** ${results.findings.filter((f: any) => f.severity === "low").length}\n\n`;

  if (results.findings.length > 0) {
    output += "## Findings\n\n";
    
    results.findings.forEach((finding: any, idx: number) => {
      output += `### ${idx + 1}. ${finding.title}\n\n`;
      output += `- **Severity:** ${finding.severity}\n`;
      output += `- **Type:** ${finding.type}\n`;
      output += `- **Location:** \`${finding.file}:${finding.line}\`\n`;
      output += `- **Description:** ${finding.description}\n\n`;
      
      if (finding.suggestion) {
        output += `**💡 Suggestion:** ${finding.suggestion}\n\n`;
      }
      
      output += "---\n\n";
    });
  }

  return output;
}

function formatText(results: any): string {
  let output = chalk.bold.blue("ContractProof Analysis Results\n");
  output += chalk.gray("=".repeat(50)) + "\n\n";

  // Summary
  output += chalk.bold("Summary:\n");
  output += `  Total Findings: ${results.findings.length}\n`;
  output += `  ${chalk.red("Critical:")} ${results.findings.filter((f: any) => f.severity === "critical").length}\n`;
  output += `  ${chalk.yellow("High:")} ${results.findings.filter((f: any) => f.severity === "high").length}\n`;
  output += `  ${chalk.blue("Medium:")} ${results.findings.filter((f: any) => f.severity === "medium").length}\n`;
  output += `  ${chalk.gray("Low:")} ${results.findings.filter((f: any) => f.severity === "low").length}\n\n`;

  if (results.findings.length > 0) {
    output += chalk.bold("Findings:\n\n");
    
    results.findings.forEach((finding: any, idx: number) => {
      const severityColor = getSeverityColor(finding.severity);
      output += severityColor(`${idx + 1}. [${finding.severity.toUpperCase()}] ${finding.title}\n`);
      output += `   Location: ${chalk.cyan(finding.file)}:${finding.line}\n`;
      output += `   ${finding.description}\n`;
      
      if (finding.suggestion) {
        output += chalk.green(`   💡 ${finding.suggestion}\n`);
      }
      
      output += "\n";
    });
  }

  return output;
}

function getSeverityColor(severity: string): (text: string) => string {
  switch (severity) {
    case "critical":
      return chalk.red.bold;
    case "high":
      return chalk.red;
    case "medium":
      return chalk.yellow;
    case "low":
      return chalk.blue;
    default:
      return chalk.gray;
  }
}

function printSummary(results: any): void {
  console.log(chalk.bold("\n📊 Analysis Summary:"));
  console.log(chalk.gray("─".repeat(50)));
  
  const critical = results.findings.filter((f: any) => f.severity === "critical").length;
  const high = results.findings.filter((f: any) => f.severity === "high").length;
  const medium = results.findings.filter((f: any) => f.severity === "medium").length;
  const low = results.findings.filter((f: any) => f.severity === "low").length;

  if (critical > 0) console.log(chalk.red(`  🔴 ${critical} Critical issues`));
  if (high > 0) console.log(chalk.yellow(`  🟠 ${high} High severity issues`));
  if (medium > 0) console.log(chalk.blue(`  🟡 ${medium} Medium severity issues`));
  if (low > 0) console.log(chalk.gray(`  🔵 ${low} Low severity issues`));

  console.log(chalk.gray("─".repeat(50)));
}

function shouldFailBasedOnThreshold(results: any, threshold: string): boolean {
  const critical = results.findings.filter((f: any) => f.severity === "critical").length;
  const high = results.findings.filter((f: any) => f.severity === "high").length;
  const medium = results.findings.filter((f: any) => f.severity === "medium").length;
  const low = results.findings.filter((f: any) => f.severity === "low").length;

  switch (threshold) {
    case "critical":
      return critical > 0;
    case "high":
      return critical > 0 || high > 0;
    case "medium":
      return critical > 0 || high > 0 || medium > 0;
    case "low":
      return critical > 0 || high > 0 || medium > 0 || low > 0;
    default:
      return false;
  }
}

// Parse and execute
program.parse();

// Made with Bob

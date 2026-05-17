# CI/CD Integration Guide

Complete guide for integrating ContractProof into your development workflow with GitHub Actions, status checks, and notifications.

## Table of Contents

- [Quick Start](#quick-start)
- [GitHub Actions Setup](#github-actions-setup)
- [Configuration](#configuration)
- [GitHub App Setup](#github-app-setup)
- [CLI Usage](#cli-usage)
- [Notifications](#notifications)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## Quick Start

### 1. Install ContractProof

```bash
npm install -g contractproof
# or
yarn global add contractproof
```

### 2. Initialize Configuration

```bash
cd your-project
contractproof init
```

This creates a `.contractproof.yml` configuration file in your project root.

### 3. Add GitHub Action

Create `.github/workflows/drift-check.yml`:

```yaml
name: ContractProof Drift Check

on:
  pull_request:
    branches: [main, master, develop]
  push:
    branches: [main, master]

permissions:
  contents: read
  pull-requests: write
  checks: write
  statuses: write

jobs:
  drift-analysis:
    name: API Drift Analysis
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g contractproof
      - run: contractproof check --pr ${{ github.event.pull_request.number }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4. Test It

Create a pull request and watch ContractProof analyze your code!

## GitHub Actions Setup

### Full Workflow Configuration

The complete workflow includes caching, parallel execution, and comprehensive reporting:

```yaml
name: ContractProof Drift Check

on:
  pull_request:
    branches: [main, master, develop]
  push:
    branches: [main, master]
  workflow_dispatch:
    inputs:
      severity_threshold:
        description: 'Minimum severity to fail the check'
        required: false
        default: 'high'
        type: choice
        options:
          - critical
          - high
          - medium
          - low

permissions:
  contents: read
  pull-requests: write
  checks: write
  statuses: write

jobs:
  drift-analysis:
    name: API Drift Analysis
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Cache ContractProof analysis
        uses: actions/cache@v4
        with:
          path: |
            .contractproof-cache
            node_modules
          key: contractproof-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.ts', '**/*.js') }}

      - name: Install ContractProof
        run: npm install -g contractproof

      - name: Run Analysis
        id: analysis
        run: |
          contractproof check --pr ${{ github.event.pull_request.number }} --format json > results.json
          echo "results=$(cat results.json)" >> $GITHUB_OUTPUT
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: contractproof-analysis
          path: results.json
          retention-days: 30

      - name: Send Notifications
        if: always()
        run: |
          if [ -n "${{ secrets.SLACK_WEBHOOK_URL }}" ]; then
            contractproof notify slack --webhook "${{ secrets.SLACK_WEBHOOK_URL }}" --results results.json
          fi
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Workflow Triggers

#### Pull Request Trigger
```yaml
on:
  pull_request:
    branches: [main, develop]
    types: [opened, synchronize, reopened]
```

#### Push Trigger (Main Branch)
```yaml
on:
  push:
    branches: [main]
```

#### Scheduled Analysis
```yaml
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
```

#### Manual Trigger
```yaml
on:
  workflow_dispatch:
    inputs:
      severity_threshold:
        description: 'Severity threshold'
        required: false
        default: 'high'
```

## Configuration

### .contractproof.yml

Complete configuration file with all options:

```yaml
version: 1

# Severity threshold for blocking PRs/builds
# Options: critical, high, medium, low
severity_threshold: high

# Patterns to ignore during analysis
ignore_patterns:
  - "**/*.test.ts"
  - "**/*.test.js"
  - "**/node_modules/**"
  - "**/dist/**"
  - "**/build/**"

# Framework detection
frameworks:
  backend:
    - express
    - fastify
    - nestjs
    - nextjs
  frontend:
    - react
    - vue
    - axios
    - fetch

# Analysis configuration
analysis:
  enabled_analyzers:
    - backend
    - frontend
    - drift_detection
  max_file_size: 500  # KB
  parallel: true
  max_workers: 4
  cache_enabled: true
  cache_ttl: 3600

# Notification settings
notifications:
  slack:
    enabled: true
    webhook_url: ${SLACK_WEBHOOK_URL}
    channel: "#api-drift-alerts"
    mention_on_critical: true
    mention_users:
      - "@tech-lead"
  
  discord:
    enabled: false
    webhook_url: ${DISCORD_WEBHOOK_URL}
  
  email:
    enabled: false
    smtp_host: ${SMTP_HOST}
    smtp_port: 587
    from: "contractproof@example.com"
    to:
      - "team@example.com"

# GitHub integration
github:
  pr_comments: true
  status_checks: true
  file_annotations: true
  auto_label: true
  labels:
    critical: "⚠️ api-drift-critical"
    high: "🔴 api-drift-high"
    medium: "🟡 api-drift-medium"
    low: "🔵 api-drift-low"
    clean: "✅ no-drift"

# Auto-fix configuration
auto_fix:
  enabled: true
  fix_types:
    - missing_error_handling
    - inconsistent_status_codes
  auto_commit: false

# Reporting
reporting:
  format: json
  include_snippets: true
  detailed: true
  save_to_file: true
  output_path: ".contractproof-reports"
```

### Environment Variables

Required environment variables:

```bash
# GitHub Token (automatically provided in GitHub Actions)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# GitHub App (for advanced features)
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_INSTALLATION_ID=12345678

# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
SLACK_CHANNEL=#api-drift-alerts
SLACK_MENTION_ON_CRITICAL=true
SLACK_MENTION_USERS=@tech-lead,@dev-team

# Discord Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/yyy
DISCORD_MENTION_ON_CRITICAL=true
DISCORD_MENTION_ROLES=@developers

# Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
EMAIL_FROM=contractproof@example.com
EMAIL_TO=team@example.com,lead@example.com
```

## GitHub App Setup

For advanced features like file annotations and check runs, set up a GitHub App:

### 1. Create GitHub App

1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Click "New GitHub App"
3. Fill in the details:
   - **Name**: ContractProof
   - **Homepage URL**: https://github.com/contractproof/contractproof
   - **Webhook URL**: https://your-domain.com/webhook (optional)
   - **Webhook secret**: Generate a secure secret

### 2. Set Permissions

Required permissions:
- **Repository permissions**:
  - Contents: Read
  - Pull requests: Read & Write
  - Checks: Read & Write
  - Commit statuses: Read & Write
  - Issues: Read & Write (for labels)

- **Subscribe to events**:
  - Pull request
  - Push

### 3. Install App

1. Install the app on your repositories
2. Note the Installation ID from the URL
3. Generate and download the private key

### 4. Configure Secrets

Add these secrets to your repository:

```bash
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"
GITHUB_INSTALLATION_ID=12345678
```

## CLI Usage

### Commands

#### analyze
Analyze a repository for API drift:

```bash
# Analyze current directory
contractproof analyze .

# Analyze GitHub repository
contractproof analyze https://github.com/owner/repo

# Specify branch
contractproof analyze . --branch develop

# Output formats
contractproof analyze . --format json
contractproof analyze . --format markdown
contractproof analyze . --format text

# Save to file
contractproof analyze . --output report.json

# Custom config
contractproof analyze . --config custom-config.yml
```

#### check
Check a pull request:

```bash
# Check specific PR
contractproof check --pr 123

# Specify repository
contractproof check --pr 123 --repo owner/repo

# Different output format
contractproof check --pr 123 --format markdown
```

#### init
Initialize configuration:

```bash
# Create default config
contractproof init

# Force overwrite
contractproof init --force
```

#### fix
Auto-fix specific issues:

```bash
# Fix a specific finding
contractproof fix finding-id-123

# Dry run (preview changes)
contractproof fix finding-id-123 --dry-run
```

#### notify
Send notifications:

```bash
# Send Slack notification
contractproof notify slack \
  --webhook https://hooks.slack.com/services/xxx \
  --results results.json \
  --pr 123

# Send Discord notification
contractproof notify discord \
  --webhook https://discord.com/api/webhooks/xxx \
  --results results.json
```

### Exit Codes

- `0`: Success (no blocking issues)
- `1`: Failure (issues exceed threshold)
- `2`: Error (analysis failed)

## Notifications

### Slack Integration

#### Setup

1. Create a Slack App or Incoming Webhook
2. Add webhook URL to secrets: `SLACK_WEBHOOK_URL`
3. Configure in `.contractproof.yml`:

```yaml
notifications:
  slack:
    enabled: true
    webhook_url: ${SLACK_WEBHOOK_URL}
    channel: "#api-drift-alerts"
    mention_on_critical: true
    mention_users:
      - "@tech-lead"
      - "@senior-dev"
```

#### Message Format

Slack messages include:
- Summary of findings by severity
- Repository and PR information
- Direct link to PR
- Mentions for critical issues

### Discord Integration

#### Setup

1. Create a Discord webhook in your server
2. Add webhook URL to secrets: `DISCORD_WEBHOOK_URL`
3. Configure in `.contractproof.yml`:

```yaml
notifications:
  discord:
    enabled: true
    webhook_url: ${DISCORD_WEBHOOK_URL}
    mention_on_critical: true
    mention_roles:
      - "@developers"
```

### Email Integration

#### Setup

Configure SMTP settings:

```yaml
notifications:
  email:
    enabled: true
    smtp_host: smtp.gmail.com
    smtp_port: 587
    smtp_user: ${SMTP_USER}
    smtp_password: ${SMTP_PASSWORD}
    from: "contractproof@example.com"
    to:
      - "team@example.com"
      - "lead@example.com"
```

## Advanced Features

### Caching

Enable caching to speed up analysis:

```yaml
analysis:
  cache_enabled: true
  cache_ttl: 3600  # 1 hour
```

In GitHub Actions:

```yaml
- name: Cache Analysis
  uses: actions/cache@v4
  with:
    path: .contractproof-cache
    key: contractproof-${{ hashFiles('**/*.ts', '**/*.js') }}
```

### Parallel Execution

For large repositories:

```yaml
analysis:
  parallel: true
  max_workers: 4
```

### Custom Rules

Define custom drift detection rules:

```yaml
custom_rules:
  - name: "enforce_api_versioning"
    pattern: "/api/v\\d+/"
    severity: high
    message: "API endpoints should include version prefix"
  
  - name: "require_auth_middleware"
    pattern: "app\\.(get|post|put|delete)"
    severity: medium
    message: "Protected endpoints should use authentication"
```

### Auto-labeling

Automatically label PRs based on findings:

```yaml
github:
  auto_label: true
  labels:
    critical: "⚠️ api-drift-critical"
    high: "🔴 api-drift-high"
    medium: "🟡 api-drift-medium"
    low: "🔵 api-drift-low"
    clean: "✅ no-drift"
```

## Troubleshooting

### Common Issues

#### 1. "GitHub Token not found"

**Solution**: Ensure `GITHUB_TOKEN` is set:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 2. "Permission denied"

**Solution**: Add required permissions to workflow:

```yaml
permissions:
  contents: read
  pull-requests: write
  checks: write
```

#### 3. "Analysis timeout"

**Solution**: Increase timeout or enable caching:

```yaml
jobs:
  drift-analysis:
    timeout-minutes: 30
```

#### 4. "Too many annotations"

**Solution**: Limit annotations in config:

```yaml
github:
  file_annotations: true
  max_annotations: 50
```

### Debug Mode

Enable verbose logging:

```bash
DEBUG=contractproof:* contractproof analyze .
```

### Support

- 📖 [Documentation](https://github.com/contractproof/contractproof)
- 🐛 [Report Issues](https://github.com/contractproof/contractproof/issues)
- 💬 [Discussions](https://github.com/contractproof/contractproof/discussions)

## Examples

### Example 1: Basic Setup

Minimal configuration for small projects:

```yaml
# .contractproof.yml
version: 1
severity_threshold: high
ignore_patterns:
  - "**/*.test.ts"
  - "**/node_modules/**"
```

```yaml
# .github/workflows/drift-check.yml
name: Drift Check
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx contractproof check --pr ${{ github.event.pull_request.number }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Example 2: Enterprise Setup

Full-featured configuration for large teams:

```yaml
# .contractproof.yml
version: 1
severity_threshold: medium

ignore_patterns:
  - "**/*.test.ts"
  - "**/node_modules/**"
  - "**/dist/**"

frameworks:
  backend: [express, nestjs]
  frontend: [react, axios]

analysis:
  parallel: true
  max_workers: 8
  cache_enabled: true

notifications:
  slack:
    enabled: true
    webhook_url: ${SLACK_WEBHOOK_URL}
    mention_on_critical: true
  discord:
    enabled: true
    webhook_url: ${DISCORD_WEBHOOK_URL}

github:
  pr_comments: true
  status_checks: true
  file_annotations: true
  auto_label: true

reporting:
  format: json
  detailed: true
  save_to_file: true
```

### Example 3: Monorepo Setup

Configuration for monorepo with multiple services:

```yaml
# .contractproof.yml
version: 1
severity_threshold: high

ignore_patterns:
  - "**/node_modules/**"
  - "**/packages/*/dist/**"

analysis:
  parallel: true
  max_workers: 4
  
  # Analyze specific packages
  include_patterns:
    - "packages/api/**"
    - "packages/web/**"
    - "packages/mobile/**"

github:
  pr_comments: true
  status_checks: true
```

### Example 4: Scheduled Analysis

Weekly drift analysis:

```yaml
# .github/workflows/weekly-drift-check.yml
name: Weekly Drift Analysis

on:
  schedule:
    - cron: '0 0 * * 0'  # Every Sunday at midnight

jobs:
  analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx contractproof analyze .
      - run: npx contractproof notify slack --results results.json
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Best Practices

1. **Start with high threshold**: Begin with `severity_threshold: high` and adjust based on your needs
2. **Enable caching**: Significantly speeds up analysis for large codebases
3. **Use parallel execution**: For repositories with 100+ files
4. **Configure notifications**: Get alerted immediately for critical issues
5. **Review regularly**: Schedule weekly analysis to catch drift early
6. **Customize ignore patterns**: Exclude test files and generated code
7. **Use auto-labeling**: Helps prioritize PR reviews
8. **Enable file annotations**: Makes it easy to locate issues in code

## Migration Guide

### From Manual Reviews

1. Add ContractProof to one repository as a pilot
2. Run analysis on existing PRs to establish baseline
3. Adjust threshold based on results
4. Roll out to more repositories
5. Train team on interpreting results

### From Other Tools

ContractProof complements existing tools:
- **ESLint/TSLint**: Focus on code style, ContractProof on API contracts
- **SonarQube**: General code quality, ContractProof on API drift
- **Postman**: Manual API testing, ContractProof on automated detection

---

**Made with ❤️ by the ContractProof Team**

For more information, visit [github.com/contractproof/contractproof](https://github.com/contractproof/contractproof)
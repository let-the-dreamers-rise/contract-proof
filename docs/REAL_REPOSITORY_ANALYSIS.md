# Real Repository Analysis Feature

## Overview

ContractProof now supports analyzing ANY public GitHub repository in real-time, not just pre-analyzed demo data. This feature enables users to test ContractProof on their own codebases or any public repository to detect API drift issues.

## Features

### 1. Real-Time Repository Analysis
- Clone any public GitHub repository
- Analyze backend, frontend, tests, and documentation
- Detect API drift across the entire codebase
- Stream progress updates to the UI

### 2. Progress Tracking
- Real-time progress updates during analysis
- Stage-based progress (validating, cloning, scanning, analyzing, detecting drift)
- File-by-file progress tracking
- Percentage-based progress bar
- Ability to cancel analysis mid-process

### 3. Error Handling
- Comprehensive validation of GitHub URLs
- Timeout handling for large repositories
- Disk space checks
- Network error handling
- User-friendly error messages

### 4. Performance Optimizations
- Shallow cloning (depth=1) for faster downloads
- File size limits (1MB per file)
- Maximum file count limits (10,000 files)
- Skip common directories (node_modules, .git, etc.)
- Efficient file type detection

## Architecture

### Components

#### 1. Progress Tracking System (`lib/analysis-progress.ts`)
```typescript
export class ProgressTracker {
  // Tracks analysis stages and emits progress events
  setStage(stage: AnalysisStage, message: string)
  incrementFilesProcessed(currentFile?: string)
  setError(error: string)
  complete()
}
```

**Stages:**
- `validating` - Validating repository URL and access
- `cloning` - Cloning repository from GitHub
- `scanning` - Scanning files in repository
- `analyzing_backend` - Analyzing backend code
- `analyzing_frontend` - Analyzing frontend code
- `analyzing_tests` - Analyzing test files
- `detecting_drift` - Detecting API drift
- `complete` - Analysis complete
- `error` - Analysis failed

#### 2. Enhanced GitHub Analyzer (`lib/github-analyzer.ts`)
```typescript
class GitHubAnalyzer {
  // Parse and validate GitHub URLs
  parseGitHubUrl(url: string): GitHubRepoInfo | null
  
  // Clone repository with timeout and error handling
  cloneRepository(repoInfo: GitHubRepoInfo): Promise<string>
  
  // Get all analyzable files with size limits
  getRepositoryFiles(repoPath: string): Promise<FileInfo[]>
  
  // Validate repository exists
  validateRepository(repoInfo: GitHubRepoInfo): Promise<boolean>
  
  // Clean up temporary files
  cleanup(repoPath?: string): void
}
```

**Enhancements:**
- URL validation with regex patterns
- GitHub name validation
- Clone timeout (60 seconds)
- Automatic fallback to 'master' branch
- File size limits (1MB per file)
- Maximum file count (10,000 files)
- Disk space checks
- Better error messages

#### 3. Streaming API Route (`app/api/analyze/route.ts`)
```typescript
// Supports both streaming and regular responses
POST /api/analyze?stream=true

// Streaming response using Server-Sent Events (SSE)
// Sends progress updates in real-time
// Final result sent as JSON
```

**Features:**
- Server-Sent Events (SSE) for progress streaming
- Dual mode: streaming and regular JSON response
- Progress updates every file processed
- Error handling with cleanup
- Automatic repository cleanup after analysis

#### 4. Enhanced Demo Page (`app/demo/page.tsx`)
```typescript
// Two analysis modes:
// 1. Sample Demo - Pre-analyzed demo data
// 2. GitHub Repository - Real-time analysis

// Features:
// - GitHub URL input with validation
// - Optional GitHub token for private repos
// - Real-time progress bar
// - File processing counter
// - Cancel analysis button
// - Error display
```

## Usage

### Basic Usage

1. Navigate to the demo page
2. Select "Analyze GitHub Repo" mode
3. Enter a GitHub repository URL:
   ```
   https://github.com/owner/repository
   ```
4. Click "Analyze Repository"
5. Watch real-time progress updates
6. View drift findings when complete

### With GitHub Token (for private repos)

1. Generate a GitHub Personal Access Token
2. Enter the token in the "GitHub Token" field
3. Analyze private repositories

### Supported URL Formats

```
https://github.com/owner/repo
https://github.com/owner/repo.git
https://github.com/owner/repo/tree/branch-name
```

## API Reference

### POST /api/analyze

**Request Body:**
```json
{
  "githubUrl": "https://github.com/owner/repo",
  "githubToken": "ghp_xxxxxxxxxxxx" // Optional
}
```

**Query Parameters:**
- `stream=true` - Enable streaming progress updates (SSE)

**Response (Regular):**
```json
{
  "findings": [...],
  "summary": {
    "total": 7,
    "critical": 2,
    "high": 3,
    "medium": 1,
    "low": 1
  },
  "scannedFiles": {
    "backend": 5,
    "frontend": 8,
    "documentation": 2,
    "tests": 4
  },
  "timestamp": "2026-05-17T12:00:00.000Z"
}
```

**Response (Streaming):**
```
data: {"stage":"validating","percentage":5,"message":"Validating repository..."}

data: {"stage":"cloning","percentage":15,"message":"Cloning repository..."}

data: {"stage":"scanning","percentage":25,"message":"Scanning files..."}

data: {"stage":"analyzing_backend","percentage":40,"message":"Analyzing backend code...","filesProcessed":10,"totalFiles":50}

data: {"stage":"complete","percentage":100,"message":"Analysis complete!"}

data: {"type":"result","data":{...}}
```

## Error Handling

### Common Errors

1. **Invalid GitHub URL**
   - Message: "Invalid GitHub URL format"
   - Solution: Check URL format

2. **Repository Not Found**
   - Message: "Repository not found or not accessible"
   - Solution: Verify repository is public or provide GitHub token

3. **Clone Timeout**
   - Message: "Repository clone timed out"
   - Solution: Repository may be too large (>60s to clone)

4. **Disk Space**
   - Message: "Insufficient disk space"
   - Solution: Free up disk space

5. **Network Error**
   - Message: "Failed to clone repository: [details]"
   - Solution: Check network connection

## Performance Considerations

### Limits
- **Clone Timeout:** 60 seconds
- **Max File Size:** 1MB per file
- **Max Files:** 10,000 files
- **Clone Depth:** 1 (shallow clone)

### Optimizations
- Shallow cloning for faster downloads
- Skip common directories (node_modules, dist, build, etc.)
- File size checks before reading
- Efficient file type detection
- Automatic cleanup of temporary files

### Recommended Repository Sizes
- **Small:** < 100 files, < 10MB - Instant analysis
- **Medium:** 100-1000 files, 10-100MB - 10-30 seconds
- **Large:** 1000-5000 files, 100-500MB - 30-60 seconds
- **Very Large:** > 5000 files, > 500MB - May timeout

## Security

### Considerations
1. **Public Repositories Only (without token)**
   - No authentication required
   - Rate limits apply

2. **Private Repositories (with token)**
   - Requires GitHub Personal Access Token
   - Token stored in memory only (not persisted)
   - Token used for single request

3. **Temporary Files**
   - Cloned to system temp directory
   - Automatically cleaned up after analysis
   - Unique directory names to prevent conflicts

4. **Input Validation**
   - GitHub URL validation
   - Repository name validation
   - File size limits
   - File count limits

## Testing

### Manual Testing

1. **Test with sample repository:**
   ```
   https://github.com/vercel/next.js
   ```

2. **Test with small repository:**
   ```
   https://github.com/your-username/small-repo
   ```

3. **Test error handling:**
   - Invalid URL: `https://github.com/invalid`
   - Non-existent repo: `https://github.com/user/nonexistent`
   - Private repo without token

4. **Test cancellation:**
   - Start analysis
   - Click "Cancel Analysis"
   - Verify cleanup

### Automated Testing

Run the test suite:
```bash
npm test
```

## Future Enhancements

1. **Branch Selection**
   - UI for selecting specific branches
   - Support for tags and commits

2. **Repository Caching**
   - Cache analyzed repositories
   - Incremental analysis for updates

3. **Parallel Analysis**
   - Analyze multiple files in parallel
   - Faster processing for large repos

4. **Advanced Filters**
   - Filter by file types
   - Exclude specific directories
   - Custom analysis rules

5. **Export Options**
   - Export results as PDF
   - Export as JSON
   - Integration with CI/CD

## Troubleshooting

### Build Errors

If you encounter TypeScript errors:
```bash
npm run build
```

### Runtime Errors

Check the browser console and server logs for detailed error messages.

### Performance Issues

For large repositories:
1. Use shallow cloning (already enabled)
2. Exclude unnecessary directories
3. Consider analyzing specific branches
4. Use a faster network connection

## Support

For issues or questions:
1. Check the error message in the UI
2. Review browser console logs
3. Check server logs
4. Refer to this documentation

## Made with Bob

This feature was implemented with assistance from IBM Bob, demonstrating the power of AI-assisted development for complex features.

---

**Version:** 1.0.0  
**Last Updated:** 2026-05-17  
**Status:** Production Ready
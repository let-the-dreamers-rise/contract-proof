// Frontend API call analyzer for fetch, axios, React Query

import { ApiEndpoint, HttpMethod, CodeLocation } from "../types";

export class FrontendAnalyzer {
  /**
   * Analyze frontend files for API calls
   */
  analyzeFile(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];

    if (
      filePath.endsWith(".js") ||
      filePath.endsWith(".ts") ||
      filePath.endsWith(".jsx") ||
      filePath.endsWith(".tsx")
    ) {
      // Fetch API calls
      endpoints.push(...this.analyzeFetch(content, filePath));

      // Axios calls
      endpoints.push(...this.analyzeAxios(content, filePath));

      // React Query
      endpoints.push(...this.analyzeReactQuery(content, filePath));
    }

    return endpoints;
  }

  /**
   * Analyze fetch() API calls
   * Patterns: fetch('/api/...'), fetch(url, { method: 'POST' })
   */
  private analyzeFetch(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = content.split("\n");

    // Pattern 1: fetch('url')
    const simplePattern = /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    // Pattern 2: fetch(url, { method: 'POST' })
    const methodPattern = /fetch\s*\([^,]+,\s*\{[^}]*method\s*:\s*['"`]([^'"`]+)['"`]/g;

    lines.forEach((line, index) => {
      // Simple fetch calls (default GET)
      const simpleMatches = [...line.matchAll(simplePattern)];
      simpleMatches.forEach((match) => {
        const path = this.extractPath(match[1]);
        if (this.isApiPath(path)) {
          endpoints.push({
            path: this.normalizePath(path),
            method: "GET",
            location: {
              file: filePath,
              line: index + 1,
              code: line.trim(),
              context: this.getContext(lines, index),
            },
            type: "frontend",
            framework: "fetch",
          });
        }
      });

      // Fetch with explicit method
      const methodMatches = [...line.matchAll(methodPattern)];
      methodMatches.forEach((match) => {
        const method = match[1].toUpperCase() as HttpMethod;
        // Look for URL in the same or nearby lines
        const urlMatch = line.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/);
        if (urlMatch) {
          const path = this.extractPath(urlMatch[1]);
          if (this.isApiPath(path)) {
            endpoints.push({
              path: this.normalizePath(path),
              method,
              location: {
                file: filePath,
                line: index + 1,
                code: line.trim(),
                context: this.getContext(lines, index),
              },
              type: "frontend",
              framework: "fetch",
            });
          }
        }
      });
    });

    return endpoints;
  }

  /**
   * Analyze axios API calls
   * Patterns: axios.get(), axios.post(), axios({ method, url })
   */
  private analyzeAxios(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = content.split("\n");

    // Pattern 1: axios.get('/api/...')
    const methodPattern = /axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    // Pattern 2: axios({ method: 'GET', url: '/api/...' })
    const configPattern = /axios\s*\(\s*\{[^}]*url\s*:\s*['"`]([^'"`]+)['"`][^}]*method\s*:\s*['"`]([^'"`]+)['"`]/g;

    lines.forEach((line, index) => {
      // Method-based calls
      const methodMatches = [...line.matchAll(methodPattern)];
      methodMatches.forEach((match) => {
        const method = match[1].toUpperCase() as HttpMethod;
        const path = this.extractPath(match[2]);
        
        if (this.isApiPath(path)) {
          endpoints.push({
            path: this.normalizePath(path),
            method,
            location: {
              file: filePath,
              line: index + 1,
              code: line.trim(),
              context: this.getContext(lines, index),
            },
            type: "frontend",
            framework: "axios",
          });
        }
      });

      // Config-based calls
      const configMatches = [...line.matchAll(configPattern)];
      configMatches.forEach((match) => {
        const path = this.extractPath(match[1]);
        const method = match[2].toUpperCase() as HttpMethod;
        
        if (this.isApiPath(path)) {
          endpoints.push({
            path: this.normalizePath(path),
            method,
            location: {
              file: filePath,
              line: index + 1,
              code: line.trim(),
              context: this.getContext(lines, index),
            },
            type: "frontend",
            framework: "axios",
          });
        }
      });
    });

    return endpoints;
  }

  /**
   * Analyze React Query hooks
   * Patterns: useQuery(), useMutation()
   */
  private analyzeReactQuery(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = content.split("\n");

    // useQuery with fetch/axios inside
    const queryPattern = /useQuery\s*\(/g;
    const mutationPattern = /useMutation\s*\(/g;

    lines.forEach((line, index) => {
      if (queryPattern.test(line) || mutationPattern.test(line)) {
        // Look for fetch/axios in the query function
        const context = this.getContext(lines, index, 5);
        const contextStr = context.join("\n");

        // Extract API calls from the query function
        const fetchMatches = [...contextStr.matchAll(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g)];
        const axiosMatches = [...contextStr.matchAll(/axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g)];

        fetchMatches.forEach((match) => {
          const path = this.extractPath(match[1]);
          if (this.isApiPath(path)) {
            endpoints.push({
              path: this.normalizePath(path),
              method: mutationPattern.test(line) ? "POST" : "GET",
              location: {
                file: filePath,
                line: index + 1,
                code: line.trim(),
                context,
              },
              type: "frontend",
              framework: "react-query",
            });
          }
        });

        axiosMatches.forEach((match) => {
          const method = match[1].toUpperCase() as HttpMethod;
          const path = this.extractPath(match[2]);
          if (this.isApiPath(path)) {
            endpoints.push({
              path: this.normalizePath(path),
              method,
              location: {
                file: filePath,
                line: index + 1,
                code: line.trim(),
                context,
              },
              type: "frontend",
              framework: "react-query",
            });
          }
        });
      }
    });

    return endpoints;
  }

  /**
   * Extract clean path from URL (remove template literals, variables)
   */
  private extractPath(url: string): string {
    // Remove base URL if present
    url = url.replace(/^https?:\/\/[^/]+/, "");
    
    // Handle template literals: `/api/users/${id}` -> `/api/users/:id`
    url = url.replace(/\$\{[^}]+\}/g, ":param");
    
    // Handle string concatenation: '/api/users/' + id -> '/api/users/:param'
    url = url.replace(/['"`]\s*\+\s*[^'"`+]+\s*\+?\s*['"`]?/g, ":param");
    
    // Remove query strings for now
    url = url.split("?")[0];
    
    return url;
  }

  /**
   * Check if path looks like an API endpoint
   */
  private isApiPath(path: string): boolean {
    return (
      path.startsWith("/api/") ||
      path.startsWith("/v1/") ||
      path.startsWith("/v2/") ||
      path.includes("/api/")
    );
  }

  /**
   * Normalize path format
   */
  private normalizePath(path: string): string {
    // Ensure leading slash
    if (!path.startsWith("/")) {
      path = "/" + path;
    }
    
    // Remove trailing slash
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    
    return path;
  }

  /**
   * Get surrounding lines for context
   */
  private getContext(lines: string[], index: number, contextLines: number = 2): string[] {
    const start = Math.max(0, index - contextLines);
    const end = Math.min(lines.length, index + contextLines + 1);
    return lines.slice(start, end);
  }
}

// Made with Bob

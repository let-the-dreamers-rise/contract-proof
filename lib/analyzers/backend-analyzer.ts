// Backend API route analyzer for Express, FastAPI, Flask, Next.js

import { ApiEndpoint, HttpMethod, CodeLocation } from "../types";

export class BackendAnalyzer {
  /**
   * Analyze backend files for API routes
   */
  analyzeFile(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];

    // Detect framework
    if (filePath.endsWith(".js") || filePath.endsWith(".ts")) {
      // Express.js patterns
      endpoints.push(...this.analyzeExpress(content, filePath));
      
      // Next.js API routes
      if (filePath.includes("/api/")) {
        endpoints.push(...this.analyzeNextJS(content, filePath));
      }
    } else if (filePath.endsWith(".py")) {
      // FastAPI patterns
      endpoints.push(...this.analyzeFastAPI(content, filePath));
      
      // Flask patterns
      endpoints.push(...this.analyzeFlask(content, filePath));
    }

    return endpoints;
  }

  /**
   * Analyze Express.js routes
   * Patterns: app.get(), app.post(), router.get(), etc.
   */
  private analyzeExpress(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = content.split("\n");

    // Regex patterns for Express routes
    const patterns = [
      /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /(?:app|router)\.route\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.(get|post|put|delete|patch)/g,
    ];

    lines.forEach((line, index) => {
      patterns.forEach((pattern) => {
        const matches = [...line.matchAll(pattern)];
        matches.forEach((match) => {
          const method = (match[1] || match[2]).toUpperCase() as HttpMethod;
          const path = match[2] || match[1];

          endpoints.push({
            path: this.normalizePath(path),
            method,
            location: {
              file: filePath,
              line: index + 1,
              code: line.trim(),
              context: this.getContext(lines, index),
            },
            type: "backend",
            framework: "express",
            params: this.extractPathParams(path),
          });
        });
      });
    });

    return endpoints;
  }

  /**
   * Analyze Next.js API routes
   * Patterns: export async function GET(), export function POST(), etc.
   */
  private analyzeNextJS(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = content.split("\n");

    // Extract route path from file path
    // e.g., /api/users/[id]/route.ts -> /api/users/:id
    const routePath = this.extractNextJSRoutePath(filePath);

    // Find exported HTTP method functions
    const methodPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/g;

    lines.forEach((line, index) => {
      const matches = [...line.matchAll(methodPattern)];
      matches.forEach((match) => {
        const method = match[1] as HttpMethod;

        endpoints.push({
          path: routePath,
          method,
          location: {
            file: filePath,
            line: index + 1,
            code: line.trim(),
            context: this.getContext(lines, index),
          },
          type: "backend",
          framework: "nextjs",
          params: this.extractPathParams(routePath),
        });
      });
    });

    return endpoints;
  }

  /**
   * Analyze FastAPI routes
   * Patterns: @app.get(), @router.post(), etc.
   */
  private analyzeFastAPI(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = content.split("\n");

    const pattern = /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;

    lines.forEach((line, index) => {
      const matches = [...line.matchAll(pattern)];
      matches.forEach((match) => {
        const method = match[1].toUpperCase() as HttpMethod;
        const path = match[2];

        endpoints.push({
          path: this.normalizePath(path),
          method,
          location: {
            file: filePath,
            line: index + 1,
            code: line.trim(),
            context: this.getContext(lines, index),
          },
          type: "backend",
          framework: "fastapi",
          params: this.extractPathParams(path),
        });
      });
    });

    return endpoints;
  }

  /**
   * Analyze Flask routes
   * Patterns: @app.route(), @bp.route()
   */
  private analyzeFlask(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = content.split("\n");

    const routePattern = /@(?:app|bp|blueprint)\.route\s*\(\s*['"`]([^'"`]+)['"`](?:.*methods\s*=\s*\[([^\]]+)\])?/g;

    lines.forEach((line, index) => {
      const matches = [...line.matchAll(routePattern)];
      matches.forEach((match) => {
        const path = match[1];
        const methodsStr = match[2];
        
        // Parse methods or default to GET
        const methods = methodsStr
          ? methodsStr.split(",").map((m) => m.trim().replace(/['"]/g, "").toUpperCase() as HttpMethod)
          : ["GET" as HttpMethod];

        methods.forEach((method) => {
          endpoints.push({
            path: this.normalizePath(path),
            method,
            location: {
              file: filePath,
              line: index + 1,
              code: line.trim(),
              context: this.getContext(lines, index),
            },
            type: "backend",
            framework: "flask",
            params: this.extractPathParams(path),
          });
        });
      });
    });

    return endpoints;
  }

  /**
   * Extract Next.js route path from file path
   */
  private extractNextJSRoutePath(filePath: string): string {
    // Convert file path to route path
    // e.g., app/api/users/[id]/route.ts -> /api/users/:id
    let routePath = filePath
      .replace(/\\/g, "/")
      .replace(/.*\/app/, "")
      .replace(/\/route\.(ts|js)$/, "")
      .replace(/\[([^\]]+)\]/g, ":$1"); // Convert [id] to :id

    return routePath || "/";
  }

  /**
   * Normalize API path (convert different param formats to :param)
   */
  private normalizePath(path: string): string {
    return path
      .replace(/<([^>]+)>/g, ":$1") // Flask <param> -> :param
      .replace(/\{([^}]+)\}/g, ":$1") // FastAPI {param} -> :param
      .replace(/\[([^\]]+)\]/g, ":$1"); // Next.js [param] -> :param
  }

  /**
   * Extract path parameters from route
   */
  private extractPathParams(path: string): string[] {
    const params: string[] = [];
    const pattern = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;

    while ((match = pattern.exec(path)) !== null) {
      params.push(match[1]);
    }

    return params;
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

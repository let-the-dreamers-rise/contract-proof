// Real backend analyzer using AST parsing for JavaScript/TypeScript and Python

import { ApiEndpoint, HttpMethod, CodeLocation } from "../types";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";

export class RealBackendAnalyzer {
  /**
   * Analyze backend file for API routes
   */
  analyzeFile(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];

    try {
      if (filePath.endsWith(".js") || filePath.endsWith(".ts")) {
        endpoints.push(...this.analyzeJavaScript(content, filePath));
      } else if (filePath.endsWith(".py")) {
        endpoints.push(...this.analyzePython(content, filePath));
      }
    } catch (error) {
      console.error(`Error analyzing ${filePath}:`, error);
    }

    return endpoints;
  }

  /**
   * Analyze JavaScript/TypeScript files using Babel parser
   */
  private analyzeJavaScript(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];

    try {
      // Parse with Babel
      const ast = parser.parse(content, {
        sourceType: "module",
        plugins: [
          "typescript",
          "jsx",
          "decorators-legacy",
          "classProperties",
          "objectRestSpread",
          "asyncGenerators",
          "dynamicImport",
        ],
      });

      const lines = content.split("\n");

      // Traverse AST to find route definitions
      traverse(ast, {
        // Express: app.get(), router.post(), etc.
        CallExpression: (path) => {
          const node = path.node;

          // Check for route method calls
          if (
            node.callee.type === "MemberExpression" &&
            node.callee.property.type === "Identifier"
          ) {
            const object = node.callee.object;
            const method = node.callee.property.name;

            // Check if it's a route method (get, post, put, delete, patch)
            const routeMethods = ["get", "post", "put", "delete", "patch"];
            if (routeMethods.includes(method.toLowerCase())) {
              // Check if object is app or router
              const isRouter =
                (object.type === "Identifier" &&
                  (object.name === "app" ||
                    object.name === "router" ||
                    object.name === "api")) ||
                (object.type === "MemberExpression" &&
                  object.property.type === "Identifier" &&
                  object.property.name === "route");

              if (isRouter && node.arguments.length > 0) {
                const firstArg = node.arguments[0];

                // Extract route path
                let routePath: string | null = null;
                if (firstArg.type === "StringLiteral") {
                  routePath = firstArg.value;
                } else if (firstArg.type === "TemplateLiteral") {
                  routePath = this.extractTemplateString(firstArg);
                }

                if (routePath) {
                  const location = node.loc;
                  const lineNumber = location ? location.start.line : 0;
                  const code = lines[lineNumber - 1]?.trim() || "";

                  endpoints.push({
                    path: this.normalizePath(routePath),
                    method: method.toUpperCase() as HttpMethod,
                    location: {
                      file: filePath,
                      line: lineNumber,
                      code,
                      context: this.getContext(lines, lineNumber - 1),
                    },
                    type: "backend",
                    framework: "express",
                    params: this.extractPathParams(routePath),
                    queryParams: this.extractQueryParams(node, content),
                    bodySchema: this.extractBodySchema(node, content),
                  });
                }
              }
            }
          }

          // Next.js API routes: export function GET(), POST(), etc.
          if (
            node.callee.type === "Identifier" &&
            node.callee.name === "export"
          ) {
            // This is handled by ExportNamedDeclaration
          }
        },

        // Next.js: export async function GET() {}
        ExportNamedDeclaration: (path) => {
          const node = path.node;
          if (node.declaration && node.declaration.type === "FunctionDeclaration") {
            const funcName = node.declaration.id?.name;
            const httpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

            if (funcName && httpMethods.includes(funcName)) {
              const routePath = this.extractNextJSRoutePath(filePath);
              const location = node.loc;
              const lineNumber = location ? location.start.line : 0;
              const code = lines[lineNumber - 1]?.trim() || "";

              endpoints.push({
                path: routePath,
                method: funcName as HttpMethod,
                location: {
                  file: filePath,
                  line: lineNumber,
                  code,
                  context: this.getContext(lines, lineNumber - 1),
                },
                type: "backend",
                framework: "nextjs",
                params: this.extractPathParams(routePath),
              });
            }
          }
        },
      });
    } catch (error) {
      console.error(`Failed to parse JavaScript file ${filePath}:`, error);
    }

    return endpoints;
  }

  /**
   * Analyze Python files for FastAPI and Flask routes
   */
  private analyzePython(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = content.split("\n");

    // FastAPI patterns: @app.get(), @router.post()
    const fastapiPattern = /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
    
    // Flask patterns: @app.route(), @bp.route()
    const flaskRoutePattern = /@(?:app|bp|blueprint)\.route\s*\(\s*["']([^"']+)["'](?:.*methods\s*=\s*\[([^\]]+)\])?/g;

    lines.forEach((line, index) => {
      // FastAPI
      const fastapiMatches = [...line.matchAll(fastapiPattern)];
      fastapiMatches.forEach((match) => {
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

      // Flask
      const flaskMatches = [...line.matchAll(flaskRoutePattern)];
      flaskMatches.forEach((match) => {
        const path = match[1];
        const methodsStr = match[2];

        // Parse methods or default to GET
        const methods = methodsStr
          ? methodsStr.split(",").map((m) => m.trim().replace(/["']/g, "").toUpperCase() as HttpMethod)
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
   * Extract template string value
   */
  private extractTemplateString(node: any): string {
    if (node.quasis && node.quasis.length > 0) {
      return node.quasis.map((q: any) => q.value.raw).join(":param");
    }
    return "";
  }

  /**
   * Extract Next.js route path from file path
   */
  private extractNextJSRoutePath(filePath: string): string {
    let routePath = filePath
      .replace(/\\/g, "/")
      .replace(/.*\/app/, "")
      .replace(/\/route\.(ts|js)$/, "")
      .replace(/\[([^\]]+)\]/g, ":$1");

    return routePath || "/";
  }

  /**
   * Normalize API path
   */
  private normalizePath(path: string): string {
    return path
      .replace(/<([^>]+)>/g, ":$1") // Flask <param> -> :param
      .replace(/\{([^}]+)\}/g, ":$1") // FastAPI {param} -> :param
      .replace(/\[([^\]]+)\]/g, ":$1"); // Next.js [param] -> :param
  }

  /**
   * Extract path parameters
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
   * Extract query parameters from route handler
   */
  private extractQueryParams(node: any, content: string): string[] {
    const queryParams: string[] = [];

    try {
      // Look for req.query usage in the handler function
      const handlerArg = node.arguments[1];
      if (handlerArg && handlerArg.type === "ArrowFunctionExpression") {
        const bodyStr = content.substring(
          handlerArg.body.start,
          handlerArg.body.end
        );

        // Find req.query.paramName patterns
        const queryPattern = /req\.query\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
        let match;
        while ((match = queryPattern.exec(bodyStr)) !== null) {
          if (!queryParams.includes(match[1])) {
            queryParams.push(match[1]);
          }
        }

        // Find destructured query params: const { param1, param2 } = req.query
        const destructurePattern = /const\s*\{\s*([^}]+)\}\s*=\s*req\.query/g;
        const destructureMatch = destructurePattern.exec(bodyStr);
        if (destructureMatch) {
          const params = destructureMatch[1]
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p);
          queryParams.push(...params);
        }
      }
    } catch (error) {
      // Ignore errors in query param extraction
    }

    return queryParams;
  }

  /**
   * Extract body schema from route handler
   */
  private extractBodySchema(node: any, content: string): Record<string, any> | undefined {
    try {
      const handlerArg = node.arguments[1];
      if (handlerArg && handlerArg.type === "ArrowFunctionExpression") {
        const bodyStr = content.substring(
          handlerArg.body.start,
          handlerArg.body.end
        );

        // Find req.body usage
        const bodyPattern = /req\.body\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
        const fields: string[] = [];
        let match;
        while ((match = bodyPattern.exec(bodyStr)) !== null) {
          if (!fields.includes(match[1])) {
            fields.push(match[1]);
          }
        }

        // Find destructured body params
        const destructurePattern = /const\s*\{\s*([^}]+)\}\s*=\s*req\.body/g;
        const destructureMatch = destructurePattern.exec(bodyStr);
        if (destructureMatch) {
          const params = destructureMatch[1]
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p);
          fields.push(...params);
        }

        if (fields.length > 0) {
          const schema: Record<string, any> = {};
          fields.forEach((field) => {
            schema[field] = "any";
          });
          return schema;
        }
      }
    } catch (error) {
      // Ignore errors in body schema extraction
    }

    return undefined;
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
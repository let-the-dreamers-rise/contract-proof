// Real frontend analyzer using AST parsing for API calls

import { ApiEndpoint, HttpMethod, CodeLocation } from "../types";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";

export class RealFrontendAnalyzer {
  /**
   * Analyze frontend file for API calls
   */
  analyzeFile(content: string, filePath: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];

    try {
      if (
        filePath.endsWith(".js") ||
        filePath.endsWith(".ts") ||
        filePath.endsWith(".jsx") ||
        filePath.endsWith(".tsx")
      ) {
        endpoints.push(...this.analyzeJavaScript(content, filePath));
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

      traverse(ast, {
        // Fetch API calls
        CallExpression: (path) => {
          const node = path.node;

          // fetch() calls
          if (
            node.callee.type === "Identifier" &&
            node.callee.name === "fetch" &&
            node.arguments.length > 0
          ) {
            const endpoint = this.extractFetchCall(node, lines, filePath);
            if (endpoint) {
              endpoints.push(endpoint);
            }
          }

          // axios calls: axios.get(), axios.post(), etc.
          if (
            node.callee.type === "MemberExpression" &&
            node.callee.object.type === "Identifier" &&
            node.callee.object.name === "axios" &&
            node.callee.property.type === "Identifier"
          ) {
            const endpoint = this.extractAxiosCall(node, lines, filePath);
            if (endpoint) {
              endpoints.push(endpoint);
            }
          }

          // axios({ method, url }) config style
          if (
            node.callee.type === "Identifier" &&
            node.callee.name === "axios" &&
            node.arguments.length > 0 &&
            node.arguments[0].type === "ObjectExpression"
          ) {
            const endpoint = this.extractAxiosConfigCall(node, lines, filePath);
            if (endpoint) {
              endpoints.push(endpoint);
            }
          }

          // React Query: useQuery, useMutation
          if (
            node.callee.type === "Identifier" &&
            (node.callee.name === "useQuery" || node.callee.name === "useMutation")
          ) {
            const queryEndpoints = this.extractReactQueryCall(
              node,
              lines,
              filePath,
              content
            );
            endpoints.push(...queryEndpoints);
          }

          // superagent: request.get(), request.post()
          if (
            node.callee.type === "MemberExpression" &&
            node.callee.object.type === "Identifier" &&
            node.callee.object.name === "request" &&
            node.callee.property.type === "Identifier"
          ) {
            const endpoint = this.extractSuperagentCall(node, lines, filePath);
            if (endpoint) {
              endpoints.push(endpoint);
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
   * Extract fetch() API call
   */
  private extractFetchCall(
    node: any,
    lines: string[],
    filePath: string
  ): ApiEndpoint | null {
    try {
      const firstArg = node.arguments[0];
      let url: string | null = null;
      let method: HttpMethod = "GET";

      // Extract URL
      if (firstArg.type === "StringLiteral") {
        url = firstArg.value;
      } else if (firstArg.type === "TemplateLiteral") {
        url = this.extractTemplateString(firstArg);
      }

      // Extract method from options object
      if (node.arguments.length > 1 && node.arguments[1].type === "ObjectExpression") {
        const options = node.arguments[1];
        const methodProp = options.properties.find(
          (p: any) =>
            p.key &&
            p.key.type === "Identifier" &&
            p.key.name === "method"
        );

        if (methodProp && methodProp.value.type === "StringLiteral") {
          method = methodProp.value.value.toUpperCase() as HttpMethod;
        }
      }

      if (url && this.isApiPath(url)) {
        const location = node.loc;
        const lineNumber = location ? location.start.line : 0;

        return {
          path: this.normalizePath(url),
          method,
          location: {
            file: filePath,
            line: lineNumber,
            code: lines[lineNumber - 1]?.trim() || "",
            context: this.getContext(lines, lineNumber - 1),
          },
          type: "frontend",
          framework: "fetch",
        };
      }
    } catch (error) {
      // Ignore extraction errors
    }

    return null;
  }

  /**
   * Extract axios method call (axios.get, axios.post, etc.)
   */
  private extractAxiosCall(
    node: any,
    lines: string[],
    filePath: string
  ): ApiEndpoint | null {
    try {
      const method = node.callee.property.name.toUpperCase() as HttpMethod;
      const httpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

      if (!httpMethods.includes(method)) {
        return null;
      }

      if (node.arguments.length === 0) {
        return null;
      }

      const firstArg = node.arguments[0];
      let url: string | null = null;

      if (firstArg.type === "StringLiteral") {
        url = firstArg.value;
      } else if (firstArg.type === "TemplateLiteral") {
        url = this.extractTemplateString(firstArg);
      }

      if (url && this.isApiPath(url)) {
        const location = node.loc;
        const lineNumber = location ? location.start.line : 0;

        return {
          path: this.normalizePath(url),
          method,
          location: {
            file: filePath,
            line: lineNumber,
            code: lines[lineNumber - 1]?.trim() || "",
            context: this.getContext(lines, lineNumber - 1),
          },
          type: "frontend",
          framework: "axios",
        };
      }
    } catch (error) {
      // Ignore extraction errors
    }

    return null;
  }

  /**
   * Extract axios config call: axios({ method, url })
   */
  private extractAxiosConfigCall(
    node: any,
    lines: string[],
    filePath: string
  ): ApiEndpoint | null {
    try {
      const config = node.arguments[0];
      let url: string | null = null;
      let method: HttpMethod = "GET";

      config.properties.forEach((prop: any) => {
        if (prop.key && prop.key.type === "Identifier") {
          if (prop.key.name === "url") {
            if (prop.value.type === "StringLiteral") {
              url = prop.value.value;
            } else if (prop.value.type === "TemplateLiteral") {
              url = this.extractTemplateString(prop.value);
            }
          } else if (prop.key.name === "method") {
            if (prop.value.type === "StringLiteral") {
              method = prop.value.value.toUpperCase() as HttpMethod;
            }
          }
        }
      });

      if (url && this.isApiPath(url)) {
        const location = node.loc;
        const lineNumber = location ? location.start.line : 0;

        return {
          path: this.normalizePath(url),
          method,
          location: {
            file: filePath,
            line: lineNumber,
            code: lines[lineNumber - 1]?.trim() || "",
            context: this.getContext(lines, lineNumber - 1),
          },
          type: "frontend",
          framework: "axios",
        };
      }
    } catch (error) {
      // Ignore extraction errors
    }

    return null;
  }

  /**
   * Extract React Query calls
   */
  private extractReactQueryCall(
    node: any,
    lines: string[],
    filePath: string,
    content: string
  ): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];

    try {
      const isQuery = node.callee.name === "useQuery";
      const location = node.loc;
      const lineNumber = location ? location.start.line : 0;

      // Get the query function body
      let queryFn = null;
      if (node.arguments.length > 0) {
        // useQuery can have different signatures
        const arg = node.arguments[0];
        if (arg.type === "ObjectExpression") {
          // useQuery({ queryKey, queryFn })
          const queryFnProp = arg.properties.find(
            (p: any) => p.key && p.key.name === "queryFn"
          );
          if (queryFnProp) {
            queryFn = queryFnProp.value;
          }
        } else if (node.arguments.length > 1) {
          // useQuery(key, queryFn)
          queryFn = node.arguments[1];
        }
      }

      if (queryFn) {
        // Extract the function body
        const start = queryFn.start;
        const end = queryFn.end;
        const fnBody = content.substring(start, end);

        // Look for fetch/axios calls in the function body
        const fetchMatches = [
          ...fnBody.matchAll(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g),
        ];
        const axiosMatches = [
          ...fnBody.matchAll(/axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g),
        ];

        fetchMatches.forEach((match) => {
          const url = match[1];
          if (this.isApiPath(url)) {
            endpoints.push({
              path: this.normalizePath(url),
              method: isQuery ? "GET" : "POST",
              location: {
                file: filePath,
                line: lineNumber,
                code: lines[lineNumber - 1]?.trim() || "",
                context: this.getContext(lines, lineNumber - 1),
              },
              type: "frontend",
              framework: "react-query",
            });
          }
        });

        axiosMatches.forEach((match) => {
          const method = match[1].toUpperCase() as HttpMethod;
          const url = match[2];
          if (this.isApiPath(url)) {
            endpoints.push({
              path: this.normalizePath(url),
              method,
              location: {
                file: filePath,
                line: lineNumber,
                code: lines[lineNumber - 1]?.trim() || "",
                context: this.getContext(lines, lineNumber - 1),
              },
              type: "frontend",
              framework: "react-query",
            });
          }
        });
      }
    } catch (error) {
      // Ignore extraction errors
    }

    return endpoints;
  }

  /**
   * Extract superagent call
   */
  private extractSuperagentCall(
    node: any,
    lines: string[],
    filePath: string
  ): ApiEndpoint | null {
    try {
      const method = node.callee.property.name.toUpperCase() as HttpMethod;
      const httpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];

      if (!httpMethods.includes(method)) {
        return null;
      }

      if (node.arguments.length === 0) {
        return null;
      }

      const firstArg = node.arguments[0];
      let url: string | null = null;

      if (firstArg.type === "StringLiteral") {
        url = firstArg.value;
      } else if (firstArg.type === "TemplateLiteral") {
        url = this.extractTemplateString(firstArg);
      }

      if (url && this.isApiPath(url)) {
        const location = node.loc;
        const lineNumber = location ? location.start.line : 0;

        return {
          path: this.normalizePath(url),
          method,
          location: {
            file: filePath,
            line: lineNumber,
            code: lines[lineNumber - 1]?.trim() || "",
            context: this.getContext(lines, lineNumber - 1),
          },
          type: "frontend",
          framework: "superagent",
        };
      }
    } catch (error) {
      // Ignore extraction errors
    }

    return null;
  }

  /**
   * Extract template string value
   */
  private extractTemplateString(node: any): string {
    if (node.quasis && node.quasis.length > 0) {
      // Build path with :param placeholders for expressions
      let path = "";
      for (let i = 0; i < node.quasis.length; i++) {
        path += node.quasis[i].value.raw;
        if (i < node.expressions.length) {
          path += ":param";
        }
      }
      return path;
    }
    return "";
  }

  /**
   * Check if path looks like an API endpoint
   */
  private isApiPath(path: string): boolean {
    return (
      path.startsWith("/api/") ||
      path.startsWith("/v1/") ||
      path.startsWith("/v2/") ||
      path.includes("/api/") ||
      path.startsWith("api/")
    );
  }

  /**
   * Normalize path format
   */
  private normalizePath(path: string): string {
    // Remove base URL if present
    path = path.replace(/^https?:\/\/[^/]+/, "");

    // Ensure leading slash
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    // Remove trailing slash
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    // Remove query strings
    path = path.split("?")[0];

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
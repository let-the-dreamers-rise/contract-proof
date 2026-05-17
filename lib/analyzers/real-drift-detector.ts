// Real drift detector - compares actual parsed endpoints

import { ApiEndpoint, DriftFinding, Severity } from "../types";

export class RealDriftDetector {
  /**
   * Detect drift between backend and other sources
   */
  detectDrift(
    backend: ApiEndpoint[],
    frontend: ApiEndpoint[],
    documentation: ApiEndpoint[],
    tests: ApiEndpoint[]
  ): DriftFinding[] {
    const findings: DriftFinding[] = [];

    // 1. Check for orphaned frontend calls (no matching backend)
    findings.push(...this.detectOrphanedCalls(frontend, backend));

    // 2. Check for method mismatches
    findings.push(...this.detectMethodMismatches(backend, frontend));

    // 3. Check for parameter mismatches
    findings.push(...this.detectParameterMismatches(backend, frontend));

    // 4. Check for missing documentation
    findings.push(...this.detectMissingDocumentation(backend, documentation));

    // 5. Check for missing tests
    findings.push(...this.detectMissingTests(backend, tests));

    // 6. Check for unused backend routes
    findings.push(...this.detectUnusedRoutes(backend, frontend, tests));

    return findings;
  }

  /**
   * Detect frontend calls to non-existent backend routes
   */
  private detectOrphanedCalls(
    frontend: ApiEndpoint[],
    backend: ApiEndpoint[]
  ): DriftFinding[] {
    const findings: DriftFinding[] = [];

    frontend.forEach((frontendEndpoint) => {
      const matchingBackend = backend.find(
        (b) =>
          this.pathsMatch(b.path, frontendEndpoint.path) &&
          b.method === frontendEndpoint.method
      );

      if (!matchingBackend) {
        findings.push({
          id: `orphaned-${frontendEndpoint.method}-${this.sanitizePath(frontendEndpoint.path)}`,
          severity: "critical",
          title: `Orphaned API Call: ${frontendEndpoint.method} ${frontendEndpoint.path}`,
          description: `Frontend calls ${frontendEndpoint.method} ${frontendEndpoint.path}, but no matching backend route exists. This will cause 404 errors in production.`,
          impact: `All requests to this endpoint will fail with 404 Not Found errors. This breaks functionality that depends on this API call.`,
          frontend: [frontendEndpoint],
          suggestedFix: {
            description: "Either add the backend route or remove the frontend call",
            beforeCode: this.generateCodeSnippet(frontendEndpoint),
            afterCode: `// Option 1: Add backend route\nrouter.${frontendEndpoint.method.toLowerCase()}('${frontendEndpoint.path}', handler)\n\n// Option 2: Remove this call if no longer needed`,
            files: [frontendEndpoint.location.file],
          },
          regressionTest: {
            description: "Add test to verify endpoint exists",
            code: `test('${frontendEndpoint.method} ${frontendEndpoint.path} endpoint exists', async () => {
  const response = await request(app).${frontendEndpoint.method.toLowerCase()}('${frontendEndpoint.path}');
  expect(response.status).not.toBe(404);
});`,
            framework: "jest",
          },
          bobPrompt: this.generateBobPrompt(
            "Orphaned API Call",
            undefined,
            frontendEndpoint,
            `Frontend is calling ${frontendEndpoint.method} ${frontendEndpoint.path}, but this endpoint doesn't exist in the backend.`
          ),
        });
      }
    });

    return findings;
  }

  /**
   * Detect HTTP method mismatches
   */
  private detectMethodMismatches(
    backend: ApiEndpoint[],
    frontend: ApiEndpoint[]
  ): DriftFinding[] {
    const findings: DriftFinding[] = [];

    // Group by path
    const backendByPath = this.groupByPath(backend);
    const frontendByPath = this.groupByPath(frontend);

    backendByPath.forEach((backendEndpoints, path) => {
      const frontendEndpoints = this.findMatchingEndpoints(
        frontendByPath,
        path
      );

      if (frontendEndpoints.length > 0) {
        const backendMethods = new Set(backendEndpoints.map((e) => e.method));
        const frontendMethods = new Set(frontendEndpoints.map((e) => e.method));

        // Find methods used in frontend but not supported by backend
        frontendMethods.forEach((method) => {
          if (!backendMethods.has(method)) {
            const frontendEndpoint = frontendEndpoints.find(
              (e) => e.method === method
            )!;
            const backendEndpoint = backendEndpoints[0];

            findings.push({
              id: `method-mismatch-${method}-${this.sanitizePath(path)}`,
              severity: "high",
              title: `HTTP Method Mismatch: ${method} not supported on ${path}`,
              description: `Frontend calls ${method} ${path}, but backend only supports ${[...backendMethods].join(", ")}`,
              impact: "API calls will fail with 405 Method Not Allowed errors. This breaks functionality that depends on this endpoint.",
              backend: backendEndpoint,
              frontend: [frontendEndpoint],
              suggestedFix: {
                description: `Update frontend to use ${[...backendMethods][0]} method or add ${method} support to backend`,
                beforeCode: this.generateCodeSnippet(frontendEndpoint),
                afterCode: `// Option 1: Update frontend\n${this.generateCodeSnippet({ ...frontendEndpoint, method: [...backendMethods][0] })}\n\n// Option 2: Add backend support\nrouter.${method.toLowerCase()}('${path}', handler)`,
                files: [frontendEndpoint.location.file, backendEndpoint.location.file],
              },
              regressionTest: {
                description: "Add test to verify HTTP method support",
                code: `test('${path} supports ${method}', async () => {
  const response = await request(app).${method.toLowerCase()}('${path}');
  expect(response.status).not.toBe(405);
});`,
                framework: "jest",
              },
              bobPrompt: this.generateBobPrompt(
                "HTTP Method Mismatch",
                backendEndpoint,
                frontendEndpoint,
                `Frontend is calling ${method} but backend only supports ${[...backendMethods].join(", ")}`
              ),
            });
          }
        });
      }
    });

    return findings;
  }

  /**
   * Detect parameter mismatches
   */
  private detectParameterMismatches(
    backend: ApiEndpoint[],
    frontend: ApiEndpoint[]
  ): DriftFinding[] {
    const findings: DriftFinding[] = [];

    backend.forEach((backendEndpoint) => {
      const matchingFrontend = frontend.filter(
        (f) =>
          this.pathsMatch(f.path, backendEndpoint.path) &&
          f.method === backendEndpoint.method
      );

      if (matchingFrontend.length > 0) {
        // Check for missing required parameters
        if (backendEndpoint.queryParams && backendEndpoint.queryParams.length > 0) {
          const frontendEndpoint = matchingFrontend[0];
          const frontendParams = frontendEndpoint.queryParams || [];
          const missingParams = backendEndpoint.queryParams.filter(
            (p) => !frontendParams.includes(p)
          );

          if (missingParams.length > 0) {
            findings.push({
              id: `missing-params-${this.sanitizePath(backendEndpoint.path)}`,
              severity: "medium",
              title: `Missing Required Parameters: ${missingParams.join(", ")} in ${backendEndpoint.path}`,
              description: `Backend requires query parameters [${backendEndpoint.queryParams.join(", ")}], but frontend only sends [${frontendParams.join(", ") || "none"}]`,
              impact: "API calls may fail with 400 Bad Request errors if these parameters are required.",
              backend: backendEndpoint,
              frontend: matchingFrontend,
              suggestedFix: {
                description: `Add missing parameters: ${missingParams.join(", ")}`,
                beforeCode: this.generateCodeSnippet(frontendEndpoint),
                afterCode: this.generateCodeSnippetWithParams(
                  frontendEndpoint,
                  missingParams
                ),
                files: matchingFrontend.map((f) => f.location.file),
              },
              regressionTest: {
                description: "Add test to verify required parameters",
                code: `test('${backendEndpoint.method} ${backendEndpoint.path} requires parameters', async () => {
  const response = await request(app)
    .${backendEndpoint.method.toLowerCase()}('${backendEndpoint.path}?${backendEndpoint.queryParams.map(p => `${p}=test`).join("&")}');
  expect(response.status).toBe(200);
});`,
                framework: "jest",
              },
              bobPrompt: this.generateBobPrompt(
                "Missing Required Parameters",
                backendEndpoint,
                frontendEndpoint,
                `Backend requires parameters [${backendEndpoint.queryParams.join(", ")}] but frontend doesn't send [${missingParams.join(", ")}]`
              ),
            });
          }
        }
      }
    });

    return findings;
  }

  /**
   * Detect missing documentation
   */
  private detectMissingDocumentation(
    backend: ApiEndpoint[],
    documentation: ApiEndpoint[]
  ): DriftFinding[] {
    const findings: DriftFinding[] = [];
    const documentedPaths = new Set(documentation.map((d) => d.path));

    backend.forEach((backendEndpoint) => {
      const isDocumented = documentation.some(
        (d) =>
          this.pathsMatch(d.path, backendEndpoint.path) &&
          d.method === backendEndpoint.method
      );

      if (!isDocumented) {
        findings.push({
          id: `missing-docs-${this.sanitizePath(backendEndpoint.path)}`,
          severity: "low",
          title: `Missing Documentation: ${backendEndpoint.method} ${backendEndpoint.path}`,
          description: `Backend route ${backendEndpoint.method} ${backendEndpoint.path} is not documented`,
          impact: "Developers may not know this endpoint exists or how to use it correctly. This can lead to incorrect usage or duplicated effort.",
          backend: backendEndpoint,
          suggestedFix: {
            description: "Add API documentation",
            beforeCode: "# API Documentation\n\n(No documentation for this endpoint)",
            afterCode: `# API Documentation\n\n## ${backendEndpoint.method} ${backendEndpoint.path}\n\nDescription: [Add description]\n\nParameters: ${backendEndpoint.params?.join(", ") || "None"}\nQuery Params: ${backendEndpoint.queryParams?.join(", ") || "None"}`,
            files: ["docs/API.md"],
          },
          bobPrompt: this.generateBobPrompt(
            "Missing Documentation",
            backendEndpoint,
            undefined,
            "This endpoint needs documentation"
          ),
        });
      }
    });

    return findings;
  }

  /**
   * Detect missing tests
   */
  private detectMissingTests(
    backend: ApiEndpoint[],
    tests: ApiEndpoint[]
  ): DriftFinding[] {
    const findings: DriftFinding[] = [];

    backend.forEach((backendEndpoint) => {
      const hasTe = tests.some(
        (t) =>
          this.pathsMatch(t.path, backendEndpoint.path) &&
          t.method === backendEndpoint.method
      );

      if (!tests) {
        findings.push({
          id: `missing-tests-${this.sanitizePath(backendEndpoint.path)}`,
          severity: "medium",
          title: `Missing Tests: ${backendEndpoint.method} ${backendEndpoint.path}`,
          description: `Backend route ${backendEndpoint.method} ${backendEndpoint.path} has no test coverage`,
          impact: "Changes to this endpoint may break functionality without detection. This increases the risk of bugs in production.",
          backend: backendEndpoint,
          suggestedFix: {
            description: "Add integration test",
            beforeCode: "// No tests for this endpoint",
            afterCode: `describe('${backendEndpoint.method} ${backendEndpoint.path}', () => {
  it('should return 200 OK', async () => {
    const response = await request(app).${backendEndpoint.method.toLowerCase()}('${backendEndpoint.path}');
    expect(response.status).toBe(200);
  });
});`,
            files: [`tests/${backendEndpoint.path.split("/")[2]}.test.js`],
          },
          regressionTest: {
            description: "Add comprehensive test suite",
            code: `describe('${backendEndpoint.method} ${backendEndpoint.path}', () => {
  it('should handle valid requests', async () => {
    const response = await request(app).${backendEndpoint.method.toLowerCase()}('${backendEndpoint.path}');
    expect(response.status).toBe(200);
  });
});`,
            framework: "jest",
          },
          bobPrompt: this.generateBobPrompt(
            "Missing Tests",
            backendEndpoint,
            undefined,
            "This endpoint needs test coverage"
          ),
        });
      }
    });

    return findings;
  }

  /**
   * Detect unused backend routes
   */
  private detectUnusedRoutes(
    backend: ApiEndpoint[],
    frontend: ApiEndpoint[],
    tests: ApiEndpoint[]
  ): DriftFinding[] {
    const findings: DriftFinding[] = [];

    backend.forEach((backendEndpoint) => {
      const usedInFrontend = frontend.some(
        (f) =>
          this.pathsMatch(f.path, backendEndpoint.path) &&
          f.method === backendEndpoint.method
      );

      const usedInTests = tests.some(
        (t) =>
          this.pathsMatch(t.path, backendEndpoint.path) &&
          t.method === backendEndpoint.method
      );

      if (!usedInFrontend && !usedInTests) {
        findings.push({
          id: `unused-route-${this.sanitizePath(backendEndpoint.path)}`,
          severity: "low",
          title: `Potentially Unused Route: ${backendEndpoint.method} ${backendEndpoint.path}`,
          description: `Backend route ${backendEndpoint.method} ${backendEndpoint.path} is not called by frontend or tested`,
          impact: "This route may be dead code that can be removed, or it may be a new feature that needs frontend integration.",
          backend: backendEndpoint,
          suggestedFix: {
            description: "Either remove the route or add frontend integration",
            beforeCode: this.generateCodeSnippet(backendEndpoint),
            afterCode: "// Option 1: Remove if truly unused\n// Option 2: Add frontend integration if this is a new feature",
            files: [backendEndpoint.location.file],
          },
          bobPrompt: this.generateBobPrompt(
            "Potentially Unused Route",
            backendEndpoint,
            undefined,
            "This route is not used by frontend or tests. Verify if it should be removed or if frontend integration is needed."
          ),
        });
      }
    });

    return findings;
  }

  /**
   * Check if two paths match (accounting for parameters)
   */
  private pathsMatch(path1: string, path2: string): boolean {
    const normalize = (p: string) =>
      p
        .toLowerCase()
        .replace(/:[^/]+/g, ":param")
        .replace(/\/+$/, "");

    return normalize(path1) === normalize(path2);
  }

  /**
   * Group endpoints by path
   */
  private groupByPath(endpoints: ApiEndpoint[]): Map<string, ApiEndpoint[]> {
    const map = new Map<string, ApiEndpoint[]>();

    endpoints.forEach((endpoint) => {
      const normalized = this.normalizePath(endpoint.path);
      const existing = map.get(normalized) || [];
      existing.push(endpoint);
      map.set(normalized, existing);
    });

    return map;
  }

  /**
   * Find matching endpoints by path
   */
  private findMatchingEndpoints(
    map: Map<string, ApiEndpoint[]>,
    path: string
  ): ApiEndpoint[] {
    const normalized = this.normalizePath(path);
    return map.get(normalized) || [];
  }

  /**
   * Normalize path for comparison
   */
  private normalizePath(path: string): string {
    return path.toLowerCase().replace(/:[^/]+/g, ":param").replace(/\/+$/, "");
  }

  /**
   * Sanitize path for use in IDs
   */
  private sanitizePath(path: string): string {
    return path.replace(/[^a-zA-Z0-9]/g, "-");
  }

  /**
   * Generate code snippet for endpoint
   */
  private generateCodeSnippet(endpoint: ApiEndpoint): string {
    const framework = endpoint.framework || "fetch";

    if (framework === "axios") {
      return `axios.${endpoint.method.toLowerCase()}('${endpoint.path}')`;
    } else if (framework === "fetch") {
      if (endpoint.method === "GET") {
        return `fetch('${endpoint.path}')`;
      } else {
        return `fetch('${endpoint.path}', { method: '${endpoint.method}' })`;
      }
    } else if (framework === "express") {
      return `router.${endpoint.method.toLowerCase()}('${endpoint.path}', handler)`;
    }

    return endpoint.location.code;
  }

  /**
   * Generate code snippet with additional parameters
   */
  private generateCodeSnippetWithParams(
    endpoint: ApiEndpoint,
    params: string[]
  ): string {
    const framework = endpoint.framework || "fetch";
    const queryString = params.map((p) => `${p}=\${${p}}`).join("&");

    if (framework === "axios") {
      return `axios.${endpoint.method.toLowerCase()}('${endpoint.path}?${queryString}')`;
    } else if (framework === "fetch") {
      return `fetch('${endpoint.path}?${queryString}')`;
    }

    return endpoint.location.code;
  }

  /**
   * Generate Bob-ready prompt
   */
  private generateBobPrompt(
    issueType: string,
    backend?: ApiEndpoint,
    frontend?: ApiEndpoint,
    explanation?: string
  ): string {
    let prompt = `# API Drift Detected: ${issueType}\n\n`;
    prompt += `${explanation}\n\n`;

    if (backend) {
      prompt += `## Backend Route\n`;
      prompt += `File: ${backend.location.file}:${backend.location.line}\n`;
      prompt += `Route: ${backend.method} ${backend.path}\n`;
      prompt += `Framework: ${backend.framework}\n`;
      if (backend.params && backend.params.length > 0) {
        prompt += `Path Params: ${backend.params.join(", ")}\n`;
      }
      if (backend.queryParams && backend.queryParams.length > 0) {
        prompt += `Query Params: ${backend.queryParams.join(", ")}\n`;
      }
      prompt += `\`\`\`\n${backend.location.code}\n\`\`\`\n\n`;
    }

    if (frontend) {
      prompt += `## Frontend Call\n`;
      prompt += `File: ${frontend.location.file}:${frontend.location.line}\n`;
      prompt += `Call: ${frontend.method} ${frontend.path}\n`;
      prompt += `Framework: ${frontend.framework}\n`;
      prompt += `\`\`\`\n${frontend.location.code}\n\`\`\`\n\n`;
    }

    prompt += `## Task\n`;
    prompt += `Please analyze the full repository context and fix this API drift issue. `;
    prompt += `Ensure all related files (backend, frontend, docs, tests) are updated consistently.\n`;

    return prompt;
  }

  /**
   * Mark findings that can be auto-fixed by Bob
   */
  markBobFixableFindings(findings: DriftFinding[]): DriftFinding[] {
    return findings.map((finding) => {
      // Determine if this finding can be auto-fixed
      const canAutoFix = this.canBobAutoFix(finding);
      
      return {
        ...finding,
        bobFixStatus: canAutoFix ? "pending" : undefined,
      };
    });
  }

  /**
   * Check if a finding can be auto-fixed by Bob
   */
  private canBobAutoFix(finding: DriftFinding): boolean {
    // Critical issues should always be reviewed manually
    if (finding.severity === "critical") {
      return false;
    }

    // Need at least backend or frontend context
    const hasContext = !!finding.backend || (!!finding.frontend && finding.frontend.length > 0);
    
    return hasContext;
  }
}

// Made with Bob
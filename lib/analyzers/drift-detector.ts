// Drift detection engine - compares endpoints across backend, frontend, docs, tests

import { ApiEndpoint, DriftFinding, Severity } from "../types";

export class DriftDetector {
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

    // Group backend endpoints by path
    const backendMap = this.groupByPath(backend);

    // Check each backend endpoint for drift
    backendMap.forEach((backendEndpoints, path) => {
      const frontendCalls = frontend.filter((e) => this.pathsMatch(e.path, path));
      const docRefs = documentation.filter((e) => this.pathsMatch(e.path, path));
      const testCalls = tests.filter((e) => this.pathsMatch(e.path, path));

      // Scenario 1: Backend route exists but frontend uses old path
      const pathDrift = this.detectPathDrift(backendEndpoints, frontendCalls, docRefs, testCalls);
      if (pathDrift) findings.push(pathDrift);

      // Scenario 2: HTTP method mismatch
      const methodDrift = this.detectMethodDrift(backendEndpoints, frontendCalls);
      if (methodDrift) findings.push(methodDrift);

      // Scenario 3: Documentation outdated
      const docDrift = this.detectDocumentationDrift(backendEndpoints, docRefs);
      if (docDrift) findings.push(docDrift);

      // Scenario 4: Tests missing or outdated
      const testDrift = this.detectTestDrift(backendEndpoints, testCalls);
      if (testDrift) findings.push(testDrift);
    });

    // Scenario 5: Frontend calls non-existent backend routes
    const orphanedCalls = this.detectOrphanedCalls(frontend, backend);
    findings.push(...orphanedCalls);

    return findings;
  }

  /**
   * Detect path drift (route renamed but calls not updated)
   */
  private detectPathDrift(
    backend: ApiEndpoint[],
    frontend: ApiEndpoint[],
    docs: ApiEndpoint[],
    tests: ApiEndpoint[]
  ): DriftFinding | null {
    // This is a simplified check - in reality, we'd use more sophisticated matching
    // For now, we'll detect this in the sample repo analysis
    return null;
  }

  /**
   * Detect HTTP method mismatches
   */
  private detectMethodDrift(
    backend: ApiEndpoint[],
    frontend: ApiEndpoint[]
  ): DriftFinding | null {
    if (backend.length === 0 || frontend.length === 0) return null;

    const backendMethods = new Set(backend.map((e) => e.method));
    const frontendMethods = new Set(frontend.map((e) => e.method));

    // Find methods used in frontend but not supported by backend
    const unsupportedMethods = [...frontendMethods].filter((m) => !backendMethods.has(m));

    if (unsupportedMethods.length > 0) {
      const backendEndpoint = backend[0];
      const frontendEndpoint = frontend.find((e) => unsupportedMethods.includes(e.method))!;

      return {
        id: `method-mismatch-${backendEndpoint.path}`,
        severity: "high",
        title: `HTTP Method Mismatch: ${frontendEndpoint.method} not supported`,
        description: `Frontend calls ${frontendEndpoint.method} ${frontendEndpoint.path}, but backend only supports ${[...backendMethods].join(", ")}`,
        impact: "API calls will fail with 405 Method Not Allowed errors in production",
        backend: backendEndpoint,
        frontend: [frontendEndpoint],
        suggestedFix: {
          description: `Update frontend to use ${[...backendMethods][0]} method`,
          beforeCode: `${frontendEndpoint.framework}.${frontendEndpoint.method.toLowerCase()}('${frontendEndpoint.path}')`,
          afterCode: `${frontendEndpoint.framework}.${[...backendMethods][0].toLowerCase()}('${frontendEndpoint.path}')`,
          files: [frontendEndpoint.location.file],
        },
        regressionTest: {
          description: "Add test to verify HTTP method support",
          code: `test('${backendEndpoint.path} supports ${[...backendMethods][0]}', async () => {
  const response = await request(app).${[...backendMethods][0].toLowerCase()}('${backendEndpoint.path}');
  expect(response.status).not.toBe(405);
});`,
          framework: "jest",
        },
        bobPrompt: this.generateBobPrompt(
          "HTTP Method Mismatch",
          backendEndpoint,
          frontendEndpoint,
          `The frontend is calling ${frontendEndpoint.method} but the backend only supports ${[...backendMethods].join(", ")}`
        ),
      };
    }

    return null;
  }

  /**
   * Detect documentation drift
   */
  private detectDocumentationDrift(
    backend: ApiEndpoint[],
    docs: ApiEndpoint[]
  ): DriftFinding | null {
    if (backend.length === 0) return null;

    // If no docs found, that's a finding
    if (docs.length === 0) {
      const backendEndpoint = backend[0];
      return {
        id: `missing-docs-${backendEndpoint.path}`,
        severity: "low",
        title: `Missing Documentation: ${backendEndpoint.path}`,
        description: `Backend route ${backendEndpoint.method} ${backendEndpoint.path} is not documented`,
        impact: "Developers may not know this endpoint exists or how to use it correctly",
        backend: backendEndpoint,
        suggestedFix: {
          description: "Add API documentation",
          beforeCode: "# API Documentation\n\n(No documentation for this endpoint)",
          afterCode: `# API Documentation\n\n## ${backendEndpoint.method} ${backendEndpoint.path}\n\nDescription: [Add description]\n\nParameters: ${backendEndpoint.params?.join(", ") || "None"}`,
          files: ["docs/API.md"],
        },
        bobPrompt: this.generateBobPrompt(
          "Missing Documentation",
          backendEndpoint,
          undefined,
          "This endpoint needs documentation"
        ),
      };
    }

    return null;
  }

  /**
   * Detect test drift
   */
  private detectTestDrift(
    backend: ApiEndpoint[],
    tests: ApiEndpoint[]
  ): DriftFinding | null {
    if (backend.length === 0) return null;

    // If no tests found, that's a finding
    if (tests.length === 0) {
      const backendEndpoint = backend[0];
      return {
        id: `missing-tests-${backendEndpoint.path}`,
        severity: "medium",
        title: `Missing Tests: ${backendEndpoint.path}`,
        description: `Backend route ${backendEndpoint.method} ${backendEndpoint.path} has no test coverage`,
        impact: "Changes to this endpoint may break functionality without detection",
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
  
  it('should handle invalid requests', async () => {
    const response = await request(app).${backendEndpoint.method.toLowerCase()}('${backendEndpoint.path}/invalid');
    expect(response.status).toBe(404);
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
      };
    }

    return null;
  }

  /**
   * Detect frontend calls to non-existent backend routes
   */
  private detectOrphanedCalls(
    frontend: ApiEndpoint[],
    backend: ApiEndpoint[]
  ): DriftFinding[] {
    const findings: DriftFinding[] = [];
    const backendPaths = new Set(backend.map((e) => e.path));

    frontend.forEach((frontendEndpoint) => {
      // Check if this frontend call has a matching backend route
      const hasBackend = backend.some(
        (b) => this.pathsMatch(b.path, frontendEndpoint.path) && b.method === frontendEndpoint.method
      );

      if (!hasBackend) {
        findings.push({
          id: `orphaned-call-${frontendEndpoint.path}`,
          severity: "critical",
          title: `Orphaned API Call: ${frontendEndpoint.method} ${frontendEndpoint.path}`,
          description: `Frontend calls ${frontendEndpoint.method} ${frontendEndpoint.path}, but no matching backend route exists`,
          impact: "This will cause 404 errors in production, breaking functionality",
          frontend: [frontendEndpoint],
          suggestedFix: {
            description: "Either add the backend route or remove the frontend call",
            beforeCode: `${frontendEndpoint.framework}.${frontendEndpoint.method.toLowerCase()}('${frontendEndpoint.path}')`,
            afterCode: `// Option 1: Add backend route\napp.${frontendEndpoint.method.toLowerCase()}('${frontendEndpoint.path}', handler)\n\n// Option 2: Remove this call if no longer needed`,
            files: [frontendEndpoint.location.file],
          },
          regressionTest: {
            description: "Add test to verify endpoint exists",
            code: `test('${frontendEndpoint.path} endpoint exists', async () => {
  const response = await request(app).${frontendEndpoint.method.toLowerCase()}('${frontendEndpoint.path}');
  expect(response.status).not.toBe(404);
});`,
            framework: "jest",
          },
          bobPrompt: this.generateBobPrompt(
            "Orphaned API Call",
            undefined,
            frontendEndpoint,
            "Frontend is calling an endpoint that doesn't exist in the backend"
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
    // Normalize paths
    const normalize = (p: string) =>
      p
        .toLowerCase()
        .replace(/:[^/]+/g, ":param") // Normalize all params to :param
        .replace(/\/+$/, ""); // Remove trailing slashes

    return normalize(path1) === normalize(path2);
  }

  /**
   * Group endpoints by path
   */
  private groupByPath(endpoints: ApiEndpoint[]): Map<string, ApiEndpoint[]> {
    const map = new Map<string, ApiEndpoint[]>();

    endpoints.forEach((endpoint) => {
      const existing = map.get(endpoint.path) || [];
      existing.push(endpoint);
      map.set(endpoint.path, existing);
    });

    return map;
  }

  /**
   * Generate Bob-ready prompt with full context
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
}

// Made with Bob

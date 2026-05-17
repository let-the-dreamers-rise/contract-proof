// OpenAPI/Swagger spec validator - detects drift between spec and implementation

import { DriftFinding, ApiEndpoint, Severity } from "../types";
import { SpecEndpoint, ParsedSpec, Parameter } from "../openapi-parser";

export type SpecViolationType = 
  | 'missing-in-spec'
  | 'missing-in-implementation'
  | 'parameter-mismatch'
  | 'schema-mismatch'
  | 'deprecated-in-use';

export interface SpecDriftFinding extends DriftFinding {
  specViolationType: SpecViolationType;
  specEndpoint?: SpecEndpoint;
  actualEndpoint?: ApiEndpoint;
  complianceImpact: number; // 0-100, how much this affects compliance score
}

export interface SpecValidationResult {
  findings: SpecDriftFinding[];
  complianceScore: number; // 0-100
  summary: {
    total: number;
    missingInSpec: number;
    missingInImplementation: number;
    parameterMismatches: number;
    schemaMismatches: number;
    deprecatedInUse: number;
  };
  specInfo: {
    title: string;
    version: string;
    totalEndpoints: number;
  };
}

export class OpenAPIValidator {
  /**
   * Validate OpenAPI spec against actual backend implementation
   */
  async validate(
    spec: ParsedSpec,
    specEndpoints: SpecEndpoint[],
    actualEndpoints: ApiEndpoint[]
  ): Promise<SpecValidationResult> {
    const findings: SpecDriftFinding[] = [];

    // 1. Detect undocumented endpoints (missing in spec)
    findings.push(...this.detectUndocumentedEndpoints(specEndpoints, actualEndpoints));

    // 2. Detect missing implementations (promised in spec but not implemented)
    findings.push(...this.detectMissingEndpoints(specEndpoints, actualEndpoints));

    // 3. Validate parameters
    findings.push(...this.validateParameters(specEndpoints, actualEndpoints));

    // 4. Validate schemas (basic validation)
    findings.push(...this.validateSchemas(specEndpoints, actualEndpoints));

    // 5. Check for deprecated endpoints still in use
    findings.push(...this.checkDeprecations(specEndpoints, actualEndpoints));

    // Calculate compliance score
    const complianceScore = this.calculateComplianceScore(findings, specEndpoints.length, actualEndpoints.length);

    return {
      findings,
      complianceScore,
      summary: {
        total: findings.length,
        missingInSpec: findings.filter(f => f.specViolationType === 'missing-in-spec').length,
        missingInImplementation: findings.filter(f => f.specViolationType === 'missing-in-implementation').length,
        parameterMismatches: findings.filter(f => f.specViolationType === 'parameter-mismatch').length,
        schemaMismatches: findings.filter(f => f.specViolationType === 'schema-mismatch').length,
        deprecatedInUse: findings.filter(f => f.specViolationType === 'deprecated-in-use').length,
      },
      specInfo: {
        title: spec.info.title,
        version: spec.info.version,
        totalEndpoints: specEndpoints.length,
      },
    };
  }

  /**
   * Detect endpoints in implementation but not in spec (undocumented)
   */
  private detectUndocumentedEndpoints(
    specEndpoints: SpecEndpoint[],
    actualEndpoints: ApiEndpoint[]
  ): SpecDriftFinding[] {
    const findings: SpecDriftFinding[] = [];

    actualEndpoints.forEach((actual) => {
      const matchingSpec = specEndpoints.find(
        (spec) =>
          this.pathsMatch(spec.path, actual.path) &&
          spec.method === actual.method
      );

      if (!matchingSpec) {
        findings.push({
          id: `spec-missing-${actual.method}-${this.sanitizePath(actual.path)}`,
          severity: "high",
          title: `Undocumented Endpoint: ${actual.method} ${actual.path}`,
          description: `Backend implements ${actual.method} ${actual.path}, but it's not documented in the OpenAPI spec. This endpoint is invisible to API consumers.`,
          impact: "API consumers won't know this endpoint exists. This can lead to duplicated effort, incorrect usage, or missed opportunities for integration.",
          backend: actual,
          specViolationType: 'missing-in-spec',
          actualEndpoint: actual,
          complianceImpact: 15,
          suggestedFix: {
            description: "Add this endpoint to the OpenAPI specification",
            beforeCode: "# OpenAPI spec missing this endpoint",
            afterCode: this.generateOpenAPIEndpoint(actual),
            files: ["openapi.yaml", actual.location.file],
          },
          regressionTest: {
            description: "Ensure endpoint is documented",
            code: `test('${actual.method} ${actual.path} is documented in spec', () => {
  const spec = loadOpenAPISpec();
  const endpoint = spec.paths['${actual.path}']?.${actual.method.toLowerCase()};
  expect(endpoint).toBeDefined();
});`,
            framework: "jest",
          },
          bobPrompt: this.generateBobPrompt(
            "Undocumented Endpoint",
            actual,
            undefined,
            `This endpoint exists in the backend but is not documented in the OpenAPI spec. Please add it to the spec with proper documentation.`
          ),
        });
      }
    });

    return findings;
  }

  /**
   * Detect endpoints in spec but not implemented
   */
  private detectMissingEndpoints(
    specEndpoints: SpecEndpoint[],
    actualEndpoints: ApiEndpoint[]
  ): SpecDriftFinding[] {
    const findings: SpecDriftFinding[] = [];

    specEndpoints.forEach((spec) => {
      const matchingActual = actualEndpoints.find(
        (actual) =>
          this.pathsMatch(spec.path, actual.path) &&
          spec.method === actual.method
      );

      if (!matchingActual) {
        findings.push({
          id: `impl-missing-${spec.method}-${this.sanitizePath(spec.path)}`,
          severity: "critical",
          title: `Missing Implementation: ${spec.method} ${spec.path}`,
          description: `OpenAPI spec documents ${spec.method} ${spec.path}, but no backend implementation exists. This breaks the API contract.`,
          impact: "API consumers will get 404 errors when trying to use this endpoint. This is a critical contract violation that breaks functionality.",
          specViolationType: 'missing-in-implementation',
          specEndpoint: spec,
          complianceImpact: 25,
          suggestedFix: {
            description: "Implement the missing endpoint or remove it from the spec",
            beforeCode: "// No implementation exists",
            afterCode: this.generateBackendImplementation(spec),
            files: ["backend/routes/..."],
          },
          regressionTest: {
            description: "Verify endpoint exists",
            code: `test('${spec.method} ${spec.path} endpoint exists', async () => {
  const response = await request(app).${spec.method.toLowerCase()}('${spec.path}');
  expect(response.status).not.toBe(404);
});`,
            framework: "jest",
          },
          bobPrompt: this.generateBobPrompt(
            "Missing Implementation",
            undefined,
            spec,
            `The OpenAPI spec documents this endpoint, but it's not implemented in the backend. Please implement it according to the spec.`
          ),
        });
      }
    });

    return findings;
  }

  /**
   * Validate parameters match between spec and implementation
   */
  private validateParameters(
    specEndpoints: SpecEndpoint[],
    actualEndpoints: ApiEndpoint[]
  ): SpecDriftFinding[] {
    const findings: SpecDriftFinding[] = [];

    specEndpoints.forEach((spec) => {
      const matchingActual = actualEndpoints.find(
        (actual) =>
          this.pathsMatch(spec.path, actual.path) &&
          spec.method === actual.method
      );

      if (matchingActual) {
        // Check required parameters
        const requiredParams = (spec.parameters || [])
          .filter(p => p.required && (p.in === 'query' || p.in === 'path'))
          .map(p => p.name);

        const actualParams = [
          ...(matchingActual.params || []),
          ...(matchingActual.queryParams || []),
        ];

        const missingParams = requiredParams.filter(
          p => !actualParams.includes(p)
        );

        if (missingParams.length > 0) {
          findings.push({
            id: `param-mismatch-${spec.method}-${this.sanitizePath(spec.path)}`,
            severity: "high",
            title: `Parameter Mismatch: ${spec.method} ${spec.path}`,
            description: `OpenAPI spec requires parameters [${requiredParams.join(", ")}], but implementation doesn't validate [${missingParams.join(", ")}]`,
            impact: "API may accept invalid requests or fail unexpectedly. Required parameters should be validated to ensure data integrity.",
            backend: matchingActual,
            specViolationType: 'parameter-mismatch',
            specEndpoint: spec,
            actualEndpoint: matchingActual,
            complianceImpact: 12,
            suggestedFix: {
              description: `Add validation for required parameters: ${missingParams.join(", ")}`,
              beforeCode: matchingActual.location.code,
              afterCode: this.generateParameterValidation(matchingActual, missingParams),
              files: [matchingActual.location.file],
            },
            regressionTest: {
              description: "Test parameter validation",
              code: `test('${spec.method} ${spec.path} validates required parameters', async () => {
  const response = await request(app).${spec.method.toLowerCase()}('${spec.path}');
  expect(response.status).toBe(400); // Should fail without required params
});`,
              framework: "jest",
            },
            bobPrompt: this.generateBobPrompt(
              "Parameter Mismatch",
              matchingActual,
              spec,
              `The spec requires parameters [${requiredParams.join(", ")}] but implementation doesn't validate [${missingParams.join(", ")}]. Add proper validation.`
            ),
          });
        }

        // Check for extra parameters in implementation not in spec
        const specParamNames = (spec.parameters || []).map(p => p.name);
        const extraParams = actualParams.filter(
          p => !specParamNames.includes(p)
        );

        if (extraParams.length > 0) {
          findings.push({
            id: `extra-params-${spec.method}-${this.sanitizePath(spec.path)}`,
            severity: "medium",
            title: `Undocumented Parameters: ${spec.method} ${spec.path}`,
            description: `Implementation uses parameters [${extraParams.join(", ")}] that are not documented in the OpenAPI spec`,
            impact: "API consumers won't know about these parameters. They should be documented in the spec.",
            backend: matchingActual,
            specViolationType: 'parameter-mismatch',
            specEndpoint: spec,
            actualEndpoint: matchingActual,
            complianceImpact: 8,
            suggestedFix: {
              description: `Document parameters in OpenAPI spec: ${extraParams.join(", ")}`,
              beforeCode: "# Spec missing parameter documentation",
              afterCode: this.generateParameterDocumentation(extraParams),
              files: ["openapi.yaml"],
            },
            bobPrompt: this.generateBobPrompt(
              "Undocumented Parameters",
              matchingActual,
              spec,
              `Implementation uses parameters [${extraParams.join(", ")}] not documented in spec. Add them to the OpenAPI specification.`
            ),
          });
        }
      }
    });

    return findings;
  }

  /**
   * Validate request/response schemas (basic validation)
   */
  private validateSchemas(
    specEndpoints: SpecEndpoint[],
    actualEndpoints: ApiEndpoint[]
  ): SpecDriftFinding[] {
    const findings: SpecDriftFinding[] = [];

    specEndpoints.forEach((spec) => {
      const matchingActual = actualEndpoints.find(
        (actual) =>
          this.pathsMatch(spec.path, actual.path) &&
          spec.method === actual.method
      );

      if (matchingActual) {
        // Check if spec defines request body but implementation doesn't use it
        if (spec.requestBody && !matchingActual.bodySchema) {
          findings.push({
            id: `schema-mismatch-req-${spec.method}-${this.sanitizePath(spec.path)}`,
            severity: "medium",
            title: `Request Body Schema Mismatch: ${spec.method} ${spec.path}`,
            description: `OpenAPI spec defines a request body schema, but implementation doesn't appear to validate or use it`,
            impact: "API may accept invalid data or not process request body correctly. This can lead to data integrity issues.",
            backend: matchingActual,
            specViolationType: 'schema-mismatch',
            specEndpoint: spec,
            actualEndpoint: matchingActual,
            complianceImpact: 10,
            suggestedFix: {
              description: "Add request body validation according to spec",
              beforeCode: matchingActual.location.code,
              afterCode: "// Add request body validation middleware or schema validation",
              files: [matchingActual.location.file],
            },
            bobPrompt: this.generateBobPrompt(
              "Request Body Schema Mismatch",
              matchingActual,
              spec,
              "The spec defines a request body schema but implementation doesn't validate it. Add proper validation."
            ),
          });
        }

        // Check if implementation uses body but spec doesn't define it
        if (!spec.requestBody && matchingActual.bodySchema) {
          findings.push({
            id: `schema-mismatch-undoc-${spec.method}-${this.sanitizePath(spec.path)}`,
            severity: "medium",
            title: `Undocumented Request Body: ${spec.method} ${spec.path}`,
            description: `Implementation accepts a request body, but it's not documented in the OpenAPI spec`,
            impact: "API consumers won't know what data to send. The request body schema should be documented.",
            backend: matchingActual,
            specViolationType: 'schema-mismatch',
            specEndpoint: spec,
            actualEndpoint: matchingActual,
            complianceImpact: 10,
            suggestedFix: {
              description: "Document request body schema in OpenAPI spec",
              beforeCode: "# Spec missing request body definition",
              afterCode: this.generateRequestBodySchema(matchingActual.bodySchema),
              files: ["openapi.yaml"],
            },
            bobPrompt: this.generateBobPrompt(
              "Undocumented Request Body",
              matchingActual,
              spec,
              "Implementation uses a request body but it's not documented in the spec. Add the schema to OpenAPI spec."
            ),
          });
        }
      }
    });

    return findings;
  }

  /**
   * Check for deprecated endpoints still in use
   */
  private checkDeprecations(
    specEndpoints: SpecEndpoint[],
    actualEndpoints: ApiEndpoint[]
  ): SpecDriftFinding[] {
    const findings: SpecDriftFinding[] = [];

    specEndpoints.forEach((spec) => {
      if (spec.deprecated) {
        const matchingActual = actualEndpoints.find(
          (actual) =>
            this.pathsMatch(spec.path, actual.path) &&
            spec.method === actual.method
        );

        if (matchingActual) {
          findings.push({
            id: `deprecated-${spec.method}-${this.sanitizePath(spec.path)}`,
            severity: "medium",
            title: `Deprecated Endpoint Still Active: ${spec.method} ${spec.path}`,
            description: `OpenAPI spec marks ${spec.method} ${spec.path} as deprecated, but it's still implemented and active`,
            impact: "Deprecated endpoints should be phased out. Consumers should be migrated to newer alternatives before removal.",
            backend: matchingActual,
            specViolationType: 'deprecated-in-use',
            specEndpoint: spec,
            actualEndpoint: matchingActual,
            complianceImpact: 5,
            suggestedFix: {
              description: "Add deprecation warning or remove endpoint if migration is complete",
              beforeCode: matchingActual.location.code,
              afterCode: `// Add deprecation warning header\nres.setHeader('Deprecation', 'true');\nres.setHeader('Sunset', 'date');\n${matchingActual.location.code}`,
              files: [matchingActual.location.file],
            },
            regressionTest: {
              description: "Verify deprecation headers",
              code: `test('${spec.method} ${spec.path} returns deprecation headers', async () => {
  const response = await request(app).${spec.method.toLowerCase()}('${spec.path}');
  expect(response.headers['deprecation']).toBe('true');
});`,
              framework: "jest",
            },
            bobPrompt: this.generateBobPrompt(
              "Deprecated Endpoint Active",
              matchingActual,
              spec,
              "This endpoint is marked as deprecated in the spec but still active. Add deprecation warnings or plan for removal."
            ),
          });
        }
      }
    });

    return findings;
  }

  /**
   * Calculate compliance score (0-100)
   */
  private calculateComplianceScore(
    findings: SpecDriftFinding[],
    specEndpointCount: number,
    actualEndpointCount: number
  ): number {
    if (specEndpointCount === 0 && actualEndpointCount === 0) {
      return 100;
    }

    // Start with 100 and deduct points for violations
    let score = 100;

    findings.forEach((finding) => {
      score -= finding.complianceImpact;
    });

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if two paths match (accounting for parameters)
   */
  private pathsMatch(path1: string, path2: string): boolean {
    const normalize = (p: string) =>
      p
        .toLowerCase()
        .replace(/:[^/]+/g, ":param")
        .replace(/\{[^}]+\}/g, ":param")
        .replace(/\/+$/, "");

    return normalize(path1) === normalize(path2);
  }

  /**
   * Sanitize path for use in IDs
   */
  private sanitizePath(path: string): string {
    return path.replace(/[^a-zA-Z0-9]/g, "-");
  }

  /**
   * Generate OpenAPI endpoint definition
   */
  private generateOpenAPIEndpoint(endpoint: ApiEndpoint): string {
    const params = endpoint.params || [];
    const queryParams = endpoint.queryParams || [];

    let yaml = `paths:\n  ${endpoint.path}:\n    ${endpoint.method.toLowerCase()}:\n`;
    yaml += `      summary: ${endpoint.method} ${endpoint.path}\n`;
    yaml += `      operationId: ${endpoint.method.toLowerCase()}${this.sanitizePath(endpoint.path)}\n`;

    if (params.length > 0 || queryParams.length > 0) {
      yaml += `      parameters:\n`;
      params.forEach(p => {
        yaml += `        - name: ${p}\n          in: path\n          required: true\n          schema:\n            type: string\n`;
      });
      queryParams.forEach(p => {
        yaml += `        - name: ${p}\n          in: query\n          schema:\n            type: string\n`;
      });
    }

    yaml += `      responses:\n        '200':\n          description: Successful response\n`;

    return yaml;
  }

  /**
   * Generate backend implementation stub
   */
  private generateBackendImplementation(spec: SpecEndpoint): string {
    const framework = "express"; // Default to Express
    const method = spec.method.toLowerCase();
    
    return `router.${method}('${spec.path}', async (req, res) => {
  // TODO: Implement ${spec.summary || spec.method + ' ' + spec.path}
  // Required parameters: ${(spec.parameters || []).filter(p => p.required).map(p => p.name).join(", ") || "none"}
  res.status(501).json({ error: 'Not implemented' });
});`;
  }

  /**
   * Generate parameter validation code
   */
  private generateParameterValidation(endpoint: ApiEndpoint, params: string[]): string {
    return `// Add parameter validation
const { ${params.join(", ")} } = req.query;
if (!${params.join(" || !")}) {
  return res.status(400).json({ error: 'Missing required parameters' });
}
${endpoint.location.code}`;
  }

  /**
   * Generate parameter documentation
   */
  private generateParameterDocumentation(params: string[]): string {
    let yaml = `parameters:\n`;
    params.forEach(p => {
      yaml += `  - name: ${p}\n    in: query\n    schema:\n      type: string\n`;
    });
    return yaml;
  }

  /**
   * Generate request body schema
   */
  private generateRequestBodySchema(bodySchema: Record<string, any>): string {
    const fields = Object.keys(bodySchema);
    let yaml = `requestBody:\n  required: true\n  content:\n    application/json:\n      schema:\n        type: object\n        properties:\n`;
    fields.forEach(field => {
      yaml += `          ${field}:\n            type: string\n`;
    });
    return yaml;
  }

  /**
   * Generate Bob-ready prompt
   */
  private generateBobPrompt(
    issueType: string,
    backend?: ApiEndpoint,
    spec?: SpecEndpoint,
    explanation?: string
  ): string {
    let prompt = `# OpenAPI Spec Drift Detected: ${issueType}\n\n`;
    prompt += `${explanation}\n\n`;

    if (spec) {
      prompt += `## OpenAPI Specification\n`;
      prompt += `Endpoint: ${spec.method} ${spec.path}\n`;
      if (spec.summary) prompt += `Summary: ${spec.summary}\n`;
      if (spec.operationId) prompt += `Operation ID: ${spec.operationId}\n`;
      if (spec.parameters && spec.parameters.length > 0) {
        prompt += `Parameters:\n`;
        spec.parameters.forEach(p => {
          prompt += `  - ${p.name} (${p.in}${p.required ? ', required' : ''})\n`;
        });
      }
      if (spec.deprecated) prompt += `⚠️ Marked as DEPRECATED\n`;
      prompt += `\n`;
    }

    if (backend) {
      prompt += `## Backend Implementation\n`;
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

    prompt += `## Task\n`;
    prompt += `Please analyze the repository and fix this OpenAPI spec drift issue. `;
    prompt += `Ensure the implementation matches the specification (or vice versa) and update all related files consistently.\n`;

    return prompt;
  }
}

// Made with Bob
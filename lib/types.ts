// Core types for ContractProof analyzer

export type Severity = "critical" | "high" | "medium" | "low";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

export interface CodeLocation {
  file: string;
  line: number;
  column?: number;
  code: string;
  context?: string[]; // Surrounding lines for context
}

export interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  location: CodeLocation;
  type: "backend" | "frontend" | "documentation" | "test";
  framework?: string; // e.g., "express", "fastapi", "fetch", "axios"
  params?: string[]; // Path parameters
  queryParams?: string[]; // Query parameters
  bodySchema?: Record<string, any>; // Request body schema
  responseSchema?: Record<string, any>; // Response schema
}

export interface DriftFinding {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  impact: string;
  backend?: ApiEndpoint;
  frontend?: ApiEndpoint[];
  documentation?: ApiEndpoint[];
  tests?: ApiEndpoint[];
  suggestedFix: {
    description: string;
    beforeCode: string;
    afterCode: string;
    files: string[];
  };
  regressionTest?: {
    description: string;
    code: string;
    framework: string;
  };
  bobPrompt: string; // Ready-to-use prompt for IBM Bob
  bobFixStatus?: "pending" | "analyzing" | "ready" | "applying" | "applied" | "failed" | "rolled_back";
  bobFixId?: string;
}

export interface AnalysisResult {
  findings: DriftFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  scannedFiles: {
    backend: number;
    frontend: number;
    documentation: number;
    tests: number;
  };
  timestamp: string;
}

export interface AnalyzerConfig {
  includePaths?: string[];
  excludePaths?: string[];
  frameworks?: {
    backend?: string[];
    frontend?: string[];
  };
}

// Made with Bob

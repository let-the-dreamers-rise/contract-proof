import { NextRequest, NextResponse } from "next/server";
import { OpenAPIParser } from "@/lib/openapi-parser";
import { OpenAPIValidator } from "@/lib/analyzers/openapi-validator";
import { RealBackendAnalyzer } from "@/lib/analyzers/real-backend-analyzer";
import { ApiEndpoint } from "@/lib/types";
import * as fs from "fs";
import * as path from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { specContent, repositoryPath } = body;

    if (!specContent) {
      return NextResponse.json(
        { error: "OpenAPI spec content is required" },
        { status: 400 }
      );
    }

    // Parse OpenAPI spec
    const parser = new OpenAPIParser();
    let parsedSpec;
    let specEndpoints;

    try {
      parsedSpec = await parser.parse(specContent);
      specEndpoints = parser.extractEndpoints();
    } catch (error) {
      return NextResponse.json(
        { 
          error: "Failed to parse OpenAPI spec",
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 400 }
      );
    }

    // Analyze actual backend implementation
    const actualEndpoints = await analyzeBackendImplementation(repositoryPath);

    // Validate spec against implementation
    const validator = new OpenAPIValidator();
    const validationResult = await validator.validate(
      parsedSpec,
      specEndpoints,
      actualEndpoints
    );

    return NextResponse.json({
      success: true,
      result: validationResult,
    });
  } catch (error) {
    console.error("Error validating OpenAPI spec:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Analyze backend implementation to extract actual endpoints
 */
async function analyzeBackendImplementation(
  repositoryPath?: string
): Promise<ApiEndpoint[]> {
  const endpoints: ApiEndpoint[] = [];
  const analyzer = new RealBackendAnalyzer();

  // Use provided path or default to sample app
  const basePath = repositoryPath || path.join(process.cwd(), "samples", "broken-api-app");

  try {
    // Check if path exists
    if (!fs.existsSync(basePath)) {
      console.warn(`Repository path not found: ${basePath}`);
      return endpoints;
    }

    // Scan backend directory
    const backendPath = path.join(basePath, "backend");
    if (fs.existsSync(backendPath)) {
      await scanDirectory(backendPath, analyzer, endpoints);
    }

    // Also scan root for Next.js API routes
    const apiPath = path.join(basePath, "app", "api");
    if (fs.existsSync(apiPath)) {
      await scanDirectory(apiPath, analyzer, endpoints);
    }

    // Scan pages/api for Next.js pages router
    const pagesApiPath = path.join(basePath, "pages", "api");
    if (fs.existsSync(pagesApiPath)) {
      await scanDirectory(pagesApiPath, analyzer, endpoints);
    }

    // Scan src directory
    const srcPath = path.join(basePath, "src");
    if (fs.existsSync(srcPath)) {
      await scanDirectory(srcPath, analyzer, endpoints);
    }
  } catch (error) {
    console.error("Error analyzing backend:", error);
  }

  return endpoints;
}

/**
 * Recursively scan directory for backend files
 */
async function scanDirectory(
  dirPath: string,
  analyzer: RealBackendAnalyzer,
  endpoints: ApiEndpoint[]
): Promise<void> {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip node_modules and hidden directories
      if (entry.name === "node_modules" || entry.name.startsWith(".")) {
        continue;
      }

      if (entry.isDirectory()) {
        await scanDirectory(fullPath, analyzer, endpoints);
      } else if (entry.isFile()) {
        // Check if it's a backend file
        const ext = path.extname(entry.name);
        if ([".js", ".ts", ".py"].includes(ext)) {
          try {
            const content = fs.readFileSync(fullPath, "utf-8");
            const fileEndpoints = analyzer.analyzeFile(content, fullPath);
            endpoints.push(...fileEndpoints);
          } catch (error) {
            console.error(`Error analyzing file ${fullPath}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
}

// Made with Bob
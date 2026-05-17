// API route for Bob-powered automated fixes

import { NextRequest, NextResponse } from "next/server";
import { createBobFixer } from "@/lib/analyzers/bob-drift-fixer";
import { DriftFinding } from "@/lib/types";

export const maxDuration = 60; // 60 seconds timeout

interface BobFixRequest {
  action: "analyze" | "preview" | "apply" | "rollback" | "status" | "batch";
  finding?: DriftFinding;
  findings?: DriftFinding[];
  findingId?: string;
  confirmed?: boolean;
}

interface BobFixResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// Initialize Bob fixer (will be created per request with API key)
function getBobFixer(apiKey?: string) {
  const key = apiKey || process.env.BOB_API_KEY;
  
  if (!key) {
    throw new Error("Bob API key not configured. Set BOB_API_KEY environment variable.");
  }

  return createBobFixer(key, {
    autoApply: false, // Require explicit confirmation
    requireConfirmation: true,
    maxConcurrentFixes: 3,
  });
}

/**
 * POST /api/bob-fix - Handle Bob fix operations
 */
export async function POST(request: NextRequest) {
  try {
    const body: BobFixRequest = await request.json();
    const { action, finding, findings, findingId, confirmed } = body;

    // Get API key from header or env
    const apiKey = request.headers.get("x-bob-api-key") || undefined;
    const bobFixer = getBobFixer(apiKey);

    switch (action) {
      case "analyze":
        return await handleAnalyze(bobFixer, finding);

      case "preview":
        return await handlePreview(bobFixer, finding);

      case "apply":
        return await handleApply(bobFixer, finding, confirmed);

      case "rollback":
        return await handleRollback(bobFixer, finding);

      case "status":
        return await handleStatus(bobFixer, findingId);

      case "batch":
        return await handleBatch(bobFixer, findings);

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Bob fix error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An error occurred while processing the fix",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bob-fix - Get fix statistics and history
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-bob-api-key") || undefined;
    const bobFixer = getBobFixer(apiKey);

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");
    const findingId = searchParams.get("findingId");

    if (action === "status" && findingId) {
      const status = bobFixer.getFixStatus(findingId);
      return NextResponse.json({
        success: true,
        data: status,
      });
    }

    if (action === "statistics") {
      const statistics = bobFixer.getFixStatistics();
      return NextResponse.json({
        success: true,
        data: statistics,
      });
    }

    if (action === "history") {
      const history = bobFixer.exportHistory();
      return NextResponse.json({
        success: true,
        data: history,
      });
    }

    // Default: return all statuses
    const statuses = bobFixer.getAllFixStatuses();
    return NextResponse.json({
      success: true,
      data: statuses,
    });
  } catch (error: any) {
    console.error("Bob fix GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle analyze action
 */
async function handleAnalyze(bobFixer: any, finding?: DriftFinding): Promise<NextResponse> {
  if (!finding) {
    return NextResponse.json(
      { success: false, error: "Finding is required for analyze action" },
      { status: 400 }
    );
  }

  try {
    const result = await bobFixer.analyzeFinding(finding);

    return NextResponse.json({
      success: true,
      data: {
        analysis: result.analysis,
        suggestions: result.suggestions,
        confidence: result.confidence,
        estimatedTime: result.estimatedTime,
      },
      message: "Analysis completed successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Analysis failed: ${error.message}`,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle preview action
 */
async function handlePreview(bobFixer: any, finding?: DriftFinding): Promise<NextResponse> {
  if (!finding) {
    return NextResponse.json(
      { success: false, error: "Finding is required for preview action" },
      { status: 400 }
    );
  }

  try {
    const preview = await bobFixer.previewFix(finding);

    return NextResponse.json({
      success: true,
      data: {
        suggestion: preview.suggestion,
        impactedFiles: preview.impactedFiles,
        previewDiff: preview.previewDiff,
        warnings: preview.warnings,
      },
      message: "Preview generated successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Preview failed: ${error.message}`,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle apply action
 */
async function handleApply(
  bobFixer: any,
  finding?: DriftFinding,
  confirmed?: boolean
): Promise<NextResponse> {
  if (!finding) {
    return NextResponse.json(
      { success: false, error: "Finding is required for apply action" },
      { status: 400 }
    );
  }

  if (!confirmed) {
    return NextResponse.json(
      {
        success: false,
        error: "Confirmation required. Set confirmed: true to apply the fix.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await bobFixer.applyFixWithConfirmation(finding, confirmed);

    return NextResponse.json({
      success: result.success,
      data: {
        fixId: result.fixId,
        appliedChanges: result.appliedChanges,
        rollbackId: result.rollbackId,
      },
      message: result.message,
      error: result.errors?.join(", "),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Apply failed: ${error.message}`,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle rollback action
 */
async function handleRollback(bobFixer: any, finding?: DriftFinding): Promise<NextResponse> {
  if (!finding) {
    return NextResponse.json(
      { success: false, error: "Finding is required for rollback action" },
      { status: 400 }
    );
  }

  try {
    await bobFixer.rollbackFix(finding);

    return NextResponse.json({
      success: true,
      message: "Fix rolled back successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Rollback failed: ${error.message}`,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle status action
 */
async function handleStatus(bobFixer: any, findingId?: string): Promise<NextResponse> {
  if (!findingId) {
    return NextResponse.json(
      { success: false, error: "Finding ID is required for status action" },
      { status: 400 }
    );
  }

  const status = bobFixer.getFixStatus(findingId);

  if (!status) {
    return NextResponse.json(
      { success: false, error: "Fix status not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: status,
  });
}

/**
 * Handle batch action
 */
async function handleBatch(bobFixer: any, findings?: DriftFinding[]): Promise<NextResponse> {
  if (!findings || findings.length === 0) {
    return NextResponse.json(
      { success: false, error: "Findings array is required for batch action" },
      { status: 400 }
    );
  }

  try {
    const results = await bobFixer.batchFixFindings(findings, {
      stopOnError: false,
    });

    const successCount = Array.from(results.values()).filter((r: any) => r.success).length;
    const failureCount = results.size - successCount;

    return NextResponse.json({
      success: true,
      data: {
        total: results.size,
        successful: successCount,
        failed: failureCount,
        results: Array.from(results.entries()).map((entry: any) => ({
          findingId: entry[0],
          success: entry[1].success,
          message: entry[1].message,
        })),
      },
      message: `Batch fix completed: ${successCount} successful, ${failureCount} failed`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Batch fix failed: ${error.message}`,
      },
      { status: 500 }
    );
  }
}

// Made with Bob
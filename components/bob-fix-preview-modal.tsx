"use client";

import { useState, useEffect } from "react";
import { DriftFinding } from "@/lib/types";
import { X, AlertTriangle, FileCode, CheckCircle, XCircle, RotateCcw } from "lucide-react";

interface FixPreview {
  suggestion: {
    id: string;
    title: string;
    description: string;
    reasoning: string;
    confidence: number;
    riskLevel: "low" | "medium" | "high";
    testStrategy: string;
  };
  impactedFiles: string[];
  previewDiff: string;
  warnings: string[];
}

interface BobFixPreviewModalProps {
  finding: DriftFinding;
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
}

export function BobFixPreviewModal({
  finding,
  isOpen,
  onClose,
  onApply,
}: BobFixPreviewModalProps) {
  const [preview, setPreview] = useState<FixPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{
    success: boolean;
    message: string;
    fixId?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && !preview) {
      loadPreview();
    }
  }, [isOpen]);

  const loadPreview = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/bob-fix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "preview",
          finding,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to load preview");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Preview failed");
      }

      setPreview(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    setError(null);

    try {
      const response = await fetch("/api/bob-fix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "apply",
          finding,
          confirmed: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to apply fix");
      }

      const result = await response.json();

      setApplyResult({
        success: result.success,
        message: result.message,
        fixId: result.data?.fixId,
      });

      if (result.success) {
        setTimeout(() => {
          onApply();
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message);
      setApplyResult({
        success: false,
        message: err.message,
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleRollback = async () => {
    if (!applyResult?.fixId) return;

    try {
      const response = await fetch("/api/bob-fix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "rollback",
          finding,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to rollback fix");
      }

      setApplyResult(null);
      setPreview(null);
      loadPreview();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low":
        return "text-green-600 bg-green-100 dark:bg-green-900/20";
      case "medium":
        return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20";
      case "high":
        return "text-red-600 bg-red-100 dark:bg-red-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:bg-gray-900/20";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Bob Fix Preview
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {finding.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-100">
                    Error
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {applyResult && (
            <div
              className={`border rounded-lg p-4 mb-4 ${
                applyResult.success
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              }`}
            >
              <div className="flex items-start gap-3">
                {applyResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3
                    className={`font-semibold ${
                      applyResult.success
                        ? "text-green-900 dark:text-green-100"
                        : "text-red-900 dark:text-red-100"
                    }`}
                  >
                    {applyResult.success ? "Fix Applied Successfully!" : "Fix Failed"}
                  </h3>
                  <p
                    className={`text-sm mt-1 ${
                      applyResult.success
                        ? "text-green-700 dark:text-green-300"
                        : "text-red-700 dark:text-red-300"
                    }`}
                  >
                    {applyResult.message}
                  </p>
                  {applyResult.success && applyResult.fixId && (
                    <button
                      onClick={handleRollback}
                      className="mt-2 inline-flex items-center gap-2 text-sm text-green-700 dark:text-green-300 hover:underline"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Rollback this fix
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {preview && !applyResult && (
            <div className="space-y-6">
              {/* Fix Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {preview.suggestion.title}
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {preview.suggestion.description}
                </p>
              </div>

              {/* Risk and Confidence */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Risk Level
                  </label>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(
                        preview.suggestion.riskLevel
                      )}`}
                    >
                      {preview.suggestion.riskLevel.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Confidence
                  </label>
                  <div className="mt-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${preview.suggestion.confidence * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {Math.round(preview.suggestion.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">
                        Warnings
                      </h4>
                      <ul className="mt-2 space-y-1">
                        {preview.warnings.map((warning, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-yellow-700 dark:text-yellow-300"
                          >
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Impacted Files */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  Impacted Files ({preview.impactedFiles.length})
                </h4>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                  <ul className="space-y-1">
                    {preview.impactedFiles.map((file, idx) => (
                      <li
                        key={idx}
                        className="text-sm font-mono text-gray-700 dark:text-gray-300"
                      >
                        {file}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Diff Preview */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Changes Preview
                </h4>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-100 font-mono whitespace-pre">
                    {preview.previewDiff}
                  </pre>
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Bob's Reasoning
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                  {preview.suggestion.reasoning}
                </p>
              </div>

              {/* Test Strategy */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Test Strategy
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                  {preview.suggestion.testStrategy}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {preview && !applyResult && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying}
              className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              {isApplying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Applying Fix...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>Apply Fix</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Made with Bob
"use client";

import React, { useState } from "react";
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Code,
  Wand2
} from "lucide-react";
import { SpecDriftFinding, SpecValidationResult } from "@/lib/analyzers/openapi-validator";

interface SpecDriftDisplayProps {
  result: SpecValidationResult;
  onFixClick?: (finding: SpecDriftFinding) => void;
}

export function SpecDriftDisplay({ result, onFixClick }: SpecDriftDisplayProps) {
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());

  const toggleFinding = (id: string) => {
    const newExpanded = new Set(expandedFindings);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFindings(newExpanded);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-600 bg-red-50 border-red-200";
      case "high":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-blue-600 bg-blue-50 border-blue-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="w-5 h-5" />;
      case "high":
        return <AlertCircle className="w-5 h-5" />;
      case "medium":
        return <Info className="w-5 h-5" />;
      case "low":
        return <Info className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getViolationTypeLabel = (type: string) => {
    switch (type) {
      case "missing-in-spec":
        return "Undocumented";
      case "missing-in-implementation":
        return "Not Implemented";
      case "parameter-mismatch":
        return "Parameter Mismatch";
      case "schema-mismatch":
        return "Schema Mismatch";
      case "deprecated-in-use":
        return "Deprecated";
      default:
        return type;
    }
  };

  const getComplianceColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    if (score >= 50) return "text-orange-600";
    return "text-red-600";
  };

  const getComplianceLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Fair";
    return "Poor";
  };

  return (
    <div className="space-y-6">
      {/* Compliance Score Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              OpenAPI Compliance Score
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {result.specInfo.title} v{result.specInfo.version}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${getComplianceColor(result.complianceScore)}`}>
              {result.complianceScore}%
            </div>
            <div className={`text-sm font-medium ${getComplianceColor(result.complianceScore)}`}>
              {getComplianceLabel(result.complianceScore)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              result.complianceScore >= 90
                ? "bg-green-600"
                : result.complianceScore >= 70
                ? "bg-yellow-600"
                : result.complianceScore >= 50
                ? "bg-orange-600"
                : "bg-red-600"
            }`}
            style={{ width: `${result.complianceScore}%` }}
          />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{result.summary.total}</div>
            <div className="text-xs text-gray-600">Total Issues</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{result.summary.missingInSpec}</div>
            <div className="text-xs text-gray-600">Undocumented</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{result.summary.missingInImplementation}</div>
            <div className="text-xs text-gray-600">Not Implemented</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{result.summary.parameterMismatches}</div>
            <div className="text-xs text-gray-600">Param Issues</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{result.summary.deprecatedInUse}</div>
            <div className="text-xs text-gray-600">Deprecated</div>
          </div>
        </div>
      </div>

      {/* Findings List */}
      {result.findings.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            Perfect Compliance! 🎉
          </h3>
          <p className="text-sm text-green-700">
            Your API implementation matches the OpenAPI specification perfectly.
            No drift detected!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Spec Drift Findings ({result.findings.length})
          </h3>
          
          {result.findings.map((finding) => {
            const isExpanded = expandedFindings.has(finding.id);
            const severityColor = getSeverityColor(finding.severity);

            return (
              <div
                key={finding.id}
                className={`border rounded-lg overflow-hidden transition-all ${severityColor}`}
              >
                {/* Finding Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-opacity-80 transition-colors"
                  onClick={() => toggleFinding(finding.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex-shrink-0 mt-0.5">
                        {getSeverityIcon(finding.severity)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-white bg-opacity-50">
                            {finding.severity}
                          </span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-white bg-opacity-50">
                            {getViolationTypeLabel(finding.specViolationType)}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm mb-1">
                          {finding.title}
                        </h4>
                        <p className="text-xs opacity-90">
                          {finding.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {onFixClick && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFixClick(finding);
                          }}
                          className="p-2 bg-white bg-opacity-50 hover:bg-opacity-100 rounded transition-colors"
                          title="Fix with Bob"
                        >
                          <Wand2 className="w-4 h-4" />
                        </button>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t bg-white p-4 space-y-4">
                    {/* Impact */}
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900 mb-1">
                        Impact
                      </h5>
                      <p className="text-sm text-gray-700">{finding.impact}</p>
                    </div>

                    {/* Spec Endpoint */}
                    {finding.specEndpoint && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          OpenAPI Specification
                        </h5>
                        <div className="bg-gray-50 rounded p-3 text-xs space-y-1">
                          <div>
                            <span className="font-semibold">Endpoint:</span>{" "}
                            <code className="bg-gray-200 px-1 py-0.5 rounded">
                              {finding.specEndpoint.method} {finding.specEndpoint.path}
                            </code>
                          </div>
                          {finding.specEndpoint.summary && (
                            <div>
                              <span className="font-semibold">Summary:</span>{" "}
                              {finding.specEndpoint.summary}
                            </div>
                          )}
                          {finding.specEndpoint.parameters && finding.specEndpoint.parameters.length > 0 && (
                            <div>
                              <span className="font-semibold">Parameters:</span>{" "}
                              {finding.specEndpoint.parameters.map(p => `${p.name} (${p.in})`).join(", ")}
                            </div>
                          )}
                          {finding.specEndpoint.deprecated && (
                            <div className="text-orange-600 font-semibold">
                              ⚠️ Marked as DEPRECATED
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actual Endpoint */}
                    {finding.actualEndpoint && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                          <Code className="w-4 h-4 mr-1" />
                          Backend Implementation
                        </h5>
                        <div className="bg-gray-50 rounded p-3 text-xs space-y-1">
                          <div>
                            <span className="font-semibold">File:</span>{" "}
                            <code className="bg-gray-200 px-1 py-0.5 rounded">
                              {finding.actualEndpoint.location.file}:{finding.actualEndpoint.location.line}
                            </code>
                          </div>
                          <div>
                            <span className="font-semibold">Route:</span>{" "}
                            <code className="bg-gray-200 px-1 py-0.5 rounded">
                              {finding.actualEndpoint.method} {finding.actualEndpoint.path}
                            </code>
                          </div>
                          <div>
                            <span className="font-semibold">Framework:</span> {finding.actualEndpoint.framework}
                          </div>
                          <div className="mt-2">
                            <pre className="bg-gray-800 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                              {finding.actualEndpoint.location.code}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Suggested Fix */}
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900 mb-2">
                        Suggested Fix
                      </h5>
                      <p className="text-sm text-gray-700 mb-2">
                        {finding.suggestedFix.description}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs font-semibold text-gray-600 mb-1">Before:</div>
                          <pre className="bg-gray-800 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                            {finding.suggestedFix.beforeCode}
                          </pre>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-600 mb-1">After:</div>
                          <pre className="bg-gray-800 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                            {finding.suggestedFix.afterCode}
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* Compliance Impact */}
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <div className="text-xs">
                        <span className="font-semibold text-blue-900">Compliance Impact:</span>{" "}
                        <span className="text-blue-700">
                          -{finding.complianceImpact} points
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Made with Bob
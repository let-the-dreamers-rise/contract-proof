"use client";

import { useState, useRef } from "react";
import { ArrowLeft, AlertCircle, CheckCircle2, Copy, Download, Filter, Search, Zap, Github, Loader2, XCircle, FileText } from "lucide-react";
import Link from "next/link";
import { getSampleAnalysisResults } from "@/lib/sample-analyzer";
import { DriftFinding, Severity, AnalysisResult } from "@/lib/types";
import { AnalysisProgress } from "@/lib/analysis-progress";
import { OpenAPIUpload } from "@/components/openapi-upload";
import { SpecDriftDisplay } from "@/components/spec-drift-display";
import { SpecValidationResult } from "@/lib/analyzers/openapi-validator";

type AnalysisMode = "sample" | "github" | "spec";

export default function DemoPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [results, setResults] = useState(getSampleAnalysisResults());
  const [selectedFinding, setSelectedFinding] = useState<DriftFinding | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("sample");
  const [githubUrl, setGithubUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [specValidationResult, setSpecValidationResult] = useState<SpecValidationResult | null>(null);
  const [isValidatingSpec, setIsValidatingSpec] = useState(false);

  const handleLoadSample = () => {
    setIsAnalyzing(true);
    setError(null);
    setProgress({
      stage: "scanning",
      percentage: 50,
      message: "Loading sample repository...",
    });
    setTimeout(() => {
      setProgress({
        stage: "complete",
        percentage: 100,
        message: "Analysis complete!",
      });
      setIsAnalyzing(false);
      setHasAnalyzed(true);
      setResults(getSampleAnalysisResults());
    }, 2000);
  };

  const handleAnalyzeGithub = async () => {
    if (!githubUrl.trim()) {
      setError("Please enter a GitHub repository URL");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setProgress({
      stage: "validating",
      percentage: 0,
      message: "Validating repository...",
    });

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      // Use streaming API
      const response = await fetch("/api/analyze?stream=true", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          githubUrl: githubUrl.trim(),
          githubToken: githubToken.trim() || undefined,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analysis failed");
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Failed to read response stream");
      }

      let buffer = "";
      let finalResult: AnalysisResult | null = null;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              // Check if this is the final result
              if (data.type === "result") {
                finalResult = data.data;
              } else if (data.stage === "complete" && data.message && data.message.startsWith("{")) {
                // Handle result embedded in message
                try {
                  finalResult = JSON.parse(data.message);
                } catch {
                  // Not a result, just progress
                  setProgress(data);
                }
              } else {
                // Regular progress update
                setProgress(data);

                // Check for errors
                if (data.stage === "error") {
                  throw new Error(data.error || "Analysis failed");
                }
              }
            } catch (parseError) {
              console.error("Failed to parse SSE data:", parseError);
            }
          }
        }
      }

      if (finalResult) {
        setResults(finalResult);
        setHasAnalyzed(true);
      } else {
        throw new Error("No analysis results received");
      }

      setIsAnalyzing(false);
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("Analysis cancelled");
      } else {
        setError(err.message || "Failed to analyze repository");
      }
      setIsAnalyzing(false);
      setProgress(null);
    }
  };

  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
    setProgress(null);
    setError("Analysis cancelled by user");
  };

  const handleSpecUpload = async (content: string, fileName: string) => {
    setIsValidatingSpec(true);
    setError(null);
    setSpecValidationResult(null);

    try {
      const response = await fetch("/api/validate-spec", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          specContent: content,
          repositoryPath: undefined, // Use default sample app
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Validation failed");
      }

      const data = await response.json();
      setSpecValidationResult(data.result);
    } catch (err: any) {
      setError(err.message || "Failed to validate OpenAPI spec");
    } finally {
      setIsValidatingSpec(false);
    }
  };

  const filteredFindings = results.findings.filter((finding) => {
    const matchesSeverity = severityFilter === "all" || finding.severity === severityFilter;
    const matchesSearch =
      searchQuery === "" ||
      finding.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      finding.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800";
    }
  };

  const getSeverityIcon = (severity: Severity) => {
    if (severity === "critical" || severity === "high") {
      return <AlertCircle className="w-4 h-4" />;
    }
    return <CheckCircle2 className="w-4 h-4" />;
  };

  const copyBobPrompt = (finding: DriftFinding) => {
    navigator.clipboard.writeText(finding.bobPrompt);
    setCopiedId(finding.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportReport = () => {
    const markdown = generateMarkdownReport(results);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contractproof-report-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
  };

  if (!hasAnalyzed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <header className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
            </Link>
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-purple-600" />
              <span className="font-bold">ContractProof Demo</span>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-bold">Ready to Detect API Drift?</h1>
              <p className="text-xl text-muted-foreground">
                Choose how you want to analyze your codebase
              </p>
            </div>

            {/* Mode Selection */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setAnalysisMode("sample")}
                className={`px-6 py-3 rounded-lg border-2 font-semibold transition-all ${
                  analysisMode === "sample"
                    ? "bg-purple-100 dark:bg-purple-900/20 border-purple-600 text-purple-700 dark:text-purple-300"
                    : "border-gray-300 dark:border-gray-700 hover:border-purple-400"
                }`}
              >
                <Zap className="w-5 h-5 inline mr-2" />
                Sample Demo
              </button>
              <button
                onClick={() => setAnalysisMode("github")}
                className={`px-6 py-3 rounded-lg border-2 font-semibold transition-all ${
                  analysisMode === "github"
                    ? "bg-purple-100 dark:bg-purple-900/20 border-purple-600 text-purple-700 dark:text-purple-300"
                    : "border-gray-300 dark:border-gray-700 hover:border-purple-400"
                }`}
              >
                <Github className="w-5 h-5 inline mr-2" />
                Analyze GitHub Repo
              </button>
              <button
                onClick={() => setAnalysisMode("spec")}
                className={`px-6 py-3 rounded-lg border-2 font-semibold transition-all ${
                  analysisMode === "spec"
                    ? "bg-purple-100 dark:bg-purple-900/20 border-purple-600 text-purple-700 dark:text-purple-300"
                    : "border-gray-300 dark:border-gray-700 hover:border-purple-400"
                }`}
              >
                <FileText className="w-5 h-5 inline mr-2" />
                Spec Validation
              </button>
            </div>

            {/* Sample Mode */}
            {analysisMode === "sample" && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border-2 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-4">Sample Repository Demo</h2>
                  <p className="text-muted-foreground mb-6">
                    Load our pre-built sample with intentional API drift issues. Perfect for seeing ContractProof in action!
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-lg">What's Included:</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span>3 Backend routes (Express.js)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span>3 Frontend services (Axios)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span>1 API documentation file</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span>2 Test files (Jest)</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      <strong>7 drift scenarios</strong> including route renames, method mismatches, missing parameters, and more.
                    </p>
                  </div>
                </div>

                {isAnalyzing ? (
                  <div className="space-y-4">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300"
                        style={{ width: `${progress?.percentage || 0}%` }}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-center font-medium">
                        {progress?.message || "Processing..."}
                      </p>
                      {progress?.filesProcessed !== undefined && progress?.totalFiles !== undefined && (
                        <p className="text-sm text-muted-foreground text-center">
                          {progress.filesProcessed} / {progress.totalFiles} files processed
                        </p>
                      )}
                      <div className="flex justify-center">
                        <button
                          onClick={handleCancelAnalysis}
                          className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel Analysis
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleLoadSample}
                    className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold text-lg hover:shadow-xl transition-all transform hover:scale-105"
                  >
                    Load Sample & Run Analysis
                  </button>
                )}
              </div>
            )}

            {/* GitHub Mode */}
            {analysisMode === "github" && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border-2 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-4">Analyze GitHub Repository</h2>
                  <p className="text-muted-foreground mb-6">
                    Enter any public GitHub repository URL to analyze it for API drift issues. This uses real AST parsing!
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      GitHub Repository URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/username/repository"
                      className="w-full px-4 py-3 border-2 rounded-lg bg-transparent focus:border-purple-600 focus:outline-none"
                      disabled={isAnalyzing}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Example: https://github.com/vercel/next.js
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      GitHub Token (Optional)
                    </label>
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxx"
                      className="w-full px-4 py-3 border-2 rounded-lg bg-transparent focus:border-purple-600 focus:outline-none"
                      disabled={isAnalyzing}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Only needed for private repositories or to avoid rate limits
                    </p>
                  </div>

                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-semibold">Error</span>
                      </div>
                      <p className="text-sm text-red-700 dark:text-red-400 mt-2">{error}</p>
                    </div>
                  )}

                  {isAnalyzing ? (
                    <div className="space-y-4">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300"
                          style={{ width: `${progress?.percentage || 0}%` }}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-center flex items-center justify-center gap-2 font-medium">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {progress?.message || "Processing..."}
                        </p>
                        {progress?.filesProcessed !== undefined && progress?.totalFiles !== undefined && (
                          <p className="text-sm text-muted-foreground text-center">
                            {progress.filesProcessed} / {progress.totalFiles} files processed
                          </p>
                        )}
                        {progress?.currentFile && (
                          <p className="text-xs text-muted-foreground text-center truncate">
                            Current: {progress.currentFile}
                          </p>
                        )}
                        <div className="flex justify-center">
                          <button
                            onClick={handleCancelAnalysis}
                            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            Cancel Analysis
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleAnalyzeGithub}
                      disabled={!githubUrl.trim()}
                      className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold text-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <Github className="w-5 h-5 inline mr-2" />
                      Analyze Repository
                    </button>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-semibold mb-1">Analysis may take 30-60 seconds</p>
                      <p>We'll clone the repository, parse all files using AST, and detect drift across backend, frontend, docs, and tests.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Spec Validation Mode */}
            {analysisMode === "spec" && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border-2 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-4">OpenAPI Spec Validation</h2>
                  <p className="text-muted-foreground mb-6">
                    Upload your OpenAPI/Swagger specification to detect drift between your API documentation and actual implementation.
                  </p>
                </div>

                <OpenAPIUpload
                  onFileUpload={handleSpecUpload}
                  onClear={() => setSpecValidationResult(null)}
                  isLoading={isValidatingSpec}
                />

                {isValidatingSpec && (
                  <div className="space-y-4">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-600 to-blue-600 animate-pulse" style={{ width: "100%" }} />
                    </div>
                    <p className="text-muted-foreground text-center flex items-center justify-center gap-2 font-medium">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Validating OpenAPI spec against implementation...
                    </p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-semibold">Error</span>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-2">{error}</p>
                  </div>
                )}

                {specValidationResult && (
                  <div className="mt-6">
                    <SpecDriftDisplay result={specValidationResult} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <header className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2">
            <div className="text-3xl font-bold text-purple-600">{results.summary.total}</div>
            <div className="text-sm text-muted-foreground">Total Findings</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-red-200 dark:border-red-800">
            <div className="text-3xl font-bold text-red-600">{results.summary.critical}</div>
            <div className="text-sm text-muted-foreground">Critical</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-orange-200 dark:border-orange-800">
            <div className="text-3xl font-bold text-orange-600">{results.summary.high}</div>
            <div className="text-sm text-muted-foreground">High</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-yellow-200 dark:border-yellow-800">
            <div className="text-3xl font-bold text-yellow-600">{results.summary.medium}</div>
            <div className="text-sm text-muted-foreground">Medium</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800">
            <div className="text-3xl font-bold text-blue-600">{results.summary.low}</div>
            <div className="text-sm text-muted-foreground">Low</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border-2 mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search findings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSeverityFilter("all")}
              className={`px-4 py-2 rounded-lg border ${severityFilter === "all" ? "bg-purple-100 dark:bg-purple-900/20 border-purple-600" : ""}`}
            >
              All
            </button>
            <button
              onClick={() => setSeverityFilter("critical")}
              className={`px-4 py-2 rounded-lg border ${severityFilter === "critical" ? "bg-red-100 dark:bg-red-900/20 border-red-600" : ""}`}
            >
              Critical
            </button>
            <button
              onClick={() => setSeverityFilter("high")}
              className={`px-4 py-2 rounded-lg border ${severityFilter === "high" ? "bg-orange-100 dark:bg-orange-900/20 border-orange-600" : ""}`}
            >
              High
            </button>
            <button
              onClick={() => setSeverityFilter("medium")}
              className={`px-4 py-2 rounded-lg border ${severityFilter === "medium" ? "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-600" : ""}`}
            >
              Medium
            </button>
            <button
              onClick={() => setSeverityFilter("low")}
              className={`px-4 py-2 rounded-lg border ${severityFilter === "low" ? "bg-blue-100 dark:bg-blue-900/20 border-blue-600" : ""}`}
            >
              Low
            </button>
          </div>
        </div>

        {/* Findings List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Drift Findings ({filteredFindings.length})</h2>
            {filteredFindings.map((finding) => (
              <div
                key={finding.id}
                onClick={() => setSelectedFinding(finding)}
                className={`bg-white dark:bg-gray-800 rounded-xl p-6 border-2 cursor-pointer transition-all hover:shadow-lg ${
                  selectedFinding?.id === finding.id ? "ring-2 ring-purple-600" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(finding.severity)}`}>
                    {getSeverityIcon(finding.severity)}
                    <span className="uppercase">{finding.severity}</span>
                  </div>
                </div>
                <h3 className="font-bold text-lg mb-2">{finding.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{finding.description}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  {finding.backend && <span>✓ Backend</span>}
                  {finding.frontend && <span>✓ Frontend</span>}
                  {finding.documentation && <span>✓ Docs</span>}
                  {finding.tests && <span>✓ Tests</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Finding Details */}
          <div className="lg:sticky lg:top-24 h-fit">
            {selectedFinding ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 space-y-6">
                <div>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border mb-4 ${getSeverityColor(selectedFinding.severity)}`}>
                    {getSeverityIcon(selectedFinding.severity)}
                    <span className="uppercase">{selectedFinding.severity}</span>
                  </div>
                  <h2 className="text-2xl font-bold mb-3">{selectedFinding.title}</h2>
                  <p className="text-muted-foreground mb-4">{selectedFinding.description}</p>
                  
                  <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
                    <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Impact</h4>
                    <p className="text-sm text-red-700 dark:text-red-400">{selectedFinding.impact}</p>
                  </div>
                </div>

                {/* Evidence */}
                <div>
                  <h3 className="font-bold text-lg mb-3">Evidence</h3>
                  {selectedFinding.backend && (
                    <div className="mb-4">
                      <div className="text-sm font-medium text-green-600 mb-2">Backend Route</div>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 font-mono text-sm">
                        <div className="text-xs text-muted-foreground mb-2">
                          {selectedFinding.backend.location.file}:{selectedFinding.backend.location.line}
                        </div>
                        <code>{selectedFinding.backend.location.code}</code>
                      </div>
                    </div>
                  )}
                  {selectedFinding.frontend && selectedFinding.frontend[0] && (
                    <div className="mb-4">
                      <div className="text-sm font-medium text-blue-600 mb-2">Frontend Call</div>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 font-mono text-sm">
                        <div className="text-xs text-muted-foreground mb-2">
                          {selectedFinding.frontend[0].location.file}:{selectedFinding.frontend[0].location.line}
                        </div>
                        <code>{selectedFinding.frontend[0].location.code}</code>
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggested Fix */}
                <div>
                  <h3 className="font-bold text-lg mb-3">Suggested Fix</h3>
                  <p className="text-sm text-muted-foreground mb-3">{selectedFinding.suggestedFix.description}</p>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-medium text-red-600 mb-1">Before</div>
                      <pre className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-xs overflow-x-auto">
                        <code>{selectedFinding.suggestedFix.beforeCode}</code>
                      </pre>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-green-600 mb-1">After</div>
                      <pre className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-xs overflow-x-auto">
                        <code>{selectedFinding.suggestedFix.afterCode}</code>
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Prompt Bob to Fix */}
                <div>
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-600" />
                    Prompt Bob to Fix
                  </h3>
                  <div className="bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <pre className="text-xs whitespace-pre-wrap mb-3 max-h-64 overflow-y-auto">
                      {selectedFinding.bobPrompt}
                    </pre>
                    <button
                      onClick={() => copyBobPrompt(selectedFinding)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      {copiedId === selectedFinding.id ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Prompt for Bob</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Regression Test */}
                {selectedFinding.regressionTest && (
                  <div>
                    <h3 className="font-bold text-lg mb-3">Recommended Regression Test</h3>
                    <p className="text-sm text-muted-foreground mb-3">{selectedFinding.regressionTest.description}</p>
                    <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-xs overflow-x-auto">
                      <code>{selectedFinding.regressionTest.code}</code>
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-12 border-2 text-center">
                <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Select a finding to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function generateMarkdownReport(results: any): string {
  let markdown = `# ContractProof Analysis Report\n\n`;
  markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- **Total Findings**: ${results.summary.total}\n`;
  markdown += `- **Critical**: ${results.summary.critical}\n`;
  markdown += `- **High**: ${results.summary.high}\n`;
  markdown += `- **Medium**: ${results.summary.medium}\n`;
  markdown += `- **Low**: ${results.summary.low}\n\n`;
  markdown += `## Findings\n\n`;
  
  results.findings.forEach((finding: DriftFinding, index: number) => {
    markdown += `### ${index + 1}. ${finding.title}\n\n`;
    markdown += `**Severity**: ${finding.severity.toUpperCase()}\n\n`;
    markdown += `**Description**: ${finding.description}\n\n`;
    markdown += `**Impact**: ${finding.impact}\n\n`;
    markdown += `**Suggested Fix**: ${finding.suggestedFix.description}\n\n`;
    markdown += `---\n\n`;
  });
  
  return markdown;
}

// Made with Bob

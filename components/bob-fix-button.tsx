"use client";

import { useState } from "react";
import { DriftFinding } from "@/lib/types";
import { Wand2, Loader2, CheckCircle, XCircle } from "lucide-react";

interface BobFixButtonProps {
  finding: DriftFinding;
  onFixComplete?: (success: boolean) => void;
}

export function BobFixButton({ finding, onFixComplete }: BobFixButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState<"idle" | "analyzing" | "ready" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleFixClick = async () => {
    setIsAnalyzing(true);
    setStatus("analyzing");
    setError(null);

    try {
      // First, analyze the finding
      const analyzeResponse = await fetch("/api/bob-fix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "analyze",
          finding,
        }),
      });

      if (!analyzeResponse.ok) {
        throw new Error("Failed to analyze finding");
      }

      const analyzeResult = await analyzeResponse.json();

      if (!analyzeResult.success) {
        throw new Error(analyzeResult.error || "Analysis failed");
      }

      setStatus("ready");
      
      // Open preview modal (will be handled by parent component)
      if (onFixComplete) {
        onFixComplete(true);
      }
    } catch (err: any) {
      setStatus("error");
      setError(err.message);
      if (onFixComplete) {
        onFixComplete(false);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getButtonContent = () => {
    switch (status) {
      case "analyzing":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Analyzing with Bob...</span>
          </>
        );
      case "ready":
        return (
          <>
            <CheckCircle className="h-4 w-4" />
            <span>Fix Ready</span>
          </>
        );
      case "success":
        return (
          <>
            <CheckCircle className="h-4 w-4" />
            <span>Fixed!</span>
          </>
        );
      case "error":
        return (
          <>
            <XCircle className="h-4 w-4" />
            <span>Error</span>
          </>
        );
      default:
        return (
          <>
            <Wand2 className="h-4 w-4" />
            <span>Fix with Bob</span>
          </>
        );
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleFixClick}
        disabled={isAnalyzing || status === "success"}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium
          transition-colors duration-200
          ${
            status === "success"
              ? "bg-green-600 text-white cursor-not-allowed"
              : status === "error"
              ? "bg-red-600 text-white hover:bg-red-700"
              : status === "ready"
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-purple-600 text-white hover:bg-purple-700"
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {getButtonContent()}
      </button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

// Made with Bob
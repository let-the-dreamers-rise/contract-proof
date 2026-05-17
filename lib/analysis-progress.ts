// Progress tracking for repository analysis

export type AnalysisStage = 
  | "validating"
  | "cloning"
  | "scanning"
  | "analyzing_backend"
  | "analyzing_frontend"
  | "analyzing_tests"
  | "detecting_drift"
  | "complete"
  | "error";

export interface AnalysisProgress {
  stage: AnalysisStage;
  percentage: number;
  message: string;
  filesProcessed?: number;
  totalFiles?: number;
  currentFile?: string;
  error?: string;
}

export class ProgressTracker {
  private currentStage: AnalysisStage = "validating";
  private filesProcessed: number = 0;
  private totalFiles: number = 0;
  private onProgressCallback?: (progress: AnalysisProgress) => void;

  constructor(onProgress?: (progress: AnalysisProgress) => void) {
    this.onProgressCallback = onProgress;
  }

  setStage(stage: AnalysisStage, message: string) {
    this.currentStage = stage;
    const percentage = this.calculatePercentage(stage);
    this.emit({
      stage,
      percentage,
      message,
      filesProcessed: this.filesProcessed,
      totalFiles: this.totalFiles,
    });
  }

  setTotalFiles(total: number) {
    this.totalFiles = total;
    this.filesProcessed = 0;
  }

  incrementFilesProcessed(currentFile?: string) {
    this.filesProcessed++;
    const percentage = this.calculatePercentage(this.currentStage);
    this.emit({
      stage: this.currentStage,
      percentage,
      message: this.getStageMessage(this.currentStage),
      filesProcessed: this.filesProcessed,
      totalFiles: this.totalFiles,
      currentFile,
    });
  }

  setError(error: string) {
    this.emit({
      stage: "error",
      percentage: 0,
      message: "Analysis failed",
      error,
    });
  }

  complete() {
    this.emit({
      stage: "complete",
      percentage: 100,
      message: "Analysis complete!",
      filesProcessed: this.totalFiles,
      totalFiles: this.totalFiles,
    });
  }

  private calculatePercentage(stage: AnalysisStage): number {
    const stageWeights: Record<AnalysisStage, number> = {
      validating: 5,
      cloning: 15,
      scanning: 25,
      analyzing_backend: 40,
      analyzing_frontend: 60,
      analyzing_tests: 75,
      detecting_drift: 90,
      complete: 100,
      error: 0,
    };

    let basePercentage = stageWeights[stage] || 0;

    // Add progress within the current stage based on files processed
    if (this.totalFiles > 0 && this.filesProcessed > 0) {
      const nextStageWeight = this.getNextStageWeight(stage);
      const stageRange = nextStageWeight - basePercentage;
      const fileProgress = (this.filesProcessed / this.totalFiles) * stageRange;
      basePercentage += fileProgress;
    }

    return Math.min(Math.round(basePercentage), 100);
  }

  private getNextStageWeight(stage: AnalysisStage): number {
    const stageOrder: AnalysisStage[] = [
      "validating",
      "cloning",
      "scanning",
      "analyzing_backend",
      "analyzing_frontend",
      "analyzing_tests",
      "detecting_drift",
      "complete",
    ];

    const currentIndex = stageOrder.indexOf(stage);
    if (currentIndex >= 0 && currentIndex < stageOrder.length - 1) {
      const nextStage = stageOrder[currentIndex + 1];
      const weights: Record<AnalysisStage, number> = {
        validating: 5,
        cloning: 15,
        scanning: 25,
        analyzing_backend: 40,
        analyzing_frontend: 60,
        analyzing_tests: 75,
        detecting_drift: 90,
        complete: 100,
        error: 0,
      };
      return weights[nextStage] || 100;
    }
    return 100;
  }

  private getStageMessage(stage: AnalysisStage): string {
    const messages: Record<AnalysisStage, string> = {
      validating: "Validating repository...",
      cloning: "Cloning repository...",
      scanning: "Scanning files...",
      analyzing_backend: "Analyzing backend code...",
      analyzing_frontend: "Analyzing frontend code...",
      analyzing_tests: "Analyzing test files...",
      detecting_drift: "Detecting API drift...",
      complete: "Analysis complete!",
      error: "Analysis failed",
    };
    return messages[stage] || "Processing...";
  }

  private emit(progress: AnalysisProgress) {
    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }
  }
}

// Helper to create a Server-Sent Events stream
export function createProgressStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
  });

  const sendProgress = (progress: AnalysisProgress) => {
    const data = `data: ${JSON.stringify(progress)}\n\n`;
    controller.enqueue(encoder.encode(data));
  };

  const close = () => {
    controller.close();
  };

  return { stream, sendProgress, close };
}

// Made with Bob
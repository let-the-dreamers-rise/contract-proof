'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Calendar,
  Target,
  Activity,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DriftPredictor, DriftPrediction, PredictionResult } from '@/lib/ml/drift-predictor';
import { DriftFinding } from '@/lib/types';

interface DriftPredictionChartProps {
  findings: DriftFinding[];
  className?: string;
}

export function DriftPredictionChart({ findings, className = '' }: DriftPredictionChartProps) {
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPredictions, setExpandedPredictions] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Generate predictions
    const predictor = new DriftPredictor();
    
    // Load mock historical data for demo
    const historicalData = DriftPredictor.generateMockHistoricalData(50);
    predictor.loadHistoricalData(historicalData);
    
    // Set current findings
    predictor.setCurrentFindings(findings);
    
    // Generate predictions
    const result = predictor.predict();
    setPredictionResult(result);
    setLoading(false);
  }, [findings]);

  useEffect(() => {
    if (predictionResult && canvasRef.current) {
      drawTrendChart(canvasRef.current, predictionResult);
    }
  }, [predictionResult]);

  const drawTrendChart = (canvas: HTMLCanvasElement, result: PredictionResult) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Generate mock trend data for visualization
    const dataPoints = 12; // 12 months
    const historicalData = Array.from({ length: dataPoints }, (_, i) => ({
      month: i,
      value: Math.max(0, 50 + Math.random() * 30 - 15 + (i * 2)), // Slight upward trend
    }));

    // Add prediction points
    const predictionData = Array.from({ length: 3 }, (_, i) => ({
      month: dataPoints + i,
      value: historicalData[historicalData.length - 1].value + (i + 1) * (result.overallRiskScore / 20),
    }));

    const allData = [...historicalData, ...predictionData];
    const maxValue = Math.max(...allData.map(d => d.value));
    const minValue = Math.min(...allData.map(d => d.value));
    const valueRange = maxValue - minValue;

    // Draw grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height - padding * 2) * (i / 5);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw historical line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    historicalData.forEach((point, i) => {
      const x = padding + (width - padding * 2) * (point.month / (dataPoints + 2));
      const y = height - padding - (height - padding * 2) * ((point.value - minValue) / valueRange);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw prediction line (dashed)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    const lastHistorical = historicalData[historicalData.length - 1];
    const lastX = padding + (width - padding * 2) * (lastHistorical.month / (dataPoints + 2));
    const lastY = height - padding - (height - padding * 2) * ((lastHistorical.value - minValue) / valueRange);
    ctx.moveTo(lastX, lastY);
    predictionData.forEach((point) => {
      const x = padding + (width - padding * 2) * (point.month / (dataPoints + 2));
      const y = height - padding - (height - padding * 2) * ((point.value - minValue) / valueRange);
      ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw data points
    historicalData.forEach((point) => {
      const x = padding + (width - padding * 2) * (point.month / (dataPoints + 2));
      const y = height - padding - (height - padding * 2) * ((point.value - minValue) / valueRange);
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw prediction points
    predictionData.forEach((point) => {
      const x = padding + (width - padding * 2) * (point.month / (dataPoints + 2));
      const y = height - padding - (height - padding * 2) * ((point.value - minValue) / valueRange);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw labels
    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    // X-axis labels
    [0, 3, 6, 9, 12, 15].forEach((month) => {
      const x = padding + (width - padding * 2) * (month / (dataPoints + 2));
      const label = month < 12 ? `M${month + 1}` : `+${month - 11}`;
      ctx.fillText(label, x, height - padding + 20);
    });

    // Y-axis label
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Drift Count', 0, 0);
    ctx.restore();

    // Legend
    ctx.textAlign = 'left';
    const legendY = padding - 10;
    
    // Historical
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(width - 200, legendY, 20, 3);
    ctx.fillStyle = '#64748b';
    ctx.fillText('Historical', width - 175, legendY + 5);
    
    // Predicted
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(width - 90, legendY, 20, 3);
    ctx.fillStyle = '#64748b';
    ctx.fillText('Predicted', width - 65, legendY + 5);
  };

  const togglePrediction = (id: string) => {
    const newExpanded = new Set(expandedPredictions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedPredictions(newExpanded);
  };

  const getRiskColor = (type: string) => {
    switch (type) {
      case 'high_risk':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium_risk':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low_risk':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5" />
          <h3 className="text-lg font-semibold">ML Drift Prediction</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">Analyzing patterns...</p>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!predictionResult) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Risk Score */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Predictive Risk Analysis</h3>
          </div>
          <p className="text-sm text-gray-600">
            ML-powered predictions based on historical patterns and current drift
          </p>
        </div>

        <div className="space-y-6">
          {/* Risk Score Display */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Overall Risk Score</p>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold">{predictionResult.overallRiskScore}</span>
                <span className="text-2xl text-gray-400">/100</span>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-lg border-2 ${getRiskLevelColor(predictionResult.riskLevel)}`}>
              <p className="text-sm font-medium uppercase">{predictionResult.riskLevel} Risk</p>
            </div>
          </div>

          {/* Risk Bar */}
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  predictionResult.riskLevel === 'critical'
                    ? 'bg-red-500'
                    : predictionResult.riskLevel === 'high'
                    ? 'bg-orange-500'
                    : predictionResult.riskLevel === 'medium'
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${predictionResult.overallRiskScore}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
              <span>Critical</span>
            </div>
          </div>

          {/* Next Review Date */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Next recommended review:</span>
            <span className="font-medium">
              {predictionResult.nextReviewDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Trend Chart */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Drift Trend & Prediction</h4>
            <canvas
              ref={canvasRef}
              className="w-full h-64 border rounded-lg bg-white"
              style={{ width: '100%', height: '256px' }}
            />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {predictionResult.recommendations.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="font-medium text-yellow-900">Recommended Actions:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                {predictionResult.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Predictions List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5" />
            <h3 className="text-lg font-semibold">
              Predicted Drift Issues ({predictionResult.predictions.length})
            </h3>
          </div>
          <p className="text-sm text-gray-600">
            Potential issues that may occur based on pattern analysis
          </p>
        </div>

        <div className="space-y-3">
          {predictionResult.predictions.map((prediction) => (
            <div
              key={prediction.id}
              className="border rounded-lg p-4 space-y-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getRiskColor(prediction.type)}`}>
                      {prediction.type.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-medium">{prediction.title}</span>
                  </div>
                  <p className="text-sm text-gray-600">{prediction.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      <span>Probability: {(prediction.probability * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{prediction.estimatedTimeframe}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => togglePrediction(prediction.id)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  {expandedPredictions.has(prediction.id) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>

              {expandedPredictions.has(prediction.id) && (
                <div className="space-y-3 pt-3 border-t">
                  {prediction.affectedEndpoints.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Affected Endpoints:</p>
                      <div className="flex flex-wrap gap-1">
                        {prediction.affectedEndpoints.map((endpoint, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs"
                          >
                            {endpoint}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {prediction.affectedFiles.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Affected Files:</p>
                      <div className="flex flex-wrap gap-1">
                        {prediction.affectedFiles.map((file, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono"
                          >
                            {file}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium mb-2">Prevention Steps:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-gray-600">
                      {prediction.preventionSteps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}

          {predictionResult.predictions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <TrendingDown className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No significant drift predictions at this time</p>
              <p className="text-sm">Keep up the good work!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Made with Bob

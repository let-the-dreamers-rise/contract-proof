/**
 * ML-Based Drift Predictor
 * Predicts future drift issues based on historical patterns and current code analysis
 */

import { DriftFinding } from '../types';
import { PatternAnalyzer, HistoricalDrift, DriftPattern } from './pattern-analyzer';

export interface DriftPrediction {
  id: string;
  type: 'high_risk' | 'medium_risk' | 'low_risk';
  title: string;
  description: string;
  probability: number; // 0-1
  estimatedTimeframe: string; // e.g., "within 7 days", "within 30 days"
  affectedEndpoints: string[];
  affectedFiles: string[];
  preventionSteps: string[];
  relatedPatterns: string[]; // Pattern IDs
  confidence: number; // 0-1
}

export interface PredictionResult {
  predictions: DriftPrediction[];
  overallRiskScore: number; // 0-100
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  recommendations: string[];
  nextReviewDate: Date;
}

export class DriftPredictor {
  private patternAnalyzer: PatternAnalyzer;
  private currentFindings: DriftFinding[] = [];

  constructor() {
    this.patternAnalyzer = new PatternAnalyzer();
  }

  /**
   * Load historical drift data for analysis
   */
  loadHistoricalData(data: HistoricalDrift[]): void {
    this.patternAnalyzer.addHistoricalData(data);
  }

  /**
   * Set current drift findings for context
   */
  setCurrentFindings(findings: DriftFinding[]): void {
    this.currentFindings = findings;
  }

  /**
   * Generate drift predictions
   */
  predict(): PredictionResult {
    const analysis = this.patternAnalyzer.getAnalysis();
    const predictions: DriftPrediction[] = [];

    // Generate predictions from patterns
    for (const pattern of analysis.patterns) {
      const prediction = this.generatePredictionFromPattern(pattern);
      if (prediction) {
        predictions.push(prediction);
      }
    }

    // Generate predictions from current findings
    const currentPredictions = this.generatePredictionsFromCurrentFindings();
    predictions.push(...currentPredictions);

    // Generate predictions from trend analysis
    const trendPredictions = this.generatePredictionsFromTrends(analysis.trendData);
    predictions.push(...trendPredictions);

    // Sort by probability (highest first)
    predictions.sort((a, b) => b.probability - a.probability);

    // Calculate overall risk
    const overallRiskScore = this.calculateOverallRisk(predictions, analysis.riskScore);
    const riskLevel = this.getRiskLevel(overallRiskScore);

    // Generate recommendations
    const recommendations = this.generateRecommendations(predictions, analysis.recommendations);

    // Calculate next review date
    const nextReviewDate = this.calculateNextReviewDate(overallRiskScore);

    return {
      predictions: predictions.slice(0, 10), // Top 10 predictions
      overallRiskScore,
      riskLevel,
      recommendations,
      nextReviewDate,
    };
  }

  /**
   * Generate prediction from a detected pattern
   */
  private generatePredictionFromPattern(pattern: DriftPattern): DriftPrediction | null {
    switch (pattern.type) {
      case 'recurring':
        return this.generateRecurringPrediction(pattern);
      case 'trending':
        return this.generateTrendingPrediction(pattern);
      case 'correlated':
        return this.generateCorrelatedPrediction(pattern);
      case 'seasonal':
        return this.generateSeasonalPrediction(pattern);
      default:
        return null;
    }
  }

  /**
   * Generate prediction for recurring patterns
   */
  private generateRecurringPrediction(pattern: DriftPattern): DriftPrediction {
    const daysSinceLastOccurrence = Math.floor(
      (Date.now() - pattern.lastOccurrence.getTime()) / (1000 * 60 * 60 * 24)
    );

    let probability = pattern.confidence;
    let timeframe = 'within 30 days';

    if (pattern.predictedNextOccurrence) {
      const daysUntilNext = Math.floor(
        (pattern.predictedNextOccurrence.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilNext <= 7) {
        probability = Math.min(0.95, probability + 0.2);
        timeframe = 'within 7 days';
      } else if (daysUntilNext <= 14) {
        probability = Math.min(0.9, probability + 0.1);
        timeframe = 'within 14 days';
      } else if (daysUntilNext <= 30) {
        timeframe = 'within 30 days';
      } else {
        timeframe = `within ${Math.ceil(daysUntilNext / 30)} months`;
      }
    }

    const riskType = probability > 0.7 ? 'high_risk' : probability > 0.4 ? 'medium_risk' : 'low_risk';

    return {
      id: `pred-${pattern.id}`,
      type: riskType,
      title: `Recurring drift likely to reoccur`,
      description: `${pattern.description} This pattern has occurred ${pattern.frequency} times. Based on historical data, it's likely to happen again ${timeframe}.`,
      probability,
      estimatedTimeframe: timeframe,
      affectedEndpoints: pattern.affectedEndpoints,
      affectedFiles: pattern.affectedFiles,
      preventionSteps: [
        'Add automated validation tests for this endpoint',
        'Set up monitoring alerts for related API changes',
        'Document the pattern in team knowledge base',
        'Consider refactoring to prevent recurrence',
      ],
      relatedPatterns: [pattern.id],
      confidence: pattern.confidence,
    };
  }

  /**
   * Generate prediction for trending patterns
   */
  private generateTrendingPrediction(pattern: DriftPattern): DriftPrediction {
    const probability = Math.min(0.9, pattern.confidence + 0.1);

    return {
      id: `pred-${pattern.id}`,
      type: 'high_risk',
      title: `Increasing drift trend detected`,
      description: `${pattern.description} The frequency is increasing over time, suggesting systemic issues that need attention.`,
      probability,
      estimatedTimeframe: 'within 14 days',
      affectedEndpoints: pattern.affectedEndpoints,
      affectedFiles: pattern.affectedFiles,
      preventionSteps: [
        'Review recent code changes in affected areas',
        'Conduct team discussion on API design practices',
        'Implement stricter code review for API changes',
        'Add pre-commit hooks for API validation',
      ],
      relatedPatterns: [pattern.id],
      confidence: pattern.confidence,
    };
  }

  /**
   * Generate prediction for correlated patterns
   */
  private generateCorrelatedPrediction(pattern: DriftPattern): DriftPrediction {
    return {
      id: `pred-${pattern.id}`,
      type: 'medium_risk',
      title: `Correlated drifts may occur together`,
      description: `${pattern.description} When one occurs, the other is likely to follow within 24 hours.`,
      probability: pattern.confidence,
      estimatedTimeframe: 'when related drift occurs',
      affectedEndpoints: pattern.affectedEndpoints,
      affectedFiles: pattern.affectedFiles,
      preventionSteps: [
        'Fix both issues together as a group',
        'Review dependencies between affected endpoints',
        'Add integration tests covering both scenarios',
        'Document the correlation for future reference',
      ],
      relatedPatterns: [pattern.id],
      confidence: pattern.confidence,
    };
  }

  /**
   * Generate prediction for seasonal patterns
   */
  private generateSeasonalPrediction(pattern: DriftPattern): DriftPrediction {
    return {
      id: `pred-${pattern.id}`,
      type: 'low_risk',
      title: `Seasonal drift pattern detected`,
      description: `${pattern.description} Consider scheduling preventive reviews before these times.`,
      probability: pattern.confidence,
      estimatedTimeframe: 'on scheduled cycle',
      affectedEndpoints: pattern.affectedEndpoints,
      affectedFiles: pattern.affectedFiles,
      preventionSteps: [
        'Schedule preventive code reviews before peak times',
        'Add calendar reminders for team',
        'Investigate root cause of seasonal pattern',
        'Consider automated checks during these periods',
      ],
      relatedPatterns: [pattern.id],
      confidence: pattern.confidence,
    };
  }

  /**
   * Generate predictions from current unresolved findings
   */
  private generatePredictionsFromCurrentFindings(): DriftPrediction[] {
    const predictions: DriftPrediction[] = [];

    // Group findings by severity
    const criticalFindings = this.currentFindings.filter(f => f.severity === 'critical');
    const highFindings = this.currentFindings.filter(f => f.severity === 'high');

    // Critical findings are likely to cause more drift
    if (criticalFindings.length > 0) {
      predictions.push({
        id: 'pred-current-critical',
        type: 'high_risk',
        title: `${criticalFindings.length} critical drift(s) may cascade`,
        description: `Unresolved critical drifts often lead to additional issues as developers work around them. Immediate action recommended.`,
        probability: 0.85,
        estimatedTimeframe: 'within 7 days',
        affectedEndpoints: criticalFindings.flatMap(f => f.backend?.path ? [f.backend.path] : []),
        affectedFiles: criticalFindings.flatMap(f => 
          [f.backend?.location.file, f.frontend?.[0]?.location.file].filter(Boolean) as string[]
        ),
        preventionSteps: [
          'Fix critical drifts immediately',
          'Block new features until resolved',
          'Add regression tests',
          'Review related code for similar issues',
        ],
        relatedPatterns: [],
        confidence: 0.85,
      });
    }

    // High severity findings
    if (highFindings.length >= 3) {
      predictions.push({
        id: 'pred-current-high',
        type: 'medium_risk',
        title: `Multiple high-severity drifts accumulating`,
        description: `${highFindings.length} high-severity drifts are accumulating. This technical debt will become harder to fix over time.`,
        probability: 0.7,
        estimatedTimeframe: 'within 14 days',
        affectedEndpoints: highFindings.flatMap(f => f.backend?.path ? [f.backend.path] : []),
        affectedFiles: highFindings.flatMap(f => 
          [f.backend?.location.file, f.frontend?.[0]?.location.file].filter(Boolean) as string[]
        ),
        preventionSteps: [
          'Prioritize fixing high-severity drifts',
          'Allocate dedicated time for technical debt',
          'Improve API change communication',
          'Enhance testing coverage',
        ],
        relatedPatterns: [],
        confidence: 0.7,
      });
    }

    return predictions;
  }

  /**
   * Generate predictions from trend analysis
   */
  private generatePredictionsFromTrends(trendData: any[]): DriftPrediction[] {
    const predictions: DriftPrediction[] = [];

    if (trendData.length < 3) return predictions;

    // Calculate trend direction
    const recentData = trendData.slice(-3);
    const counts = recentData.map(d => d.driftCount);
    const isIncreasing = counts[2] > counts[1] && counts[1] > counts[0];
    const isDecreasing = counts[2] < counts[1] && counts[1] < counts[0];

    if (isIncreasing) {
      const increaseRate = ((counts[2] - counts[0]) / counts[0]) * 100;

      predictions.push({
        id: 'pred-trend-increasing',
        type: 'high_risk',
        title: `Drift rate increasing by ${increaseRate.toFixed(0)}%`,
        description: `The number of drifts is trending upward. This suggests process or communication issues that need addressing.`,
        probability: 0.8,
        estimatedTimeframe: 'ongoing',
        affectedEndpoints: [],
        affectedFiles: [],
        preventionSteps: [
          'Review team processes and communication',
          'Increase API change visibility',
          'Implement mandatory API design reviews',
          'Enhance developer training on API contracts',
        ],
        relatedPatterns: [],
        confidence: 0.75,
      });
    } else if (isDecreasing) {
      // Positive trend - still mention for awareness
      predictions.push({
        id: 'pred-trend-decreasing',
        type: 'low_risk',
        title: `Drift rate decreasing - good progress`,
        description: `The number of drifts is trending downward. Continue current practices to maintain this improvement.`,
        probability: 0.3,
        estimatedTimeframe: 'ongoing',
        affectedEndpoints: [],
        affectedFiles: [],
        preventionSteps: [
          'Document what\'s working well',
          'Share best practices with team',
          'Maintain current review processes',
          'Continue monitoring trends',
        ],
        relatedPatterns: [],
        confidence: 0.7,
      });
    }

    // Check resolution time trends
    const avgResolutionTimes = recentData.map(d => d.averageResolutionTime);
    const resolutionTimeIncreasing = avgResolutionTimes[2] > avgResolutionTimes[0] * 1.5;

    if (resolutionTimeIncreasing) {
      predictions.push({
        id: 'pred-resolution-time',
        type: 'medium_risk',
        title: `Drift resolution time increasing`,
        description: `It's taking longer to fix drifts. This may indicate growing complexity or resource constraints.`,
        probability: 0.65,
        estimatedTimeframe: 'ongoing',
        affectedEndpoints: [],
        affectedFiles: [],
        preventionSteps: [
          'Investigate why fixes are taking longer',
          'Consider allocating more resources',
          'Simplify fix processes where possible',
          'Improve documentation and tooling',
        ],
        relatedPatterns: [],
        confidence: 0.65,
      });
    }

    return predictions;
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallRisk(predictions: DriftPrediction[], patternRiskScore: number): number {
    if (predictions.length === 0) return patternRiskScore;

    // Weight predictions by probability and type
    const predictionRisk = predictions.reduce((sum, pred) => {
      const typeWeight = pred.type === 'high_risk' ? 3 : pred.type === 'medium_risk' ? 2 : 1;
      return sum + (pred.probability * typeWeight * 10);
    }, 0);

    // Combine with pattern risk score (60/40 split)
    return Math.min(100, Math.round(patternRiskScore * 0.6 + predictionRisk * 0.4));
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(predictions: DriftPrediction[], patternRecommendations: string[]): string[] {
    const recommendations = [...patternRecommendations];

    // Add prediction-specific recommendations
    const highRiskPredictions = predictions.filter(p => p.type === 'high_risk');
    if (highRiskPredictions.length > 0) {
      recommendations.push(
        `🚨 ${highRiskPredictions.length} high-risk prediction(s) require immediate attention`
      );
    }

    // Add proactive recommendations
    if (predictions.length >= 5) {
      recommendations.push(
        '📋 Consider implementing a formal API change management process'
      );
    }

    // Add tooling recommendations
    const recurringPredictions = predictions.filter(p => p.relatedPatterns.some(id => id.includes('recurring')));
    if (recurringPredictions.length >= 2) {
      recommendations.push(
        '🔧 Automate detection and prevention of recurring patterns'
      );
    }

    return recommendations;
  }

  /**
   * Calculate next recommended review date
   */
  private calculateNextReviewDate(riskScore: number): Date {
    const now = new Date();
    let daysUntilReview: number;

    if (riskScore >= 80) {
      daysUntilReview = 1; // Daily for critical
    } else if (riskScore >= 60) {
      daysUntilReview = 3; // Every 3 days for high
    } else if (riskScore >= 40) {
      daysUntilReview = 7; // Weekly for medium
    } else {
      daysUntilReview = 14; // Bi-weekly for low
    }

    now.setDate(now.getDate() + daysUntilReview);
    return now;
  }

  /**
   * Generate mock historical data for demo purposes
   */
  static generateMockHistoricalData(count: number = 50): HistoricalDrift[] {
    const data: HistoricalDrift[] = [];
    const now = Date.now();
    const endpoints = ['/api/orders', '/api/users', '/api/products', '/api/payments'];
    const severities: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];

    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(Math.random() * 90); // Last 90 days
      const timestamp = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const severity = severities[Math.floor(Math.random() * severities.length)];
      const resolved = Math.random() > 0.3; // 70% resolved

      data.push({
        timestamp,
        drift: {
          id: `mock-${i}`,
          severity,
          title: `Mock drift in ${endpoint}`,
          description: `Test drift for pattern analysis`,
          impact: 'Mock impact',
          backend: {
            path: endpoint,
            method: 'GET',
            location: {
              file: `src/api${endpoint}.ts`,
              line: Math.floor(Math.random() * 100),
              code: 'mock code',
            },
            type: 'backend',
          },
          suggestedFix: {
            description: 'Mock fix',
            beforeCode: 'before',
            afterCode: 'after',
            files: [`src/api${endpoint}.ts`],
          },
          bobPrompt: 'Mock prompt',
        },
        resolved,
        resolutionTime: resolved ? Math.floor(Math.random() * 120) + 10 : undefined,
      });
    }

    return data;
  }
}

// Made with Bob

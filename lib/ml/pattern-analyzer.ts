/**
 * Pattern Analyzer for ML-Based Drift Prediction
 * Analyzes historical drift patterns to predict future issues
 */

import { DriftFinding } from '../types';

export interface DriftPattern {
  id: string;
  type: 'recurring' | 'trending' | 'seasonal' | 'correlated';
  description: string;
  frequency: number;
  confidence: number;
  affectedEndpoints: string[];
  affectedFiles: string[];
  lastOccurrence: Date;
  predictedNextOccurrence?: Date;
}

export interface HistoricalDrift {
  timestamp: Date;
  drift: DriftFinding;
  resolved: boolean;
  resolutionTime?: number; // in minutes
}

export interface PatternAnalysisResult {
  patterns: DriftPattern[];
  riskScore: number;
  recommendations: string[];
  trendData: TrendDataPoint[];
}

export interface TrendDataPoint {
  date: Date;
  driftCount: number;
  criticalCount: number;
  resolvedCount: number;
  averageResolutionTime: number;
}

export class PatternAnalyzer {
  private historicalData: HistoricalDrift[] = [];
  private patterns: DriftPattern[] = [];

  /**
   * Add historical drift data for analysis
   */
  addHistoricalData(data: HistoricalDrift[]): void {
    this.historicalData.push(...data);
    this.analyzePatterns();
  }

  /**
   * Analyze patterns in historical drift data
   */
  private analyzePatterns(): void {
    this.patterns = [];

    // Detect recurring patterns
    this.detectRecurringPatterns();

    // Detect trending patterns
    this.detectTrendingPatterns();

    // Detect correlated patterns
    this.detectCorrelatedPatterns();

    // Detect seasonal patterns
    this.detectSeasonalPatterns();
  }

  /**
   * Detect recurring drift patterns (same issue appearing multiple times)
   */
  private detectRecurringPatterns(): void {
    const issueMap = new Map<string, HistoricalDrift[]>();

    // Group drifts by similar characteristics
    for (const item of this.historicalData) {
      const key = this.generateIssueKey(item.drift);
      if (!issueMap.has(key)) {
        issueMap.set(key, []);
      }
      issueMap.get(key)!.push(item);
    }

    // Find recurring patterns (appeared 3+ times)
    for (const [key, occurrences] of issueMap.entries()) {
      if (occurrences.length >= 3) {
        const lastOccurrence = occurrences[occurrences.length - 1];
        const avgTimeBetween = this.calculateAverageTimeBetween(occurrences);

        this.patterns.push({
          id: `recurring-${key}`,
          type: 'recurring',
          description: `Recurring drift: ${lastOccurrence.drift.title}`,
          frequency: occurrences.length,
          confidence: Math.min(0.95, 0.6 + (occurrences.length * 0.05)),
          affectedEndpoints: this.extractEndpoints(occurrences),
          affectedFiles: this.extractFiles(occurrences),
          lastOccurrence: lastOccurrence.timestamp,
          predictedNextOccurrence: this.predictNextOccurrence(lastOccurrence.timestamp, avgTimeBetween),
        });
      }
    }
  }

  /**
   * Detect trending patterns (increasing frequency over time)
   */
  private detectTrendingPatterns(): void {
    const recentData = this.getRecentData(90); // Last 90 days
    const monthlyGroups = this.groupByMonth(recentData);

    if (monthlyGroups.length < 2) return;

    // Calculate trend
    const counts = monthlyGroups.map(g => g.length);
    const trend = this.calculateTrend(counts);

    if (trend > 0.2) { // 20% increase trend
      const commonIssues = this.findCommonIssues(recentData);

      for (const issue of commonIssues) {
        this.patterns.push({
          id: `trending-${issue.key}`,
          type: 'trending',
          description: `Increasing trend: ${issue.description}`,
          frequency: issue.count,
          confidence: Math.min(0.9, 0.5 + trend),
          affectedEndpoints: issue.endpoints,
          affectedFiles: issue.files,
          lastOccurrence: issue.lastSeen,
        });
      }
    }
  }

  /**
   * Detect correlated patterns (drifts that occur together)
   */
  private detectCorrelatedPatterns(): void {
    const timeWindow = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Find drifts that occur within the same time window
    const correlations = new Map<string, Set<string>>();

    for (let i = 0; i < this.historicalData.length; i++) {
      const drift1 = this.historicalData[i];
      const key1 = this.generateIssueKey(drift1.drift);

      for (let j = i + 1; j < this.historicalData.length; j++) {
        const drift2 = this.historicalData[j];
        const timeDiff = Math.abs(drift2.timestamp.getTime() - drift1.timestamp.getTime());

        if (timeDiff <= timeWindow) {
          const key2 = this.generateIssueKey(drift2.drift);
          const correlationKey = [key1, key2].sort().join('|');

          if (!correlations.has(correlationKey)) {
            correlations.set(correlationKey, new Set());
          }
          correlations.get(correlationKey)!.add(drift1.timestamp.toISOString());
        }
      }
    }

    // Find significant correlations (occurred together 3+ times)
    for (const [keys, occurrences] of correlations.entries()) {
      if (occurrences.size >= 3) {
        const [key1, key2] = keys.split('|');
        const drift1 = this.historicalData.find(d => this.generateIssueKey(d.drift) === key1);
        const drift2 = this.historicalData.find(d => this.generateIssueKey(d.drift) === key2);

        if (drift1 && drift2) {
          this.patterns.push({
            id: `correlated-${keys}`,
            type: 'correlated',
            description: `Correlated drifts: "${drift1.drift.title}" often occurs with "${drift2.drift.title}"`,
            frequency: occurrences.size,
            confidence: Math.min(0.85, 0.5 + (occurrences.size * 0.1)),
            affectedEndpoints: [
              ...(drift1.drift.backend?.path ? [drift1.drift.backend.path] : []),
              ...(drift2.drift.backend?.path ? [drift2.drift.backend.path] : []),
            ],
            affectedFiles: [
              ...(drift1.drift.backend?.location.file ? [drift1.drift.backend.location.file] : []),
              ...(drift2.drift.backend?.location.file ? [drift2.drift.backend.location.file] : []),
            ],
            lastOccurrence: new Date(Math.max(drift1.timestamp.getTime(), drift2.timestamp.getTime())),
          });
        }
      }
    }
  }

  /**
   * Detect seasonal patterns (weekly/monthly cycles)
   */
  private detectSeasonalPatterns(): void {
    if (this.historicalData.length < 30) return; // Need at least 30 data points

    const dayOfWeekCounts = new Array(7).fill(0);
    const dayOfMonthCounts = new Array(31).fill(0);

    for (const item of this.historicalData) {
      const date = item.timestamp;
      dayOfWeekCounts[date.getDay()]++;
      dayOfMonthCounts[date.getDate() - 1]++;
    }

    // Check for weekly patterns
    const maxDayOfWeek = Math.max(...dayOfWeekCounts);
    const avgDayOfWeek = dayOfWeekCounts.reduce((a, b) => a + b, 0) / 7;

    if (maxDayOfWeek > avgDayOfWeek * 1.5) {
      const peakDay = dayOfWeekCounts.indexOf(maxDayOfWeek);
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      this.patterns.push({
        id: `seasonal-weekly-${peakDay}`,
        type: 'seasonal',
        description: `Drift spikes on ${dayNames[peakDay]}s (${maxDayOfWeek} occurrences vs ${avgDayOfWeek.toFixed(1)} average)`,
        frequency: maxDayOfWeek,
        confidence: 0.7,
        affectedEndpoints: [],
        affectedFiles: [],
        lastOccurrence: this.getLastOccurrenceOnDay(peakDay),
      });
    }

    // Check for monthly patterns
    const maxDayOfMonth = Math.max(...dayOfMonthCounts);
    const avgDayOfMonth = dayOfMonthCounts.reduce((a, b) => a + b, 0) / 31;

    if (maxDayOfMonth > avgDayOfMonth * 1.5) {
      const peakDate = dayOfMonthCounts.indexOf(maxDayOfMonth) + 1;

      this.patterns.push({
        id: `seasonal-monthly-${peakDate}`,
        type: 'seasonal',
        description: `Drift spikes on day ${peakDate} of the month (${maxDayOfMonth} occurrences vs ${avgDayOfMonth.toFixed(1)} average)`,
        frequency: maxDayOfMonth,
        confidence: 0.65,
        affectedEndpoints: [],
        affectedFiles: [],
        lastOccurrence: this.getLastOccurrenceOnDate(peakDate),
      });
    }
  }

  /**
   * Get pattern analysis results
   */
  getAnalysis(): PatternAnalysisResult {
    const riskScore = this.calculateRiskScore();
    const recommendations = this.generateRecommendations();
    const trendData = this.generateTrendData();

    return {
      patterns: this.patterns,
      riskScore,
      recommendations,
      trendData,
    };
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private calculateRiskScore(): number {
    if (this.historicalData.length === 0) return 0;

    const recentData = this.getRecentData(30); // Last 30 days
    const recentCount = recentData.length;
    const unresolvedCount = recentData.filter(d => !d.resolved).length;
    const criticalCount = recentData.filter(d => d.drift.severity === 'critical').length;

    // Calculate trend
    const monthlyGroups = this.groupByMonth(this.getRecentData(90));
    const trend = monthlyGroups.length >= 2 ? this.calculateTrend(monthlyGroups.map(g => g.length)) : 0;

    // Risk factors
    const volumeRisk = Math.min(40, recentCount * 2); // Max 40 points
    const unresolvedRisk = Math.min(30, unresolvedCount * 3); // Max 30 points
    const criticalRisk = Math.min(20, criticalCount * 5); // Max 20 points
    const trendRisk = Math.min(10, trend * 50); // Max 10 points

    return Math.min(100, volumeRisk + unresolvedRisk + criticalRisk + trendRisk);
  }

  /**
   * Generate recommendations based on patterns
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Recurring patterns
    const recurringPatterns = this.patterns.filter(p => p.type === 'recurring');
    if (recurringPatterns.length > 0) {
      recommendations.push(
        `🔄 ${recurringPatterns.length} recurring drift pattern(s) detected. Consider adding automated tests or validation rules.`
      );
    }

    // Trending patterns
    const trendingPatterns = this.patterns.filter(p => p.type === 'trending');
    if (trendingPatterns.length > 0) {
      recommendations.push(
        `📈 ${trendingPatterns.length} increasing trend(s) detected. Review recent code changes and API design decisions.`
      );
    }

    // Correlated patterns
    const correlatedPatterns = this.patterns.filter(p => p.type === 'correlated');
    if (correlatedPatterns.length > 0) {
      recommendations.push(
        `🔗 ${correlatedPatterns.length} correlated drift pattern(s) found. These issues often occur together - fix them as a group.`
      );
    }

    // Seasonal patterns
    const seasonalPatterns = this.patterns.filter(p => p.type === 'seasonal');
    if (seasonalPatterns.length > 0) {
      recommendations.push(
        `📅 ${seasonalPatterns.length} seasonal pattern(s) detected. Schedule preventive reviews before peak times.`
      );
    }

    // High risk score
    const riskScore = this.calculateRiskScore();
    if (riskScore > 70) {
      recommendations.push(
        `⚠️ High risk score (${riskScore}/100). Immediate action recommended to prevent production incidents.`
      );
    } else if (riskScore > 40) {
      recommendations.push(
        `⚡ Moderate risk score (${riskScore}/100). Consider increasing code review rigor for API changes.`
      );
    }

    // Unresolved drifts
    const unresolvedCount = this.getRecentData(30).filter(d => !d.resolved).length;
    if (unresolvedCount > 5) {
      recommendations.push(
        `🔧 ${unresolvedCount} unresolved drifts in the last 30 days. Prioritize fixing these to reduce technical debt.`
      );
    }

    return recommendations;
  }

  /**
   * Generate trend data for visualization
   */
  private generateTrendData(): TrendDataPoint[] {
    const data: TrendDataPoint[] = [];
    const monthlyGroups = this.groupByMonth(this.historicalData);

    for (const group of monthlyGroups) {
      const criticalCount = group.filter(d => d.drift.severity === 'critical').length;
      const resolvedCount = group.filter(d => d.resolved).length;
      const resolutionTimes = group
        .filter(d => d.resolved && d.resolutionTime)
        .map(d => d.resolutionTime!);
      const avgResolutionTime = resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : 0;

      data.push({
        date: group[0].timestamp,
        driftCount: group.length,
        criticalCount,
        resolvedCount,
        averageResolutionTime: avgResolutionTime,
      });
    }

    return data;
  }

  // Helper methods

  private generateIssueKey(drift: DriftFinding): string {
    const endpoint = drift.backend?.path || 'unknown';
    return `${drift.severity}-${endpoint}-${drift.title}`;
  }

  private extractEndpoints(occurrences: HistoricalDrift[]): string[] {
    return [...new Set(occurrences.map(o => o.drift.backend?.path).filter(Boolean) as string[])];
  }

  private extractFiles(occurrences: HistoricalDrift[]): string[] {
    const files = new Set<string>();
    for (const o of occurrences) {
      if (o.drift.backend?.location.file) files.add(o.drift.backend.location.file);
      if (o.drift.frontend?.[0]?.location.file) files.add(o.drift.frontend[0].location.file);
    }
    return [...files];
  }

  private calculateAverageTimeBetween(occurrences: HistoricalDrift[]): number {
    if (occurrences.length < 2) return 0;

    const times = occurrences.map(o => o.timestamp.getTime()).sort((a, b) => a - b);
    const diffs = [];

    for (let i = 1; i < times.length; i++) {
      diffs.push(times[i] - times[i - 1]);
    }

    return diffs.reduce((a, b) => a + b, 0) / diffs.length;
  }

  private predictNextOccurrence(lastOccurrence: Date, avgTimeBetween: number): Date | undefined {
    if (avgTimeBetween === 0) return undefined;
    return new Date(lastOccurrence.getTime() + avgTimeBetween);
  }

  private getRecentData(days: number): HistoricalDrift[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return this.historicalData.filter(d => d.timestamp >= cutoff);
  }

  private groupByMonth(data: HistoricalDrift[]): HistoricalDrift[][] {
    const groups = new Map<string, HistoricalDrift[]>();

    for (const item of data) {
      const key = `${item.timestamp.getFullYear()}-${item.timestamp.getMonth()}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    return Array.from(groups.values()).sort((a, b) => 
      a[0].timestamp.getTime() - b[0].timestamp.getTime()
    );
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    // Simple linear regression
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;

    return avgY > 0 ? slope / avgY : 0; // Normalized slope
  }

  private findCommonIssues(data: HistoricalDrift[]): Array<{
    key: string;
    description: string;
    count: number;
    endpoints: string[];
    files: string[];
    lastSeen: Date;
  }> {
    const issueMap = new Map<string, HistoricalDrift[]>();

    for (const item of data) {
      const key = this.generateIssueKey(item.drift);
      if (!issueMap.has(key)) {
        issueMap.set(key, []);
      }
      issueMap.get(key)!.push(item);
    }

    return Array.from(issueMap.entries())
      .filter(([_, occurrences]) => occurrences.length >= 2)
      .map(([key, occurrences]) => ({
        key,
        description: occurrences[0].drift.description,
        count: occurrences.length,
        endpoints: this.extractEndpoints(occurrences),
        files: this.extractFiles(occurrences),
        lastSeen: occurrences[occurrences.length - 1].timestamp,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5
  }

  private getLastOccurrenceOnDay(dayOfWeek: number): Date {
    const matching = this.historicalData.filter(d => d.timestamp.getDay() === dayOfWeek);
    return matching.length > 0
      ? matching[matching.length - 1].timestamp
      : new Date();
  }

  private getLastOccurrenceOnDate(dayOfMonth: number): Date {
    const matching = this.historicalData.filter(d => d.timestamp.getDate() === dayOfMonth);
    return matching.length > 0
      ? matching[matching.length - 1].timestamp
      : new Date();
  }
}

// Made with Bob

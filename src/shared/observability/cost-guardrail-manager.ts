/**
 *
 *
 * 4
 * 01SLO03
 */

// SLO01
export interface SLOTargets {
  // UI
  uiResponseTime: {
    target: number; // TP95  16ms
    warning: number; //
    critical: number; //
  };

  //
  eventProcessingDelay: {
    target: number; // TP95  50ms
    warning: number;
    critical: number;
  };

  //
  crashFreeSessionsRate: {
    target: number; // 99.5%
    warning: number; // 99.0%
    critical: number; // 98.0%
  };

  //
  memoryUsage: {
    target: number; // < 300MB
    warning: number; // 350MB
    critical: number; // 400MB
  };

  // CPU
  cpuUsage: {
    target: number; // < 15%
    warning: number; // 30%
    critical: number; // 50%
  };
}

//
export interface CostTargets {
  // GB
  monthlyDataIngestion: {
    budget: number;
    warning: number; // 80%
    critical: number; // 95%
  };

  //
  dailyEventCount: {
    budget: number;
    warning: number;
    critical: number;
  };

  // GB
  storageRetention: {
    budget: number;
    dataRetentionDays: number;
  };
}

//
export interface DynamicSamplingStrategy {
  //
  baseSampleRate: number;

  //
  environmentMultipliers: {
    production: number;
    staging: number;
    development: number;
  };

  // SLO
  sloComplianceFunction: (sloScore: number) => number;

  //
  costControlFunction: (costUtilization: number) => number;

  //
  criticalTransactionSampling: {
    transactions: string[];
    minSampleRate: number;
  };
}

/**
 * SLO
 */
export class SLOScoreCalculator {
  private sloTargets: SLOTargets;

  constructor(targets: SLOTargets) {
    this.sloTargets = targets;
  }

  /**
   * SLO (0-100)
   */
  calculateOverallScore(metrics: PerformanceMetrics): number {
    const scores = [
      this.calculateUIResponseScore(metrics.uiResponseTime),
      this.calculateEventProcessingScore(metrics.eventProcessingDelay),
      this.calculateCrashFreeScore(metrics.crashFreeSessionsRate),
      this.calculateMemoryScore(metrics.memoryUsage),
      this.calculateCPUScore(metrics.cpuUsage),
    ];

    // UI
    const weights = [0.3, 0.2, 0.3, 0.1, 0.1];
    const weightedSum = scores.reduce(
      (sum, score, index) => sum + score * weights[index],
      0
    );

    return Math.round(weightedSum);
  }

  /**
   * UI
   */
  private calculateUIResponseScore(actual: number): number {
    const { target, warning, critical } = this.sloTargets.uiResponseTime;

    if (actual <= target) return 100;
    if (actual <= warning)
      return this.linearScore(actual, target, warning, 100, 80);
    if (actual <= critical)
      return this.linearScore(actual, warning, critical, 80, 50);
    return Math.max(0, 50 - (actual - critical) * 2);
  }

  /**
   *
   */
  private calculateEventProcessingScore(actual: number): number {
    const { target, warning, critical } = this.sloTargets.eventProcessingDelay;

    if (actual <= target) return 100;
    if (actual <= warning)
      return this.linearScore(actual, target, warning, 100, 80);
    if (actual <= critical)
      return this.linearScore(actual, warning, critical, 80, 50);
    return Math.max(0, 50 - (actual - critical));
  }

  /**
   *
   */
  private calculateCrashFreeScore(actual: number): number {
    const { target, warning, critical } = this.sloTargets.crashFreeSessionsRate;

    if (actual >= target) return 100;
    if (actual >= warning)
      return this.linearScore(actual, warning, target, 80, 100);
    if (actual >= critical)
      return this.linearScore(actual, critical, warning, 50, 80);
    return Math.max(0, 50 * (actual / critical));
  }

  /**
   *
   */
  private calculateMemoryScore(actual: number): number {
    const { target, warning, critical } = this.sloTargets.memoryUsage;

    if (actual <= target) return 100;
    if (actual <= warning)
      return this.linearScore(actual, target, warning, 100, 80);
    if (actual <= critical)
      return this.linearScore(actual, warning, critical, 80, 50);
    return Math.max(0, 50 - (actual - critical) / 10);
  }

  /**
   * CPU
   */
  private calculateCPUScore(actual: number): number {
    const { target, warning, critical } = this.sloTargets.cpuUsage;

    if (actual <= target) return 100;
    if (actual <= warning)
      return this.linearScore(actual, target, warning, 100, 80);
    if (actual <= critical)
      return this.linearScore(actual, warning, critical, 80, 50);
    return Math.max(0, 50 - (actual - critical) / 2);
  }

  /**
   *
   */
  private linearScore(
    actual: number,
    min: number,
    max: number,
    minScore: number,
    maxScore: number
  ): number {
    return minScore + ((maxScore - minScore) * (actual - min)) / (max - min);
  }
}

/**
 *
 */
export class CostGuardrailManager {
  private sloTargets: SLOTargets;
  private costTargets: CostTargets;
  private scoreCalculator: SLOScoreCalculator;
  private currentStrategy: DynamicSamplingStrategy;

  constructor(sloTargets: SLOTargets, costTargets: CostTargets) {
    this.sloTargets = sloTargets;
    this.costTargets = costTargets;
    this.scoreCalculator = new SLOScoreCalculator(sloTargets);
    this.currentStrategy = this.initializeDefaultStrategy();
  }

  /**
   *
   */
  private initializeDefaultStrategy(): DynamicSamplingStrategy {
    return {
      baseSampleRate: 0.1, // 10%
      environmentMultipliers: {
        production: 1.0,
        staging: 3.0, // staging
        development: 10.0, // development
      },
      sloComplianceFunction: this.createSLOComplianceFunction(),
      costControlFunction: this.createCostControlFunction(),
      criticalTransactionSampling: {
        transactions: [
          'startup',
          'game.load',
          'ai.decision',
          'guild.management',
        ],
        minSampleRate: 0.5, // 50%
      },
    };
  }

  /**
   * SLO
   * SLO
   */
  private createSLOComplianceFunction(): (sloScore: number) => number {
    return (sloScore: number) => {
      if (sloScore >= 95) return 0.8; //
      if (sloScore >= 90) return 1.0; //
      if (sloScore >= 80) return 1.5; //
      if (sloScore >= 70) return 2.0; //
      return 3.0; //
    };
  }

  /**
   *
   *
   */
  private createCostControlFunction(): (costUtilization: number) => number {
    return (costUtilization: number) => {
      if (costUtilization < 0.5) return 1.0; // 50%
      if (costUtilization < 0.7) return 0.8; // 50-70%
      if (costUtilization < 0.8) return 0.6; // 70-80%
      if (costUtilization < 0.9) return 0.4; // 80-90%
      if (costUtilization < 0.95) return 0.2; // 90-95%
      return 0.1; // 95%
    };
  }

  /**
   *
   */
  calculateOptimalSampleRate(
    metrics: PerformanceMetrics,
    costUtilization: CostUtilization,
    environment: 'production' | 'staging' | 'development',
    transactionName?: string
  ): number {
    // 1. SLO
    const sloScore = this.scoreCalculator.calculateOverallScore(metrics);

    // 2. SLO
    const sloMultiplier = this.currentStrategy.sloComplianceFunction(sloScore);

    // 3.
    const costMultiplier = this.currentStrategy.costControlFunction(
      costUtilization.monthlyUtilization
    );

    // 4.
    const envMultiplier =
      this.currentStrategy.environmentMultipliers[environment];

    // 5.
    let sampleRate =
      this.currentStrategy.baseSampleRate *
      sloMultiplier *
      costMultiplier *
      envMultiplier;

    // 6.
    if (transactionName && this.isCriticalTransaction(transactionName)) {
      sampleRate = Math.max(
        sampleRate,
        this.currentStrategy.criticalTransactionSampling.minSampleRate
      );
    }

    // 7.
    return Math.min(1.0, Math.max(0.01, sampleRate));
  }

  /**
   *
   */
  private isCriticalTransaction(transactionName: string): boolean {
    return this.currentStrategy.criticalTransactionSampling.transactions.some(
      critical => transactionName.includes(critical)
    );
  }

  /**
   *
   */
  generateSamplingReport(
    metrics: PerformanceMetrics,
    costUtilization: CostUtilization,
    environment: string
  ): SamplingDecisionReport {
    const sloScore = this.scoreCalculator.calculateOverallScore(metrics);
    const sampleRate = this.calculateOptimalSampleRate(
      metrics,
      costUtilization,
      environment as any
    );

    return {
      timestamp: new Date().toISOString(),
      environment,
      sloScore,
      costUtilization: costUtilization.monthlyUtilization,
      recommendedSampleRate: sampleRate,
      reasoning: this.generateReasoningText(
        sloScore,
        costUtilization.monthlyUtilization
      ),
      adjustments: {
        sloMultiplier: this.currentStrategy.sloComplianceFunction(sloScore),
        costMultiplier: this.currentStrategy.costControlFunction(
          costUtilization.monthlyUtilization
        ),
        envMultiplier:
          this.currentStrategy.environmentMultipliers[
            environment as keyof typeof this.currentStrategy.environmentMultipliers
          ] || 1.0,
      },
      costImpact: this.estimateCostImpact(sampleRate, costUtilization),
      recommendations: this.generateRecommendations(
        sloScore,
        costUtilization.monthlyUtilization
      ),
    };
  }

  /**
   *
   */
  private generateReasoningText(
    sloScore: number,
    costUtilization: number
  ): string {
    const sloStatus =
      sloScore >= 90 ? '' : sloScore >= 80 ? '' : sloScore >= 70 ? '' : '';
    const costStatus =
      costUtilization < 0.7 ? '' : costUtilization < 0.9 ? '' : '';

    return (
      `SLO评分${sloScore}分(${sloStatus})，成本使用率${(costUtilization * 100).toFixed(1)}%(${costStatus})。` +
      `基于SLO达标情况${sloScore < 80 ? '' : ''}采样率，同时考虑成本控制${costUtilization > 0.8 ? '' : ''}采样。`
    );
  }

  /**
   *
   */
  private estimateCostImpact(
    sampleRate: number,
    costUtilization: CostUtilization
  ): CostImpactEstimate {
    const currentDailyCost = costUtilization.dailyEventCount * 0.0001; // $0.0001
    const newDailyCost =
      (currentDailyCost * sampleRate) / this.currentStrategy.baseSampleRate;
    const monthlyCostChange = (newDailyCost - currentDailyCost) * 30;

    return {
      currentMonthlyCost: currentDailyCost * 30,
      estimatedMonthlyCost: newDailyCost * 30,
      monthlyCostChange,
      percentageChange:
        ((newDailyCost - currentDailyCost) / currentDailyCost) * 100,
    };
  }

  /**
   *
   */
  private generateRecommendations(
    sloScore: number,
    costUtilization: number
  ): string[] {
    const recommendations: string[] = [];

    if (sloScore < 80) {
      recommendations.push(' SLO');
      recommendations.push(' UI');
    }

    if (costUtilization > 0.8) {
      recommendations.push(' ');
      recommendations.push(' ');
    }

    if (sloScore > 90 && costUtilization < 0.6) {
      recommendations.push(' SLO');
    }

    return recommendations;
  }

  /**
   *
   */
  getCurrentStrategy(): DynamicSamplingStrategy {
    return { ...this.currentStrategy };
  }

  /**
   *
   */
  updateStrategy(updates: Partial<DynamicSamplingStrategy>): void {
    this.currentStrategy = { ...this.currentStrategy, ...updates };
  }
}

//
export interface PerformanceMetrics {
  uiResponseTime: number; // ms
  eventProcessingDelay: number; // ms
  crashFreeSessionsRate: number; // %
  memoryUsage: number; // MB
  cpuUsage: number; // %
}

export interface CostUtilization {
  monthlyUtilization: number; // 0-1
  dailyEventCount: number;
  currentDataIngestion: number; // GB
}

export interface SamplingDecisionReport {
  timestamp: string;
  environment: string;
  sloScore: number;
  costUtilization: number;
  recommendedSampleRate: number;
  reasoning: string;
  adjustments: {
    sloMultiplier: number;
    costMultiplier: number;
    envMultiplier: number;
  };
  costImpact: CostImpactEstimate;
  recommendations: string[];
}

export interface CostImpactEstimate {
  currentMonthlyCost: number;
  estimatedMonthlyCost: number;
  monthlyCostChange: number;
  percentageChange: number;
}

//
export const DEFAULT_SLO_TARGETS: SLOTargets = {
  uiResponseTime: { target: 16, warning: 25, critical: 50 },
  eventProcessingDelay: { target: 50, warning: 75, critical: 100 },
  crashFreeSessionsRate: { target: 99.5, warning: 99.0, critical: 98.0 },
  memoryUsage: { target: 300, warning: 350, critical: 400 },
  cpuUsage: { target: 15, warning: 30, critical: 50 },
};

export const DEFAULT_COST_TARGETS: CostTargets = {
  monthlyDataIngestion: { budget: 10, warning: 8, critical: 9.5 }, // GB
  dailyEventCount: { budget: 100000, warning: 80000, critical: 95000 },
  storageRetention: { budget: 50, dataRetentionDays: 30 }, // GB
};

//
export const costGuardrailManager = new CostGuardrailManager(
  DEFAULT_SLO_TARGETS,
  DEFAULT_COST_TARGETS
);

//
export function calculateSampleRate(
  metrics: PerformanceMetrics,
  costUtilization: CostUtilization,
  environment: 'production' | 'staging' | 'development',
  transactionName?: string
): number {
  return costGuardrailManager.calculateOptimalSampleRate(
    metrics,
    costUtilization,
    environment,
    transactionName
  );
}

export function generateCostReport(
  metrics: PerformanceMetrics,
  costUtilization: CostUtilization,
  environment: string
): SamplingDecisionReport {
  return costGuardrailManager.generateSamplingReport(
    metrics,
    costUtilization,
    environment
  );
}

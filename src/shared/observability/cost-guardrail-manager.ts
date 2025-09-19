/**
 * 可观测性成本护栏管理器
 *
 * 建议4实施：采样与成本护栏对齐
 * 建立01章SLO与03章动态采样的强引用和数学关联
 */

// SLO目标定义（来自01章）
export interface SLOTargets {
  // UI响应性目标
  uiResponseTime: {
    target: number; // TP95 ≤ 16ms
    warning: number; // 超过此值开始调整采样
    critical: number; // 超过此值激进调整
  };

  // 事件处理延迟目标
  eventProcessingDelay: {
    target: number; // TP95 ≤ 50ms
    warning: number;
    critical: number;
  };

  // 会话成功率目标
  crashFreeSessionsRate: {
    target: number; // ≥99.5%
    warning: number; // ≤99.0%
    critical: number; // ≤98.0%
  };

  // 内存使用目标
  memoryUsage: {
    target: number; // < 300MB
    warning: number; // 350MB
    critical: number; // 400MB
  };

  // CPU使用目标
  cpuUsage: {
    target: number; // < 15%
    warning: number; // 30%
    critical: number; // 50%
  };
}

// 成本目标定义
export interface CostTargets {
  // 每月数据摄入量限制（GB）
  monthlyDataIngestion: {
    budget: number;
    warning: number; // 80%
    critical: number; // 95%
  };

  // 每日事件数量限制
  dailyEventCount: {
    budget: number;
    warning: number;
    critical: number;
  };

  // 存储成本控制（GB·月）
  storageRetention: {
    budget: number;
    dataRetentionDays: number;
  };
}

// 动态采样策略
export interface DynamicSamplingStrategy {
  // 基础采样率
  baseSampleRate: number;

  // 环境相关调整
  environmentMultipliers: {
    production: number;
    staging: number;
    development: number;
  };

  // SLO达标率与采样率的关系函数
  sloComplianceFunction: (sloScore: number) => number;

  // 成本控制函数
  costControlFunction: (costUtilization: number) => number;

  // 优先级事务保护
  criticalTransactionSampling: {
    transactions: string[];
    minSampleRate: number;
  };
}

/**
 * SLO评分计算器
 */
export class SLOScoreCalculator {
  private sloTargets: SLOTargets;

  constructor(targets: SLOTargets) {
    this.sloTargets = targets;
  }

  /**
   * 计算综合SLO评分 (0-100)
   */
  calculateOverallScore(metrics: PerformanceMetrics): number {
    const scores = [
      this.calculateUIResponseScore(metrics.uiResponseTime),
      this.calculateEventProcessingScore(metrics.eventProcessingDelay),
      this.calculateCrashFreeScore(metrics.crashFreeSessionsRate),
      this.calculateMemoryScore(metrics.memoryUsage),
      this.calculateCPUScore(metrics.cpuUsage),
    ];

    // 加权平均，UI响应和崩溃率权重更高
    const weights = [0.3, 0.2, 0.3, 0.1, 0.1];
    const weightedSum = scores.reduce(
      (sum, score, index) => sum + score * weights[index],
      0
    );

    return Math.round(weightedSum);
  }

  /**
   * 计算UI响应性评分
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
   * 计算事件处理评分
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
   * 计算会话成功率评分
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
   * 计算内存使用评分
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
   * 计算CPU使用评分
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
   * 线性插值计算评分
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
 * 成本护栏管理器
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
   * 初始化默认采样策略
   */
  private initializeDefaultStrategy(): DynamicSamplingStrategy {
    return {
      baseSampleRate: 0.1, // 10%基础采样率
      environmentMultipliers: {
        production: 1.0,
        staging: 3.0, // staging环境提高采样
        development: 10.0, // development环境最高采样
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
        minSampleRate: 0.5, // 关键事务最低50%采样
      },
    };
  }

  /**
   * 创建SLO达标率与采样率的关系函数
   * SLO评分越低，采样率越高（为了更好地诊断问题）
   */
  private createSLOComplianceFunction(): (sloScore: number) => number {
    return (sloScore: number) => {
      if (sloScore >= 95) return 0.8; // 优秀：降低采样率
      if (sloScore >= 90) return 1.0; // 良好：标准采样率
      if (sloScore >= 80) return 1.5; // 一般：提高采样率
      if (sloScore >= 70) return 2.0; // 较差：更高采样率
      return 3.0; // 很差：最高采样率（为了诊断）
    };
  }

  /**
   * 创建成本控制函数
   * 成本使用率越高，采样率越低
   */
  private createCostControlFunction(): (costUtilization: number) => number {
    return (costUtilization: number) => {
      if (costUtilization < 0.5) return 1.0; // 50%以下：正常采样
      if (costUtilization < 0.7) return 0.8; // 50-70%：轻微降低
      if (costUtilization < 0.8) return 0.6; // 70-80%：明显降低
      if (costUtilization < 0.9) return 0.4; // 80-90%：大幅降低
      if (costUtilization < 0.95) return 0.2; // 90-95%：仅保留关键采样
      return 0.1; // 95%以上：最低采样率
    };
  }

  /**
   * 计算当前最优采样率
   */
  calculateOptimalSampleRate(
    metrics: PerformanceMetrics,
    costUtilization: CostUtilization,
    environment: 'production' | 'staging' | 'development',
    transactionName?: string
  ): number {
    // 1. 计算SLO评分
    const sloScore = this.scoreCalculator.calculateOverallScore(metrics);

    // 2. 应用SLO合规函数
    const sloMultiplier = this.currentStrategy.sloComplianceFunction(sloScore);

    // 3. 应用成本控制函数
    const costMultiplier = this.currentStrategy.costControlFunction(
      costUtilization.monthlyUtilization
    );

    // 4. 应用环境调整
    const envMultiplier =
      this.currentStrategy.environmentMultipliers[environment];

    // 5. 计算基础采样率
    let sampleRate =
      this.currentStrategy.baseSampleRate *
      sloMultiplier *
      costMultiplier *
      envMultiplier;

    // 6. 关键事务保护
    if (transactionName && this.isCriticalTransaction(transactionName)) {
      sampleRate = Math.max(
        sampleRate,
        this.currentStrategy.criticalTransactionSampling.minSampleRate
      );
    }

    // 7. 确保采样率在合理范围内
    return Math.min(1.0, Math.max(0.01, sampleRate));
  }

  /**
   * 检查是否为关键事务
   */
  private isCriticalTransaction(transactionName: string): boolean {
    return this.currentStrategy.criticalTransactionSampling.transactions.some(
      critical => transactionName.includes(critical)
    );
  }

  /**
   * 生成采样决策报告
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
   * 生成决策推理文本
   */
  private generateReasoningText(
    sloScore: number,
    costUtilization: number
  ): string {
    const sloStatus =
      sloScore >= 90
        ? '优秀'
        : sloScore >= 80
          ? '良好'
          : sloScore >= 70
            ? '一般'
            : '较差';
    const costStatus =
      costUtilization < 0.7 ? '正常' : costUtilization < 0.9 ? '偏高' : '临界';

    return (
      `SLO评分${sloScore}分(${sloStatus})，成本使用率${(costUtilization * 100).toFixed(1)}%(${costStatus})。` +
      `基于SLO达标情况${sloScore < 80 ? '提升' : '优化'}采样率，同时考虑成本控制${costUtilization > 0.8 ? '降低' : '维持'}采样。`
    );
  }

  /**
   * 估算成本影响
   */
  private estimateCostImpact(
    sampleRate: number,
    costUtilization: CostUtilization
  ): CostImpactEstimate {
    const currentDailyCost = costUtilization.dailyEventCount * 0.0001; // 假设每事件$0.0001
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
   * 生成优化建议
   */
  private generateRecommendations(
    sloScore: number,
    costUtilization: number
  ): string[] {
    const recommendations: string[] = [];

    if (sloScore < 80) {
      recommendations.push(
        '🔍 SLO评分较低，建议提高采样率以便更好地诊断性能问题'
      );
      recommendations.push(
        '📊 关注UI响应时间和崩溃率指标，优先优化影响最大的性能瓶颈'
      );
    }

    if (costUtilization > 0.8) {
      recommendations.push('💰 成本使用率较高，建议优化采样策略或增加预算');
      recommendations.push(
        '🎯 考虑对非关键事务降低采样率，重点关注关键业务流程'
      );
    }

    if (sloScore > 90 && costUtilization < 0.6) {
      recommendations.push(
        '✅ SLO表现优秀且成本合理，可考虑轻微降低采样率以节省成本'
      );
    }

    return recommendations;
  }

  /**
   * 获取当前策略配置
   */
  getCurrentStrategy(): DynamicSamplingStrategy {
    return { ...this.currentStrategy };
  }

  /**
   * 更新采样策略
   */
  updateStrategy(updates: Partial<DynamicSamplingStrategy>): void {
    this.currentStrategy = { ...this.currentStrategy, ...updates };
  }
}

// 类型定义
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

// 默认配置
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
  storageRetention: { budget: 50, dataRetentionDays: 30 }, // GB·月
};

// 导出默认实例
export const costGuardrailManager = new CostGuardrailManager(
  DEFAULT_SLO_TARGETS,
  DEFAULT_COST_TARGETS
);

// 便捷函数
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

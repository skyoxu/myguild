/**
 * 风险与技术债管理系统 - TypeScript 契约定义
 *
 * 本文件定义了风险管理系统的核心类型接口，包括：
 * - 风险条目类型定义
 * - 技术债记录类型定义
 * - P×I矩阵评估接口
 * - 追踪关系类型定义
 * - 服务接口契约
 */

// =============================================================================
// 基础类型定义
// =============================================================================

export type RiskCategory =
  | 'reliability'
  | 'performance'
  | 'security'
  | 'observability'
  | 'architecture';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskStatus = 'open' | 'mitigating' | 'monitoring' | 'closed';
export type RiskProbability = 1 | 2 | 3 | 4 | 5;
export type RiskImpact = 1 | 2 | 3 | 4 | 5;

export type TechnicalDebtType =
  | 'code_quality' // 代码质量债务
  | 'architecture' // 架构设计债务
  | 'documentation' // 文档债务
  | 'testing' // 测试覆盖债务
  | 'performance' // 性能优化债务
  | 'security' // 安全加固债务
  | 'dependency' // 依赖升级债务
  | 'infrastructure'; // 基础设施债务

export type DebtSource =
  | 'conscious_decision' // 有意识决策产生
  | 'time_pressure' // 时间压力导致
  | 'lack_of_knowledge' // 知识不足导致
  | 'changing_requirements' // 需求变更导致
  | 'technology_evolution'; // 技术演进导致

export type DebtPriority = 'p0' | 'p1' | 'p2' | 'p3';
export type DebtStatus =
  | 'identified'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'accepted';

// =============================================================================
// 风险条目核心接口
// =============================================================================

export interface RiskEntry {
  readonly id: string; // RISK-YYYY-NNN 格式
  readonly title: string;
  readonly description: string;
  readonly category: RiskCategory;
  readonly subcategory: string;

  // P×I 评估
  readonly probability: RiskProbability;
  readonly impact: RiskImpact;
  readonly riskScore: number; // probability × impact (1-25)
  readonly riskLevel: RiskSeverity;

  // 关联关系
  readonly affectedSLOs: readonly string[]; // NFR-1, NFR-2等
  readonly relatedADRs: readonly string[]; // ADR-0003等
  readonly impactedComponents: readonly string[];

  // 状态管理
  readonly status: RiskStatus;
  readonly owner: string;
  readonly assignedTo?: string;

  // 缓解措施
  readonly mitigationPlan: {
    readonly immediate: readonly string[]; // 立即措施
    readonly shortTerm: readonly string[]; // 短期计划（1-4周）
    readonly longTerm: readonly string[]; // 长期计划（1-6月）
  };

  // 监控配置
  readonly monitoring: {
    readonly metrics: readonly string[]; // 监控指标
    readonly alerts: readonly string[]; // 告警配置
    readonly dashboards: readonly string[]; // 仪表板链接
  };

  // 时间戳
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly reviewDate: number; // 下次评审日期
}

// =============================================================================
// 技术债记录接口
// =============================================================================

export interface TechnicalDebtRecord {
  readonly id: string; // TDR-YYYY-NNN 格式
  readonly title: string;
  readonly description: string;
  readonly type: TechnicalDebtType;

  // 债务特征
  readonly debtSource: DebtSource;
  readonly affectedComponents: readonly string[];
  readonly introducedBy: {
    readonly adrRef?: string; // 引入该债务的ADR
    readonly prRef?: string; // 相关PR/commit
    readonly author: string; // 责任人
    readonly introducedAt: number; // 引入时间
    readonly reason: string; // 引入原因
  };

  // 影响评估
  readonly impact: {
    readonly developmentVelocity: 1 | 2 | 3 | 4 | 5; // 对开发速度影响
    readonly codeQuality: 1 | 2 | 3 | 4 | 5; // 对代码质量影响
    readonly systemReliability: 1 | 2 | 3 | 4 | 5; // 对系统可靠性影响
    readonly maintenanceCost: 1 | 2 | 3 | 4 | 5; // 维护成本影响
  };

  // SLO关联
  readonly sloImpact: {
    readonly affectedSLOs: readonly string[];
    readonly estimatedDegradation: Record<string, number>; // SLO预期降级程度
    readonly currentDegradation: Record<string, number>; // 当前实际影响
  };

  // 偿还计划
  readonly repaymentPlan: {
    readonly priority: DebtPriority;
    readonly estimatedEffort: number; // 人日
    readonly proposedSolution: string;
    readonly acceptanceCriteria: readonly string[];
    readonly targetDate?: number;
    readonly assignedTo?: string;
  };

  // 状态追踪
  readonly status: DebtStatus;
  readonly statusHistory: readonly StatusChange[];

  // 元数据
  readonly tags: readonly string[];
  readonly relatedRisks: readonly string[]; // 关联的RISK-*
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly reviewDate: number;
}

interface StatusChange {
  readonly from: string;
  readonly to: string;
  readonly reason: string;
  readonly changedBy: string;
  readonly changedAt: number;
}

// =============================================================================
// P×I 矩阵评估接口
// =============================================================================

export interface RiskAssessmentResult {
  readonly riskScore: number;
  readonly riskLevel: RiskSeverity;
  readonly reasoning: string;
  readonly confidence: number; // 0-1
  readonly recommendations: readonly string[];
  readonly assessedAt: number;
  readonly assessedBy: string;
}

export interface ProbabilityImpactMatrix {
  calculateRiskScore(
    probability: RiskProbability,
    impact: RiskImpact
  ): {
    readonly score: number;
    readonly level: RiskSeverity;
  };

  assessProbability(evidence: RiskEvidence): Promise<RiskProbability>;
  assessImpact(sloViolations: readonly SLOViolation[]): Promise<RiskImpact>;
}

export interface RiskEvidence {
  readonly historicalData: Record<string, number>;
  readonly currentMetrics: Record<string, number>;
  readonly trend: 'improving' | 'stable' | 'degrading';
  readonly context: string;
}

export interface SLOViolation {
  readonly sloId: string;
  readonly target: number;
  readonly actual: number;
  readonly degradationPercent: number;
  readonly duration: number; // 违规持续时间（分钟）
}

// =============================================================================
// 追踪关系接口
// =============================================================================

export interface TraceabilityMatrix {
  readonly riskTraces: readonly RiskTrace[];
  readonly tdrTraces: readonly TDRTrace[];
  readonly crossReferences: readonly CrossReference[];
}

export interface RiskTrace {
  readonly riskId: string;
  readonly riskTitle: string;
  readonly category: RiskCategory;

  // NFR/SLO 关联
  readonly nfrReferences: readonly NFRReference[];
  readonly sloImpacts: readonly SLOImpact[];

  // ADR 关联
  readonly adrReferences: readonly ADRReference[];
  readonly decisionDebt: readonly string[]; // Decision Debt IDs

  // 测试关联
  readonly testReferences: readonly TestReference[];
  readonly validationCriteria: readonly string[];

  // 组件关联
  readonly affectedComponents: readonly ComponentReference[];
  readonly implementationFiles: readonly string[];
}

export interface TDRTrace {
  readonly tdrId: string;
  readonly tdrTitle: string;
  readonly debtType: TechnicalDebtType;

  // 源头追踪
  readonly originADR?: string;
  readonly introducedBy: {
    readonly pr?: string;
    readonly commit?: string;
    readonly author: string;
    readonly timestamp: number;
  };

  // 影响追踪
  readonly sloImpacts: readonly SLOImpact[];
  readonly relatedRisks: readonly string[];
  readonly affectedTests: readonly TestReference[];

  // 偿还追踪
  readonly repaymentPlan: {
    readonly targetADR?: string;
    readonly refactoringTasks: readonly string[];
    readonly validationTests: readonly string[];
  };
}

export interface CrossReference {
  readonly fromType: 'risk' | 'tdr' | 'nfr' | 'slo' | 'adr' | 'test';
  readonly fromId: string;
  readonly toType: 'risk' | 'tdr' | 'nfr' | 'slo' | 'adr' | 'test';
  readonly toId: string;
  readonly relationship: RelationshipType;
  readonly strength: 'weak' | 'medium' | 'strong';
  readonly createdAt: number;
  readonly validatedAt?: number;
}

export type RelationshipType =
  | 'implements' // ADR implements NFR
  | 'validates' // Test validates SLO
  | 'violates' // Risk violates SLO
  | 'mitigates' // ADR mitigates Risk
  | 'introduces' // ADR introduces TDR
  | 'affects' // TDR affects SLO
  | 'depends_on' // Component depends on
  | 'triggers' // Event triggers Response
  | 'supersedes'; // New ADR supersedes Old ADR

// =============================================================================
// 支持类型定义
// =============================================================================

export interface NFRReference {
  readonly nfrId: string; // NFR-1, NFR-2 等
  readonly title: string;
  readonly relationship: 'supports' | 'violates' | 'neutral';
  readonly impact: number; // 0-1
}

export interface SLOImpact {
  readonly sloId: string;
  readonly currentStatus: 'healthy' | 'violated';
  readonly currentValue: number;
  readonly targetValue: number;
  readonly potentialImpact: number; // 潜在影响程度
  readonly riskContribution: number; // 风险贡献度
  readonly trend: 'improving' | 'stable' | 'degrading';
}

export interface ADRReference {
  readonly adrId: string;
  readonly title: string;
  readonly relationship:
    | 'explicitly_referenced'
    | 'component_based'
    | 'slo_based';
  readonly relevance: 'high' | 'medium' | 'low';
}

export interface TestReference {
  readonly testPath: string;
  readonly testType: 'unit' | 'integration' | 'e2e';
  readonly coverage: 'covers' | 'partially_covers' | 'validates';
  readonly lastRun: number;
  readonly passed: boolean;
}

export interface ComponentReference {
  readonly name: string;
  readonly type: 'service' | 'module' | 'function' | 'class';
  readonly impact: 'direct' | 'indirect';
  readonly criticality: 'low' | 'medium' | 'high' | 'critical';
}

// =============================================================================
// 服务接口定义
// =============================================================================

export interface RiskRegistry {
  addRisk(risk: CreateRiskRequest): Promise<RiskEntry>;
  updateRisk(id: string, updates: UpdateRiskRequest): Promise<RiskEntry>;
  getRisk(id: string): Promise<RiskEntry | null>;
  listRisks(filter?: RiskFilter): Promise<readonly RiskEntry[]>;
  assessRisk(
    id: string,
    probability: RiskProbability,
    impact: RiskImpact
  ): Promise<RiskEntry>;
  closeRisk(id: string, reason: string): Promise<void>;
}

export interface TechnicalDebtRepository {
  addTDR(tdr: CreateTDRRequest): Promise<TechnicalDebtRecord>;
  updateTDR(
    id: string,
    updates: UpdateTDRRequest
  ): Promise<TechnicalDebtRecord>;
  getTDR(id: string): Promise<TechnicalDebtRecord | null>;
  listTDRs(filter?: TDRFilter): Promise<readonly TechnicalDebtRecord[]>;
  findByADR(adrId: string): Promise<readonly TechnicalDebtRecord[]>;
  prioritizeTDRs(
    tdrs: readonly TechnicalDebtRecord[]
  ): Promise<readonly TechnicalDebtRecord[]>;
}

export interface TraceabilityAnalyzer {
  buildTraceabilityMatrix(): Promise<TraceabilityMatrix>;
  validateMatrix(matrix: TraceabilityMatrix): Promise<ValidationReport>;
  analyzeImpact(changeRequest: ChangeRequest): Promise<ImpactAnalysisReport>;
  findRelatedRisks(component: string): Promise<readonly RiskEntry[]>;
  findRelatedTDRs(adrId: string): Promise<readonly TechnicalDebtRecord[]>;
}

// =============================================================================
// 请求/响应类型
// =============================================================================

export interface CreateRiskRequest {
  readonly title: string;
  readonly description: string;
  readonly category: RiskCategory;
  readonly subcategory?: string;
  readonly probability: RiskProbability;
  readonly impact: RiskImpact;
  readonly affectedSLOs?: readonly string[];
  readonly relatedADRs?: readonly string[];
  readonly impactedComponents?: readonly string[];
  readonly owner: string;
  readonly mitigationPlan?: {
    readonly immediate?: readonly string[];
    readonly shortTerm?: readonly string[];
    readonly longTerm?: readonly string[];
  };
}

export interface UpdateRiskRequest {
  readonly title?: string;
  readonly description?: string;
  readonly probability?: RiskProbability;
  readonly impact?: RiskImpact;
  readonly status?: RiskStatus;
  readonly assignedTo?: string;
  readonly mitigationPlan?: Partial<RiskEntry['mitigationPlan']>;
  readonly monitoring?: Partial<RiskEntry['monitoring']>;
}

export interface CreateTDRRequest {
  readonly title: string;
  readonly description: string;
  readonly type: TechnicalDebtType;
  readonly debtSource: DebtSource;
  readonly affectedComponents: readonly string[];
  readonly introducedBy: Omit<
    TechnicalDebtRecord['introducedBy'],
    'introducedAt'
  >;
  readonly impact: TechnicalDebtRecord['impact'];
  readonly sloImpact?: Partial<TechnicalDebtRecord['sloImpact']>;
  readonly repaymentPlan: Omit<
    TechnicalDebtRecord['repaymentPlan'],
    'priority'
  >;
  readonly tags?: readonly string[];
}

export interface UpdateTDRRequest {
  readonly title?: string;
  readonly description?: string;
  readonly status?: DebtStatus;
  readonly impact?: Partial<TechnicalDebtRecord['impact']>;
  readonly repaymentPlan?: Partial<TechnicalDebtRecord['repaymentPlan']>;
  readonly tags?: readonly string[];
}

export interface RiskFilter {
  readonly category?: RiskCategory;
  readonly riskLevel?: RiskSeverity;
  readonly status?: RiskStatus;
  readonly owner?: string;
  readonly affectedSLO?: string;
  readonly relatedADR?: string;
  readonly createdAfter?: number;
  readonly createdBefore?: number;
}

export interface TDRFilter {
  readonly type?: TechnicalDebtType;
  readonly status?: DebtStatus;
  readonly priority?: DebtPriority;
  readonly affectedComponent?: string;
  readonly relatedRisk?: string;
  readonly assignedTo?: string;
}

// =============================================================================
// 监控与告警接口
// =============================================================================

export interface RiskEvent {
  readonly id: string;
  readonly type:
    | 'risk_detected'
    | 'risk_mitigated'
    | 'slo_violation'
    | 'tech_debt_created';
  readonly timestamp: number;
  readonly source: string;
  readonly payload: Record<string, unknown>;
}

export interface AlertRule {
  readonly id: string;
  readonly condition: (data: any) => boolean | Promise<boolean>;
  readonly action: 'immediate_alert' | 'escalate_alert' | 'contextual_alert';
  readonly channels: readonly ('pager' | 'slack' | 'email')[];
  readonly throttle: number; // 秒
}

export interface RiskMetrics {
  readonly totalRisks: number;
  readonly risksByLevel: Record<RiskSeverity, number>;
  readonly risksByCategory: Record<RiskCategory, number>;
  readonly averageRiskScore: number;
  readonly trendsLast30Days: {
    readonly newRisks: number;
    readonly mitigatedRisks: number;
    readonly riskScoreChange: number;
  };
  readonly sloHealth: {
    readonly healthyCount: number;
    readonly violatedCount: number;
    readonly riskContributionPercent: number;
  };
}

// =============================================================================
// 分析报告接口
// =============================================================================

export interface ValidationReport {
  readonly passed: boolean;
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
  readonly timestamp: number;
}

export interface ImpactAnalysisReport {
  readonly directImpacts: readonly ComponentImpact[];
  readonly cascadingImpacts: readonly CascadingImpact[];
  readonly riskProfile: RiskProfile;
  readonly testingStrategy: TestingStrategy;
  readonly mitigationPlan: MitigationPlan;
}

export interface ComponentImpact {
  readonly component: string;
  readonly impactType:
    | 'functional'
    | 'performance'
    | 'security'
    | 'reliability';
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly description: string;
  readonly affectedSLOs: readonly string[];
}

export interface CascadingImpact {
  readonly component: string;
  readonly depth: number;
  readonly affectedRisks: readonly string[];
  readonly dependentComponents: readonly string[];
  readonly estimatedImpact: number;
}

export interface RiskProfile {
  readonly riskDistribution: Record<RiskSeverity, number>;
  readonly topRisks: readonly RiskEntry[];
  readonly emergingRisks: readonly RiskEntry[];
  readonly mitigationProgress: number; // 0-1
}

export interface TestingStrategy {
  readonly requiredTests: readonly string[];
  readonly riskCoverage: Record<string, number>;
  readonly validationApproach: string;
}

export interface MitigationPlan {
  readonly immediateActions: readonly string[];
  readonly plannedActions: readonly string[];
  readonly monitoringRequirements: readonly string[];
  readonly successCriteria: readonly string[];
}

export interface ChangeRequest {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly affectedComponents: readonly string[];
  readonly type: 'feature' | 'bug_fix' | 'refactor' | 'architecture_change';
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly estimatedEffort: number;
  readonly plannedDate: number;
}

// =============================================================================
// 工厂和配置接口
// =============================================================================

export interface RiskManagementConfig {
  readonly integrations: {
    readonly sentry: boolean;
    readonly slo: boolean;
    readonly adr: boolean;
    readonly ci: boolean;
  };
  readonly thresholds: {
    readonly maxCriticalRisks: number;
    readonly maxHighRisks: number;
    readonly sloViolationTolerance: number;
    readonly techDebtThreshold: number;
  };
  readonly monitoring: {
    readonly realTimeAssessment: boolean;
    readonly automaticMitigation: boolean;
    readonly alerting: boolean;
    readonly reportingInterval: number; // 小时
  };
  readonly quality: {
    readonly riskGateEnabled: boolean;
    readonly blockOnCriticalRisk: boolean;
    readonly requireMitigationPlan: boolean;
  };
}

export interface IRiskManagementService {
  createRisk(risk: CreateRiskRequest): Promise<RiskEntry>;
  updateRisk(id: string, updates: UpdateRiskRequest): Promise<RiskEntry>;
  assessRisk(id: string): Promise<RiskAssessmentResult>;
  mitigateRisk(id: string, plan: MitigationPlan): Promise<void>;
  getRiskMetrics(): Promise<RiskMetrics>;
  generateRiskReport(filter?: RiskFilter): Promise<RiskReport>;
  runRiskGate(): Promise<{ passed: boolean; details: any }>;
  analyzeChangeImpact(change: ChangeRequest): Promise<ImpactAnalysisReport>;
}

export interface RiskReport {
  readonly summary: RiskMetrics;
  readonly riskBreakdown: readonly RiskEntry[];
  readonly trendAnalysis: TrendAnalysis;
  readonly recommendations: readonly string[];
  readonly generatedAt: number;
  readonly reportPeriod: {
    readonly start: number;
    readonly end: number;
  };
}

export interface TrendAnalysis {
  readonly riskTrend: 'improving' | 'stable' | 'degrading';
  readonly keyChanges: readonly string[];
  readonly forecast: {
    readonly expectedRisks: number;
    readonly confidence: number;
    readonly horizon: number; // 天数
  };
}

// =============================================================================
// 常量定义
// =============================================================================

export const RISK_SEVERITY_THRESHOLDS: Record<
  RiskSeverity,
  {
    readonly minScore: number;
    readonly maxScore: number;
    readonly responseTime: number; // 响应时间要求（小时）
    readonly escalationLevel: number;
    readonly autoMitigation: boolean;
  }
> = {
  low: {
    minScore: 1,
    maxScore: 6,
    responseTime: 72,
    escalationLevel: 1,
    autoMitigation: false,
  },
  medium: {
    minScore: 7,
    maxScore: 12,
    responseTime: 24,
    escalationLevel: 2,
    autoMitigation: false,
  },
  high: {
    minScore: 13,
    maxScore: 20,
    responseTime: 4,
    escalationLevel: 3,
    autoMitigation: true,
  },
  critical: {
    minScore: 21,
    maxScore: 25,
    responseTime: 1,
    escalationLevel: 4,
    autoMitigation: true,
  },
};

export const PROBABILITY_SCALE: Record<
  RiskProbability,
  {
    readonly label: string;
    readonly description: string;
    readonly threshold: number; // 年度概率
  }
> = {
  1: {
    label: '极低',
    description: '理论上可能但极不可能发生',
    threshold: 0.001,
  },
  2: { label: '低', description: '在类似系统中很少发生', threshold: 0.01 },
  3: { label: '中', description: '在类似系统中偶尔发生', threshold: 0.05 },
  4: { label: '高', description: '在类似系统中经常发生', threshold: 0.2 },
  5: { label: '极高', description: '在当前条件下几乎肯定发生', threshold: 0.5 },
};

export const IMPACT_SCALE: Record<
  RiskImpact,
  {
    readonly label: string;
    readonly sloViolationThreshold: number; // SLO违规百分比
    readonly businessImpact: string;
    readonly recoveryTime: string;
  }
> = {
  1: {
    label: '轻微',
    sloViolationThreshold: 0.05,
    businessImpact: '无明显业务损失',
    recoveryTime: '< 1小时',
  },
  2: {
    label: '较低',
    sloViolationThreshold: 0.1,
    businessImpact: '轻微用户流失',
    recoveryTime: '1-4小时',
  },
  3: {
    label: '中等',
    sloViolationThreshold: 0.25,
    businessImpact: '中等业务损失',
    recoveryTime: '4-12小时',
  },
  4: {
    label: '严重',
    sloViolationThreshold: 0.5,
    businessImpact: '严重业务损失',
    recoveryTime: '12-24小时',
  },
  5: {
    label: '灾难性',
    sloViolationThreshold: 1.0,
    businessImpact: '重大业务损失',
    recoveryTime: '> 24小时',
  },
};

// 注意：所有类型已在上面定义时直接export，无需重复导出

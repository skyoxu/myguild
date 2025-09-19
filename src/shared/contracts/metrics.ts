/**
 * @fileoverview 可观测性指标契约定义
 * @description 基于 03-可观测性(Sentry+日志)-v2.md 的 TypeScript 契约实现
 * @references ADR-0003 (可观测性与 Release Health), ADR-0005 (质量门禁)
 */

// ============================================================================
// NFR Keys - 非功能性需求键值定义（简化版）
// ============================================================================

/**
 * 标准化指标单位 - 基于AWS CloudWatch Metrics最佳实践
 * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format_Specification.html
 */
export enum MetricUnit {
  // 时间单位
  Milliseconds = 'Milliseconds',
  Seconds = 'Seconds',
  Microseconds = 'Microseconds',

  // 计数单位
  Count = 'Count',
  CountPerSecond = 'Count/Second',

  // 百分比
  Percent = 'Percent',

  // 字节单位
  Bytes = 'Bytes',
  Kilobytes = 'Kilobytes',
  Megabytes = 'Megabytes',
  Gigabytes = 'Gigabytes',

  // 速率单位
  BytesPerSecond = 'Bytes/Second',
  KilobytesPerSecond = 'Kilobytes/Second',
  MegabytesPerSecond = 'Megabytes/Second',

  // 无单位
  None = 'None',
}

/**
 * NFR (Non-Functional Requirements) 类别 - 简化版
 * 用于追踪非功能性需求到 SLO 的映射关系
 */
export enum NFRCategory {
  RELIABILITY = 'reliability',
  PERFORMANCE = 'performance',
  AVAILABILITY = 'availability',
  SECURITY = 'security',
  USABILITY = 'usability',
}

/**
 * NFR 标识符生成函数 - 动态生成，避免硬编码
 */
export function createNFRKey(category: NFRCategory, name: string): string {
  return `NFR-${category.toUpperCase()}-${name.toUpperCase()}`;
}

/**
 * 常用 NFR 键值对象 - 基于createNFRKey动态生成
 */
export const NFR_KEYS = {
  RELIABILITY: {
    CRASH_FREE_USERS: createNFRKey(NFRCategory.RELIABILITY, 'crash_free_users'),
    CRASH_FREE_SESSIONS: createNFRKey(
      NFRCategory.RELIABILITY,
      'crash_free_sessions'
    ),
    SERVICE_AVAILABILITY: createNFRKey(
      NFRCategory.RELIABILITY,
      'service_availability'
    ),
    DATA_CONSISTENCY: createNFRKey(NFRCategory.RELIABILITY, 'data_consistency'),
  },
  PERFORMANCE: {
    RESPONSE_TIME: createNFRKey(NFRCategory.PERFORMANCE, 'response_time'),
    THROUGHPUT: createNFRKey(NFRCategory.PERFORMANCE, 'throughput'),
    MEMORY_USAGE: createNFRKey(NFRCategory.PERFORMANCE, 'memory_usage'),
    CPU_USAGE: createNFRKey(NFRCategory.PERFORMANCE, 'cpu_usage'),
    STARTUP_TIME: createNFRKey(NFRCategory.PERFORMANCE, 'startup_time'),
  },
  AVAILABILITY: {
    UPTIME: createNFRKey(NFRCategory.AVAILABILITY, 'uptime'),
    RECOVERY_TIME: createNFRKey(NFRCategory.AVAILABILITY, 'recovery_time'),
    FAILOVER_TIME: createNFRKey(NFRCategory.AVAILABILITY, 'failover_time'),
  },
  SECURITY: {
    AUTH_SUCCESS_RATE: createNFRKey(NFRCategory.SECURITY, 'auth_success_rate'),
    DATA_BREACH_PREVENTION: createNFRKey(
      NFRCategory.SECURITY,
      'data_breach_prevention'
    ),
    PRIVILEGE_COMPLIANCE: createNFRKey(
      NFRCategory.SECURITY,
      'privilege_compliance'
    ),
  },
} as const;

/**
 * NFR 类型定义 - 使用工具类型自动推断，避免手工维护
 */
type NFRKeysFlattened = {
  [K in keyof typeof NFR_KEYS]: (typeof NFR_KEYS)[K][keyof (typeof NFR_KEYS)[K]];
}[keyof typeof NFR_KEYS];

export type NFRKey = NFRKeysFlattened;

// ============================================================================
// SLI/SLO 定义
// ============================================================================

/**
 * SLI (Service Level Indicator) 定义 - 增强版
 * 基于AWS Powertools Metrics最佳实践
 */
export interface ServiceLevelIndicator {
  /** 指标唯一标识符 */
  readonly id: string;
  /** 指标名称 */
  readonly name: string;
  /** 指标描述 */
  readonly description: string;
  /** 指标单位 - 使用标准化枚举 */
  readonly unit: MetricUnit;
  /** 对应的 NFR 键值 */
  readonly nfrKey: NFRKey;
  /** 查询语句 */
  readonly query: string;
  /** 指标维度定义 */
  readonly dimensions?: readonly string[];
  /** 指标类型：gauge(瞬时值) | counter(计数器) | histogram(直方图) */
  readonly metricType: 'gauge' | 'counter' | 'histogram';
}

/**
 * SLO (Service Level Objective) 定义
 */
export interface ServiceLevelObjective {
  /** SLO 唯一标识符 */
  readonly id: string;
  /** 关联的 SLI */
  readonly sliId: string;
  /** 目标值配置 */
  readonly targets: {
    readonly production: string;
    readonly staging: string;
    readonly development: string;
  };
  /** 观察窗口 */
  readonly observationWindow: string;
  /** 告警阈值 */
  readonly alertThreshold: string;
  /** 错误预算 */
  readonly errorBudget?: string;
}

/**
 * 核心 SLI 定义常量
 */
export const CORE_SLIS: Record<string, ServiceLevelIndicator> = {
  CRASH_FREE_USERS: {
    id: 'crash_free_users',
    name: 'Crash-Free Users',
    description: '在观察窗口内未遇到崩溃的用户百分比',
    unit: MetricUnit.Percent,
    nfrKey: NFR_KEYS.RELIABILITY.CRASH_FREE_USERS,
    query: 'sentry.release_health.crash_free_users',
    dimensions: ['environment', 'release', 'platform'],
    metricType: 'gauge',
  },

  CRASH_FREE_SESSIONS: {
    id: 'crash_free_sessions',
    name: 'Crash-Free Sessions',
    description: '在观察窗口内未崩溃的会话百分比',
    unit: MetricUnit.Percent,
    nfrKey: NFR_KEYS.RELIABILITY.CRASH_FREE_SESSIONS,
    query: 'sentry.release_health.crash_free_sessions',
    dimensions: ['environment', 'release', 'platform'],
    metricType: 'gauge',
  },

  RESPONSE_TIME_P95: {
    id: 'response_time_p95',
    name: 'Response Time P95',
    description: '95分位响应时间',
    unit: MetricUnit.Milliseconds,
    nfrKey: NFR_KEYS.PERFORMANCE.RESPONSE_TIME,
    query: 'custom.performance.response_time.p95',
    dimensions: ['service', 'endpoint', 'environment'],
    metricType: 'histogram',
  },
} as const;

/**
 * 核心 SLO 定义常量
 */
export const CORE_SLOS: Record<string, ServiceLevelObjective> = {
  CRASH_FREE_USERS: {
    id: 'crash_free_users_slo',
    sliId: 'crash_free_users',
    targets: {
      production: '≥99.5%',
      staging: '≥99.0%',
      development: '≥95.0%',
    },
    observationWindow: '24h',
    alertThreshold: '≤99.0%',
  },

  CRASH_FREE_SESSIONS: {
    id: 'crash_free_sessions_slo',
    sliId: 'crash_free_sessions',
    targets: {
      production: '≥99.8%',
      staging: '≥99.5%',
      development: '≥97.0%',
    },
    observationWindow: '24h',
    alertThreshold: '≤99.5%',
  },

  RESPONSE_TIME_P95: {
    id: 'response_time_p95_slo',
    sliId: 'response_time_p95',
    targets: {
      production: '≤2000ms',
      staging: '≤3000ms',
      development: '≤5000ms',
    },
    observationWindow: '1h',
    alertThreshold: '≥2500ms',
  },
} as const;

// ============================================================================
// Release Health Gate - 发布健康门禁
// ============================================================================

/**
 * Release Health 检查结果
 */
export interface ReleaseHealthResult {
  /** 是否通过门禁检查 */
  readonly passed: boolean;
  /** 指标数值 */
  readonly metrics: {
    readonly crashFreeUsers: number;
    readonly crashFreeSessions: number;
    readonly sampleSize: number;
    readonly observationWindow: string;
  };
  /** 违规项列表 */
  readonly violations: ReadonlyArray<{
    readonly metric: string;
    readonly actual: number;
    readonly threshold: number;
    readonly severity: 'warning' | 'blocking';
  }>;
  /** 检查时间戳 */
  readonly timestamp: string;
  /** 环境信息 */
  readonly environment: string;
}

/**
 * Release Health Gate 配置
 */
export interface ReleaseHealthGateConfig {
  /** Sentry 组织 */
  readonly sentryOrg: string;
  /** Sentry 项目 */
  readonly sentryProject: string;
  /** 认证令牌 */
  readonly authToken: string;
  /** 环境配置 */
  readonly environment?: {
    readonly CRASH_FREE_USERS_THRESHOLD?: string;
    readonly CRASH_FREE_SESSIONS_THRESHOLD?: string;
    readonly OBSERVATION_WINDOW_HOURS?: string;
  };
}

/**
 * Release Health Gate 主类
 * 用于 CI/CD 流程中的发布健康检查
 */
export class ReleaseHealthGate {
  private readonly config: ReleaseHealthGateConfig;

  constructor(config: ReleaseHealthGateConfig) {
    this.config = config;
  }

  /**
   * 执行 Release Health 检查
   * @returns Promise<ReleaseHealthResult> 检查结果
   */
  async checkReleaseHealth(): Promise<ReleaseHealthResult> {
    try {
      // 获取配置阈值（支持环境变量覆盖）
      const crashFreeUsersThreshold = Number(
        this.config.environment?.CRASH_FREE_USERS_THRESHOLD ??
          process.env.CRASH_FREE_USERS_THRESHOLD ??
          '99.5'
      );

      const crashFreeSessionsThreshold = Number(
        this.config.environment?.CRASH_FREE_SESSIONS_THRESHOLD ??
          process.env.CRASH_FREE_SESSIONS_THRESHOLD ??
          '99.8'
      );

      const observationWindowHours = Number(
        this.config.environment?.OBSERVATION_WINDOW_HOURS ??
          process.env.OBSERVATION_WINDOW_HOURS ??
          '24'
      );

      // 调用 Sentry API 获取实际指标
      const metrics = await this.fetchReleaseHealthMetrics(
        observationWindowHours
      );

      // 检查违规项
      const violationList: Array<{
        readonly metric: string;
        readonly actual: number;
        readonly threshold: number;
        readonly severity: 'warning' | 'blocking';
      }> = [];

      if (metrics.crashFreeUsers < crashFreeUsersThreshold) {
        violationList.push({
          metric: 'crash_free_users',
          actual: metrics.crashFreeUsers,
          threshold: crashFreeUsersThreshold,
          severity: 'blocking',
        });
      }

      if (metrics.crashFreeSessions < crashFreeSessionsThreshold) {
        violationList.push({
          metric: 'crash_free_sessions',
          actual: metrics.crashFreeSessions,
          threshold: crashFreeSessionsThreshold,
          severity: 'blocking',
        });
      }

      const violations = violationList as ReleaseHealthResult['violations'];

      return {
        passed: violations.length === 0,
        metrics,
        violations,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV ?? 'unknown',
      };
    } catch (error) {
      throw new Error(
        `Release Health Gate 检查失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 生成检查报告
   * @returns Promise<string> Markdown 格式的报告
   */
  async generateReport(): Promise<string> {
    const result = await this.checkReleaseHealth();

    const report = [
      '# Release Health Gate Report',
      '',
      `**Status**: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `**Timestamp**: ${result.timestamp}`,
      `**Environment**: ${result.environment}`,
      '',
      '## Metrics',
      '',
      `- **Crash-Free Users**: ${result.metrics.crashFreeUsers.toFixed(2)}%`,
      `- **Crash-Free Sessions**: ${result.metrics.crashFreeSessions.toFixed(2)}%`,
      `- **Sample Size**: ${result.metrics.sampleSize}`,
      `- **Observation Window**: ${result.metrics.observationWindow}`,
      '',
    ];

    if (result.violations.length > 0) {
      report.push('## Violations', '');
      result.violations.forEach(violation => {
        report.push(
          `- **${violation.metric}**: ${violation.actual} < ${violation.threshold} (${violation.severity})`
        );
      });
      report.push('');
    }

    return report.join('\n');
  }

  /**
   * 从 Sentry API 获取 Release Health 指标
   * @private
   */
  private async fetchReleaseHealthMetrics(
    observationWindowHours: number
  ): Promise<ReleaseHealthResult['metrics']> {
    // 这里是 Sentry API 调用的占位实现
    // 实际实现中会调用 Sentry Release Health API

    // 模拟 API 响应（实际实现中应该调用真实 API）
    const mockMetrics = {
      crashFreeUsers: 99.7,
      crashFreeSessions: 99.9,
      sampleSize: 10000,
      observationWindow: `${observationWindowHours}h`,
    };

    // TODO: 实现真实的 Sentry API 调用
    // const apiUrl = `https://sentry.io/api/0/organizations/${this.config.sentryOrg}/projects/${this.config.sentryProject}/releases/`;
    // const response = await fetch(apiUrl, {
    //   headers: {
    //     'Authorization': `Bearer ${this.config.authToken}`
    //   }
    // });

    return mockMetrics;
  }
}

// ============================================================================
// 事件命名规范
// ============================================================================

/**
 * 事件命名模式
 * 格式: {domain}.{entity}.{action}.{status?}
 */
export const EVENT_NAMING_PATTERNS = {
  SYSTEM: {
    prefix: 'system',
    patterns: [
      'system.app.{start|stop|crash}',
      'system.process.{spawn|terminate}',
      'system.memory.{warning|critical}',
    ],
  },
} as const;

/**
 * 标准事件上下文接口
 */
export interface EventContext {
  /** 事件时间戳 */
  readonly timestamp: number;
  /** 会话标识 */
  readonly sessionId: string;
  /** 用户标识（可选） */
  readonly userId?: string;
  /** 分布式追踪ID */
  readonly traceId?: string;

  /** 应用版本 */
  readonly appVersion: string;
  /** 构建号 */
  readonly buildNumber: string;
  /** 平台信息 */
  readonly platform: string;
  /** 运行环境 */
  readonly environment: string;

  /** 性能上下文（可选） */
  readonly performance?: {
    readonly duration_ms?: number;
    readonly memory_mb?: number;
    readonly cpu_percent?: number;
    readonly fps?: number;
  };

  /** 错误上下文（可选） */
  readonly error?: {
    readonly type: string;
    readonly message: string;
    readonly stack?: string;
    readonly handled: boolean;
  };
}

// ============================================================================
// 可追溯性矩阵
// ============================================================================

/**
 * 可追溯性矩阵接口
 */
export interface TraceabilityMatrix {
  /** NFR 到 SLO 的映射 */
  readonly nfrToSlo: Record<
    NFRKey,
    {
      readonly slo: string;
      readonly adr: readonly string[];
      readonly testRefs: readonly string[];
      readonly monitoringQuery: string;
    }
  >;

  /** ADR 到实现的映射 */
  readonly adrToImplementation: Record<
    string,
    {
      readonly title: string;
      readonly implementations: readonly string[];
      readonly tests: readonly string[];
    }
  >;
}

/**
 * 可追溯性矩阵实例
 */
export const TRACEABILITY_MATRIX: TraceabilityMatrix = {
  nfrToSlo: {
    [NFR_KEYS.RELIABILITY.CRASH_FREE_USERS]: {
      slo: 'crash_free_users >= 99.5%',
      adr: ['ADR-0003'],
      testRefs: ['tests/e2e/reliability.spec.ts'],
      monitoringQuery: 'sentry.release_health.crash_free_users',
    },

    [NFR_KEYS.PERFORMANCE.RESPONSE_TIME]: {
      slo: 'response_time p95 < 2000ms',
      adr: ['ADR-0003', 'ADR-0005'],
      testRefs: ['tests/unit/performance.spec.ts'],
      monitoringQuery: 'custom.performance.response_time.p95',
    },
    // 其他映射项会在运行时动态构建
  } as Record<NFRKey, any>,

  adrToImplementation: {
    'ADR-0003': {
      title: '可观测性与 Release Health',
      implementations: [
        'src/shared/observability/sentry-main.ts',
        'src/shared/observability/logger.ts',
        'scripts/release-health-gate.mjs',
      ],
      tests: [
        'tests/unit/observability.spec.ts',
        'tests/e2e/monitoring.spec.ts',
      ],
    },

    'ADR-0005': {
      title: '质量门禁',
      implementations: [
        'scripts/quality-gates.mjs',
        '.github/workflows/ci.yml',
      ],
      tests: ['tests/unit/quality-gates.spec.ts'],
    },
  },
} as const;

// ============================================================================
// V2 增强：游戏特定监控契约
// ============================================================================

/**
 * 游戏特定SLI定义 - v2新增
 * 基于03-observability-sentry-logging-v2.md § 3.4
 */
export const GAME_MONITORING_SLIS = {
  PHASER_SCENE_TRANSITION: {
    id: 'phaser_scene_transition_time',
    name: 'Phaser Scene Transition Time',
    description: 'Phaser场景切换耗时',
    target: 'P95 ≤ 200ms',
    unit: 'milliseconds',
    nfrKey: NFR_KEYS.PERFORMANCE.RESPONSE_TIME,
    query: 'custom.phaser.scene_transition.p95',
  },

  REACT_PHASER_SYNC: {
    id: 'react_phaser_sync_latency',
    name: 'React-Phaser Sync Latency',
    description: 'React UI与Phaser游戏层同步延迟',
    target: 'P95 ≤ 50ms',
    unit: 'milliseconds',
    nfrKey: NFR_KEYS.PERFORMANCE.RESPONSE_TIME,
    query: 'custom.communication.react_phaser_sync.p95',
  },

  BATTLE_COMPUTATION_TIME: {
    id: 'battle_computation_time',
    name: 'Battle Computation Time',
    description: '${DOMAIN_BATTLE}结果计算耗时',
    target: 'P95 ≤ 50ms',
    unit: 'milliseconds',
    nfrKey: NFR_KEYS.PERFORMANCE.RESPONSE_TIME,
    query: 'custom.game.battle_computation.p95',
  },

  AI_DECISION_TIME: {
    id: 'ai_decision_time',
    name: 'AI Decision Time',
    description: 'AI决策计算时间',
    target: 'P95 ≤ 200ms',
    unit: 'milliseconds',
    nfrKey: NFR_KEYS.PERFORMANCE.RESPONSE_TIME,
    query: 'custom.ai.decision_time.p95',
  },

  SAVE_GAME_TIME: {
    id: 'save_game_time',
    name: 'Save Game Time',
    description: '游戏数据保存耗时',
    target: 'P95 ≤ 1000ms',
    unit: 'milliseconds',
    nfrKey: NFR_KEYS.PERFORMANCE.RESPONSE_TIME,
    query: 'custom.persistence.save_game.p95',
  },
} as const;

/**
 * Tier-0关键监控阈值 - 对应01-约束与目标-v2.md § 1.4
 * v2新增：环境差异化配置
 */
export const TIER_0_THRESHOLDS = {
  crashFreeUsers: {
    production: 99.5, // 参考 01-约束与目标-v2.md § 1.4
    staging: 99.0,
    development: 95.0,
  },
  crashFreeSessions: {
    production: 99.8, // 参考 01-约束与目标-v2.md § 1.4
    staging: 99.5,
    development: 97.0,
  },
  criticalErrors: {
    production: 0, // 零容忍关键错误
    staging: 1,
    development: 5,
  },
  performanceRegression: {
    frameTimeP95: 16.7, // 60fps要求
    interactionP95: 100, // 用户交互响应
    startupTimeP95: 3000, // 启动时间
  },
} as const;

// ============================================================================
// V2 增强：智能采样策略
// ============================================================================

/**
 * 环境差异化采样配置 - v2增强
 * 基于03-observability-sentry-logging-v2.md § 3.5
 */
export interface SamplingConfig {
  readonly environment: Environment;
  readonly errorSampling: number; // 错误采样率 0.0-1.0
  readonly transactionSampling: number; // 性能追踪采样率 0.0-1.0
  readonly replaySampling: number; // 会话回放采样率 0.0-1.0
  readonly costBudgetMonthly: number; // 月度成本预算（美元）
  readonly adaptiveThresholds?: {
    readonly errorRateThreshold: number; // 错误率阈值超过时自动降低采样
    readonly performanceRegressionThreshold: number; // 性能回归阈值
  };
}

/**
 * 采样策略验证函数
 */
export function validateSamplingConfig(config: SamplingConfig): boolean {
  return (
    config.errorSampling >= 0 &&
    config.errorSampling <= 1 &&
    config.transactionSampling >= 0 &&
    config.transactionSampling <= 1 &&
    config.replaySampling >= 0 &&
    config.replaySampling <= 1 &&
    config.costBudgetMonthly > 0
  );
}

export const SAMPLING_STRATEGIES: Record<Environment, SamplingConfig> = {
  production: {
    environment: 'production',
    errorSampling: 1.0, // 100%错误采集
    transactionSampling: 0.1, // 10%性能追踪
    replaySampling: 0.01, // 1%会话回放
    costBudgetMonthly: 800, // $800/月预算
    adaptiveThresholds: {
      errorRateThreshold: 0.05, // 5%错误率阈值
      performanceRegressionThreshold: 1.2, // 20%性能回归阈值
    },
  },

  staging: {
    environment: 'staging',
    errorSampling: 1.0, // 100%错误采集
    transactionSampling: 0.3, // 30%性能追踪
    replaySampling: 0.05, // 5%会话回放
    costBudgetMonthly: 200, // $200/月预算
    adaptiveThresholds: {
      errorRateThreshold: 0.1, // 10%错误率阈值
      performanceRegressionThreshold: 1.5, // 50%性能回归阈值
    },
  },

  development: {
    environment: 'development',
    errorSampling: 1.0, // 100%错误采集
    transactionSampling: 1.0, // 100%性能追踪
    replaySampling: 0.1, // 10%会话回放
    costBudgetMonthly: 100, // $100/月预算
    // development环境不启用自适应阈值
  },
} as const;

// ============================================================================
// 默认配置常量（保留向后兼容）
// ============================================================================

/**
 * 默认采样配置 - 保留向后兼容
 * @deprecated 使用 SAMPLING_STRATEGIES 替代
 */
export const DEFAULT_SAMPLING_CONFIG = {
  production: {
    errors: 1.0,
    transactions: 0.1,
    replays: 0.01,
  },
  staging: {
    errors: 1.0,
    transactions: 0.3,
    replays: 0.05,
  },
  development: {
    errors: 1.0,
    transactions: 1.0,
    replays: 0.1,
  },
} as const;

/**
 * 默认观察窗口配置 - 增强版
 * 基于AWS CloudWatch和Sentry最佳实践
 */
export const DEFAULT_OBSERVATION_WINDOWS = {
  realtime: '5m',
  shortTerm: '1h',
  mediumTerm: '24h',
  longTerm: '7d',
  release: '72h',
  weekly: '7d',
  monthly: '30d',
} as const;

/**
 * 性能监控配置接口 - 新增
 * 基于AWS Powertools Metrics最佳实践
 */
export interface PerformanceMonitoringConfig {
  readonly enabled: boolean;
  readonly sampleRate: number; // 0.0-1.0
  readonly bufferSize: number; // 指标缓冲区大小
  readonly flushInterval: number; // 刷新间隔（毫秒）
  readonly dimensions: {
    readonly service: string;
    readonly version: string;
    readonly environment: Environment;
  };
  readonly thresholds: {
    readonly errorRate: number; // 错误率阈值
    readonly responseTime: number; // 响应时间阈值（ms）
    readonly memoryUsage: number; // 内存使用阈值（MB）
  };
}

/**
 * 默认性能监控配置
 */
export const DEFAULT_PERFORMANCE_MONITORING_CONFIG: PerformanceMonitoringConfig =
  {
    enabled: true,
    sampleRate: 0.1, // 10%采样率
    bufferSize: 100, // 100个指标缓冲
    flushInterval: 30000, // 30秒刷新一次
    dimensions: {
      service: process.env.POWERTOOLS_SERVICE_NAME || 'vitegame',
      version: process.env.npm_package_version || '1.0.0',
      environment: (process.env.NODE_ENV as Environment) || 'development',
    },
    thresholds: {
      errorRate: 0.05, // 5%错误率阈值
      responseTime: 2000, // 2秒响应时间阈值
      memoryUsage: 512, // 512MB内存使用阈值
    },
  } as const;

// ============================================================================
// 类型导出 - 增强版
// ============================================================================

export type Environment = 'production' | 'staging' | 'development';
export type ObservationWindows = typeof DEFAULT_OBSERVATION_WINDOWS;

/**
 * 指标类型联合类型 - 用于类型安全的指标操作
 */
export type MetricValue = number;
export type MetricName = string;
export type MetricDimensions = Record<string, string>;
export type MetricTimestamp = number | Date;

/**
 * 指标上报参数接口
 */
export interface MetricSubmission {
  readonly name: MetricName;
  readonly value: MetricValue;
  readonly unit: MetricUnit;
  readonly dimensions?: MetricDimensions;
  readonly timestamp?: MetricTimestamp;
}

// ============================================================================
// 实用工具函数 - 基于AWS Powertools最佳实践
// ============================================================================

/**
 * 指标工厂函数 - 创建类型安全的指标提交对象
 */
export function createMetricSubmission(
  name: MetricName,
  value: MetricValue,
  unit: MetricUnit,
  dimensions?: MetricDimensions,
  timestamp?: MetricTimestamp
): MetricSubmission {
  return {
    name,
    value,
    unit,
    dimensions,
    timestamp: timestamp || new Date(),
  };
}

/**
 * 性能指标工厂 - 专门用于创建性能相关指标
 */
export class PerformanceMetricsFactory {
  protected readonly defaultDimensions: MetricDimensions;

  constructor(defaultDimensions: MetricDimensions = {}) {
    this.defaultDimensions = defaultDimensions;
  }

  /**
   * 创建响应时间指标
   */
  createResponseTimeMetric(
    value: number,
    additionalDimensions?: MetricDimensions
  ): MetricSubmission {
    return createMetricSubmission(
      'response_time',
      value,
      MetricUnit.Milliseconds,
      { ...this.defaultDimensions, ...additionalDimensions }
    );
  }

  /**
   * 创建内存使用指标
   */
  createMemoryUsageMetric(
    value: number,
    additionalDimensions?: MetricDimensions
  ): MetricSubmission {
    return createMetricSubmission('memory_usage', value, MetricUnit.Megabytes, {
      ...this.defaultDimensions,
      ...additionalDimensions,
    });
  }

  /**
   * 创建CPU使用率指标
   */
  createCPUUsageMetric(
    value: number,
    additionalDimensions?: MetricDimensions
  ): MetricSubmission {
    return createMetricSubmission('cpu_usage', value, MetricUnit.Percent, {
      ...this.defaultDimensions,
      ...additionalDimensions,
    });
  }

  /**
   * 创建错误计数指标
   */
  createErrorCountMetric(
    value: number = 1,
    errorType?: string,
    additionalDimensions?: MetricDimensions
  ): MetricSubmission {
    return createMetricSubmission('error_count', value, MetricUnit.Count, {
      ...this.defaultDimensions,
      ...(errorType && { errorType }),
      ...additionalDimensions,
    });
  }

  /**
   * 创建吞吐量指标
   */
  createThroughputMetric(
    value: number,
    additionalDimensions?: MetricDimensions
  ): MetricSubmission {
    return createMetricSubmission(
      'throughput',
      value,
      MetricUnit.CountPerSecond,
      { ...this.defaultDimensions, ...additionalDimensions }
    );
  }
}

/**
 * 游戏指标工厂 - 专门用于游戏相关指标
 */
export class GameMetricsFactory extends PerformanceMetricsFactory {
  /**
   * 创建关卡加载时间指标
   */
  createLevelLoadTimeMetric(
    loadTime: number,
    levelId: string,
    difficulty?: string
  ): MetricSubmission {
    return createMetricSubmission(
      'level_load_time',
      loadTime,
      MetricUnit.Milliseconds,
      {
        ...this.defaultDimensions,
        levelId,
        ...(difficulty && { difficulty }),
      }
    );
  }

  /**
   * 创建战斗回合时间指标
   */
  createBattleRoundTimeMetric(
    roundTime: number,
    battleType: string,
    round: number
  ): MetricSubmission {
    return createMetricSubmission(
      'battle_round_time',
      roundTime,
      MetricUnit.Milliseconds,
      {
        ...this.defaultDimensions,
        battleType,
        round: round.toString(),
      }
    );
  }

  /**
   * 创建AI决策时间指标
   */
  createAIDecisionTimeMetric(
    decisionTime: number,
    aiType: string,
    complexity: string
  ): MetricSubmission {
    return createMetricSubmission(
      'ai_decision_time',
      decisionTime,
      MetricUnit.Milliseconds,
      {
        ...this.defaultDimensions,
        aiType,
        complexity,
      }
    );
  }

  /**
   * 创建场景转换时间指标
   */
  createSceneTransitionMetric(
    transitionTime: number,
    fromScene: string,
    toScene: string
  ): MetricSubmission {
    return createMetricSubmission(
      'scene_transition_time',
      transitionTime,
      MetricUnit.Milliseconds,
      {
        ...this.defaultDimensions,
        fromScene,
        toScene,
      }
    );
  }

  /**
   * 创建资源加载时间指标
   */
  createAssetLoadTimeMetric(
    loadTime: number,
    assetType: string,
    assetSize?: number
  ): MetricSubmission {
    return createMetricSubmission(
      'asset_load_time',
      loadTime,
      MetricUnit.Milliseconds,
      {
        ...this.defaultDimensions,
        assetType,
        ...(assetSize && { assetSize: assetSize.toString() }),
      }
    );
  }
}

/**
 * 指标验证函数
 */
export function validateMetricSubmission(metric: MetricSubmission): boolean {
  if (!metric.name || typeof metric.name !== 'string') return false;
  if (typeof metric.value !== 'number' || !isFinite(metric.value)) return false;
  if (!Object.values(MetricUnit).includes(metric.unit)) return false;

  // 验证维度
  if (metric.dimensions) {
    for (const [key, value] of Object.entries(metric.dimensions)) {
      if (typeof key !== 'string' || typeof value !== 'string') return false;
      if (key.length === 0 || value.length === 0) return false;
    }
  }

  return true;
}

/**
 * 获取当前环境的性能监控配置
 */
export function getPerformanceMonitoringConfig(
  environment?: Environment
): PerformanceMonitoringConfig {
  const env =
    environment || (process.env.NODE_ENV as Environment) || 'development';

  return {
    ...DEFAULT_PERFORMANCE_MONITORING_CONFIG,
    dimensions: {
      ...DEFAULT_PERFORMANCE_MONITORING_CONFIG.dimensions,
      environment: env,
    },
  };
}

/**
 * 检查指标是否应该被采样
 */
export function shouldSampleMetric(
  environment: Environment,
  metricType: 'error' | 'transaction' | 'replay' = 'transaction'
): boolean {
  const config = SAMPLING_STRATEGIES[environment];
  if (!config) return false;

  const sampleRate =
    metricType === 'error'
      ? config.errorSampling
      : metricType === 'transaction'
        ? config.transactionSampling
        : config.replaySampling;

  return Math.random() < sampleRate;
}

/**
 * 创建默认的指标工厂实例
 */
export function createMetricsFactory(environment?: Environment): {
  performance: PerformanceMetricsFactory;
  game: GameMetricsFactory;
} {
  const config = getPerformanceMonitoringConfig(environment);
  const defaultDimensions = config.dimensions as MetricDimensions;

  return {
    performance: new PerformanceMetricsFactory(defaultDimensions),
    game: new GameMetricsFactory(defaultDimensions),
  };
}

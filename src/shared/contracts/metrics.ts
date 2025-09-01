/**
 * @fileoverview 可观测性指标契约定义
 * @description 基于 03-可观测性(Sentry+日志)-v2.md 的 TypeScript 契约实现
 * @references ADR-0003 (可观测性与 Release Health), ADR-0005 (质量门禁)
 */

// ============================================================================
// NFR Keys - 非功能性需求键值定义
// ============================================================================

/**
 * NFR (Non-Functional Requirements) 标识符
 * 用于追踪非功能性需求到 SLO 的映射关系
 */
export const NFR_KEYS = {
  // 可靠性需求
  RELIABILITY: {
    CRASH_FREE_USERS: 'NFR-RELIABILITY-001',
    CRASH_FREE_SESSIONS: 'NFR-RELIABILITY-002',
    SERVICE_AVAILABILITY: 'NFR-RELIABILITY-003',
    DATA_CONSISTENCY: 'NFR-RELIABILITY-004',
  },

  // 性能需求
  PERFORMANCE: {
    RESPONSE_TIME: 'NFR-PERFORMANCE-001',
    THROUGHPUT: 'NFR-PERFORMANCE-002',
    MEMORY_USAGE: 'NFR-PERFORMANCE-003',
    CPU_USAGE: 'NFR-PERFORMANCE-004',
    STARTUP_TIME: 'NFR-PERFORMANCE-005',
  },

  // 可用性需求
  AVAILABILITY: {
    UPTIME: 'NFR-AVAILABILITY-001',
    RECOVERY_TIME: 'NFR-AVAILABILITY-002',
    FAILOVER_TIME: 'NFR-AVAILABILITY-003',
  },

  // 安全性需求
  SECURITY: {
    AUTH_SUCCESS_RATE: 'NFR-SECURITY-001',
    DATA_BREACH_PREVENTION: 'NFR-SECURITY-002',
    PRIVILEGE_COMPLIANCE: 'NFR-SECURITY-003',
  },
} as const;

/**
 * NFR 类型定义
 */
export type NFRKey =
  (typeof NFR_KEYS)[keyof typeof NFR_KEYS][keyof (typeof NFR_KEYS)[keyof typeof NFR_KEYS]];

// ============================================================================
// SLI/SLO 定义
// ============================================================================

/**
 * SLI (Service Level Indicator) 定义
 */
export interface ServiceLevelIndicator {
  /** 指标唯一标识符 */
  readonly id: string;
  /** 指标名称 */
  readonly name: string;
  /** 指标描述 */
  readonly description: string;
  /** 指标单位 */
  readonly unit: string;
  /** 对应的 NFR 键值 */
  readonly nfrKey: NFRKey;
  /** 查询语句 */
  readonly query: string;
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
    unit: 'percentage',
    nfrKey: NFR_KEYS.RELIABILITY.CRASH_FREE_USERS,
    query: 'sentry.release_health.crash_free_users',
  },

  CRASH_FREE_SESSIONS: {
    id: 'crash_free_sessions',
    name: 'Crash-Free Sessions',
    description: '在观察窗口内未崩溃的会话百分比',
    unit: 'percentage',
    nfrKey: NFR_KEYS.RELIABILITY.CRASH_FREE_SESSIONS,
    query: 'sentry.release_health.crash_free_sessions',
  },

  RESPONSE_TIME_P95: {
    id: 'response_time_p95',
    name: 'Response Time P95',
    description: '95分位响应时间',
    unit: 'milliseconds',
    nfrKey: NFR_KEYS.PERFORMANCE.RESPONSE_TIME,
    query: 'custom.performance.response_time.p95',
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
  readonly environment: 'production' | 'staging' | 'development';
  readonly errorSampling: number; // 错误采样率 0.0-1.0
  readonly transactionSampling: number; // 性能追踪采样率
  readonly replaySampling: number; // 会话回放采样率
  readonly costBudgetMonthly: number; // 月度成本预算（美元）
}

export const SAMPLING_STRATEGIES: Record<string, SamplingConfig> = {
  production: {
    environment: 'production',
    errorSampling: 1.0, // 100%错误采集
    transactionSampling: 0.1, // 10%性能追踪
    replaySampling: 0.01, // 1%会话回放
    costBudgetMonthly: 800, // $800/月预算
  },

  staging: {
    environment: 'staging',
    errorSampling: 1.0, // 100%错误采集
    transactionSampling: 0.3, // 30%性能追踪
    replaySampling: 0.05, // 5%会话回放
    costBudgetMonthly: 200, // $200/月预算
  },

  development: {
    environment: 'development',
    errorSampling: 1.0, // 100%错误采集
    transactionSampling: 1.0, // 100%性能追踪
    replaySampling: 0.1, // 10%会话回放
    costBudgetMonthly: 100, // $100/月预算
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
 * 默认观察窗口配置
 */
export const DEFAULT_OBSERVATION_WINDOWS = {
  realtime: '5m',
  shortTerm: '1h',
  mediumTerm: '24h',
  longTerm: '7d',
  release: '72h',
} as const;

// ============================================================================
// 类型导出
// ============================================================================

export type Environment = 'production' | 'staging' | 'development';
// SamplingConfig interface已在上面定义，不需要重复类型导出
export type ObservationWindows = typeof DEFAULT_OBSERVATION_WINDOWS;

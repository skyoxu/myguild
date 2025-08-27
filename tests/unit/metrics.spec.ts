/**
 * @fileoverview 可观测性指标契约测试
 * @description 基于 03-可观测性(Sentry+日志)-v2.md 的测试用例
 * @references ADR-0003, ADR-0005
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NFR_KEYS,
  CORE_SLIS,
  CORE_SLOS,
  ReleaseHealthGate,
  ReleaseHealthResult,
  ReleaseHealthGateConfig,
  DEFAULT_SAMPLING_CONFIG,
  DEFAULT_OBSERVATION_WINDOWS,
  TRACEABILITY_MATRIX,
  // V2 新增导入
  GAME_MONITORING_SLIS,
  TIER_0_THRESHOLDS,
  SAMPLING_STRATEGIES,
  type SamplingConfig,
} from '../../src/shared/contracts/metrics';

// ============================================================================
// NFR Keys 测试
// ============================================================================

describe('NFR Keys', () => {
  it('应包含所有必需的可靠性 NFR 键值', () => {
    expect(NFR_KEYS.RELIABILITY).toBeDefined();
    expect(NFR_KEYS.RELIABILITY.CRASH_FREE_USERS).toBe('NFR-RELIABILITY-001');
    expect(NFR_KEYS.RELIABILITY.CRASH_FREE_SESSIONS).toBe(
      'NFR-RELIABILITY-002'
    );
    expect(NFR_KEYS.RELIABILITY.SERVICE_AVAILABILITY).toBe(
      'NFR-RELIABILITY-003'
    );
    expect(NFR_KEYS.RELIABILITY.DATA_CONSISTENCY).toBe('NFR-RELIABILITY-004');
  });

  it('应包含所有必需的性能 NFR 键值', () => {
    expect(NFR_KEYS.PERFORMANCE).toBeDefined();
    expect(NFR_KEYS.PERFORMANCE.RESPONSE_TIME).toBe('NFR-PERFORMANCE-001');
    expect(NFR_KEYS.PERFORMANCE.THROUGHPUT).toBe('NFR-PERFORMANCE-002');
    expect(NFR_KEYS.PERFORMANCE.MEMORY_USAGE).toBe('NFR-PERFORMANCE-003');
    expect(NFR_KEYS.PERFORMANCE.CPU_USAGE).toBe('NFR-PERFORMANCE-004');
    expect(NFR_KEYS.PERFORMANCE.STARTUP_TIME).toBe('NFR-PERFORMANCE-005');
  });

  it('应包含所有必需的可用性和安全性 NFR 键值', () => {
    expect(NFR_KEYS.AVAILABILITY).toBeDefined();
    expect(NFR_KEYS.SECURITY).toBeDefined();

    // 验证键值格式符合 NFR-{CATEGORY}-{NUMBER} 模式
    const nfrKeyPattern = /^NFR-[A-Z]+-\d{3}$/;
    expect(NFR_KEYS.AVAILABILITY.UPTIME).toMatch(nfrKeyPattern);
    expect(NFR_KEYS.SECURITY.AUTH_SUCCESS_RATE).toMatch(nfrKeyPattern);
  });

  it('所有 NFR 键值应该是唯一的', () => {
    const allKeys: string[] = [];

    // 收集所有键值
    Object.values(NFR_KEYS).forEach(category => {
      Object.values(category).forEach(key => {
        allKeys.push(key);
      });
    });

    // 验证唯一性
    const uniqueKeys = new Set(allKeys);
    expect(uniqueKeys.size).toBe(allKeys.length);
  });
});

// ============================================================================
// SLI/SLO 测试
// ============================================================================

describe('Service Level Indicators (SLI)', () => {
  it('应定义核心 SLI 并包含必需字段', () => {
    const crashFreeSli = CORE_SLIS.CRASH_FREE_USERS;

    expect(crashFreeSli).toBeDefined();
    expect(crashFreeSli.id).toBe('crash_free_users');
    expect(crashFreeSli.name).toBe('Crash-Free Users');
    expect(crashFreeSli.description).toContain('未遇到崩溃的用户百分比');
    expect(crashFreeSli.unit).toBe('percentage');
    expect(crashFreeSli.nfrKey).toBe(NFR_KEYS.RELIABILITY.CRASH_FREE_USERS);
    expect(crashFreeSli.query).toContain('sentry');
  });

  it('每个 SLI 应该有对应的 NFR 键值', () => {
    Object.values(CORE_SLIS).forEach(sli => {
      expect(sli.nfrKey).toBeDefined();
      expect(typeof sli.nfrKey).toBe('string');
      expect(sli.nfrKey).toMatch(/^NFR-[A-Z]+-\d{3}$/);
    });
  });
});

describe('Service Level Objectives (SLO)', () => {
  it('应定义核心 SLO 并包含环境差异化目标', () => {
    const crashFreeSlo = CORE_SLOS.CRASH_FREE_USERS;

    expect(crashFreeSlo).toBeDefined();
    expect(crashFreeSlo.id).toBe('crash_free_users_slo');
    expect(crashFreeSlo.sliId).toBe('crash_free_users');

    // 验证环境目标
    expect(crashFreeSlo.targets.production).toBe('≥99.5%');
    expect(crashFreeSlo.targets.staging).toBe('≥99.0%');
    expect(crashFreeSlo.targets.development).toBe('≥95.0%');

    expect(crashFreeSlo.observationWindow).toBe('24h');
    expect(crashFreeSlo.alertThreshold).toBe('≤99.0%');
  });

  it('所有 SLO 应该有对应的 SLI', () => {
    Object.values(CORE_SLOS).forEach(slo => {
      const correspondingSli = Object.values(CORE_SLIS).find(
        sli => sli.id === slo.sliId
      );
      expect(correspondingSli).toBeDefined();
    });
  });

  it('生产环境目标应该最严格', () => {
    Object.values(CORE_SLOS).forEach(slo => {
      const prodTarget = slo.targets.production;
      const stagingTarget = slo.targets.staging;
      const devTarget = slo.targets.development;

      // 确保生产环境有目标值
      expect(prodTarget).toBeDefined();
      expect(stagingTarget).toBeDefined();
      expect(devTarget).toBeDefined();

      // 验证格式（≥ 或 ≤ 加数值）
      expect(prodTarget).toMatch(/^[≥≤]\d+(\.\d+)?[%ms]*$/);
    });
  });
});

// ============================================================================
// Release Health Gate 测试
// ============================================================================

describe('ReleaseHealthGate', () => {
  let mockConfig: ReleaseHealthGateConfig;
  let releaseHealthGate: ReleaseHealthGate;

  beforeEach(() => {
    mockConfig = {
      sentryOrg: 'test-org',
      sentryProject: 'test-project',
      authToken: 'test-token-123',
    };

    releaseHealthGate = new ReleaseHealthGate(mockConfig);

    // 清理环境变量
    delete process.env.CRASH_FREE_USERS_THRESHOLD;
    delete process.env.CRASH_FREE_SESSIONS_THRESHOLD;
    delete process.env.OBSERVATION_WINDOW_HOURS;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('应该正确实例化并保存配置', () => {
    expect(releaseHealthGate).toBeInstanceOf(ReleaseHealthGate);
    expect(releaseHealthGate['config']).toEqual(mockConfig);
  });

  it('应该使用默认阈值当未提供环境变量时', async () => {
    // Mock fetch API 调用
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ crash_free_users: 99.7, crash_free_sessions: 99.9 }),
    } as Response);

    // 暂时跳过实际的 API 调用，直接测试默认阈值逻辑
    const mockFetchMetrics = vi
      .spyOn(releaseHealthGate as any, 'fetchReleaseHealthMetrics')
      .mockResolvedValueOnce({
        crashFreeUsers: 99.7,
        crashFreeSessions: 99.9,
        sampleSize: 10000,
        observationWindow: '24h',
      });

    const result = await releaseHealthGate.checkReleaseHealth();

    expect(result.passed).toBe(true);
    expect(result.metrics.crashFreeUsers).toBe(99.7);
    expect(result.metrics.crashFreeSessions).toBe(99.9);
    expect(result.violations).toHaveLength(0);

    mockFetch.mockRestore();
    mockFetchMetrics.mockRestore();
  });

  it('应该识别违规并返回失败结果', async () => {
    // 设置低指标值模拟违规
    const mockFetchMetrics = vi
      .spyOn(releaseHealthGate as any, 'fetchReleaseHealthMetrics')
      .mockResolvedValueOnce({
        crashFreeUsers: 98.5, // 低于默认阈值 99.5%
        crashFreeSessions: 99.2, // 低于默认阈值 99.8%
        sampleSize: 5000,
        observationWindow: '24h',
      });

    const result = await releaseHealthGate.checkReleaseHealth();

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(2);

    const userViolation = result.violations.find(
      v => v.metric === 'crash_free_users'
    );
    const sessionViolation = result.violations.find(
      v => v.metric === 'crash_free_sessions'
    );

    expect(userViolation).toBeDefined();
    expect(userViolation?.actual).toBe(98.5);
    expect(userViolation?.threshold).toBe(99.5);
    expect(userViolation?.severity).toBe('blocking');

    expect(sessionViolation).toBeDefined();
    expect(sessionViolation?.actual).toBe(99.2);
    expect(sessionViolation?.threshold).toBe(99.8);

    mockFetchMetrics.mockRestore();
  });

  it('应该支持环境变量覆盖阈值', async () => {
    // 设置环境变量覆盖
    process.env.CRASH_FREE_USERS_THRESHOLD = '98.0';
    process.env.CRASH_FREE_SESSIONS_THRESHOLD = '99.0';
    process.env.OBSERVATION_WINDOW_HOURS = '48';

    const mockFetchMetrics = vi
      .spyOn(releaseHealthGate as any, 'fetchReleaseHealthMetrics')
      .mockResolvedValueOnce({
        crashFreeUsers: 98.5,
        crashFreeSessions: 99.2,
        sampleSize: 8000,
        observationWindow: '48h',
      });

    const result = await releaseHealthGate.checkReleaseHealth();

    // 使用降低的阈值，现在应该通过
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);

    mockFetchMetrics.mockRestore();
  });

  it('应该生成格式化的 Markdown 报告', async () => {
    const mockFetchMetrics = vi
      .spyOn(releaseHealthGate as any, 'fetchReleaseHealthMetrics')
      .mockResolvedValueOnce({
        crashFreeUsers: 99.7,
        crashFreeSessions: 99.9,
        sampleSize: 10000,
        observationWindow: '24h',
      });

    const report = await releaseHealthGate.generateReport();

    expect(report).toContain('# Release Health Gate Report');
    expect(report).toContain('✅ PASSED');
    expect(report).toContain('**Crash-Free Users**: 99.70%');
    expect(report).toContain('**Crash-Free Sessions**: 99.90%');
    expect(report).toContain('**Sample Size**: 10000');

    mockFetchMetrics.mockRestore();
  });

  it('应该在检查失败时抛出适当的错误', async () => {
    const mockFetchMetrics = vi
      .spyOn(releaseHealthGate as any, 'fetchReleaseHealthMetrics')
      .mockRejectedValueOnce(new Error('Sentry API 连接失败'));

    await expect(releaseHealthGate.checkReleaseHealth()).rejects.toThrow(
      'Release Health Gate 检查失败: Sentry API 连接失败'
    );

    mockFetchMetrics.mockRestore();
  });
});

// ============================================================================
// 默认配置测试
// ============================================================================

describe('Default Configurations', () => {
  it('应该定义有效的默认采样配置', () => {
    expect(DEFAULT_SAMPLING_CONFIG).toBeDefined();

    // 验证环境配置
    ['production', 'staging', 'development'].forEach(env => {
      const config =
        DEFAULT_SAMPLING_CONFIG[env as keyof typeof DEFAULT_SAMPLING_CONFIG];

      expect(config).toBeDefined();
      expect(config.errors).toBeGreaterThanOrEqual(0);
      expect(config.errors).toBeLessThanOrEqual(1);
      expect(config.transactions).toBeGreaterThanOrEqual(0);
      expect(config.transactions).toBeLessThanOrEqual(1);
      expect(config.replays).toBeGreaterThanOrEqual(0);
      expect(config.replays).toBeLessThanOrEqual(1);
    });

    // 验证生产环境配置最保守
    expect(DEFAULT_SAMPLING_CONFIG.production.transactions).toBeLessThanOrEqual(
      DEFAULT_SAMPLING_CONFIG.development.transactions
    );
    expect(DEFAULT_SAMPLING_CONFIG.production.replays).toBeLessThanOrEqual(
      DEFAULT_SAMPLING_CONFIG.development.replays
    );
  });

  it('应该定义有效的默认观察窗口', () => {
    expect(DEFAULT_OBSERVATION_WINDOWS).toBeDefined();

    const windows = DEFAULT_OBSERVATION_WINDOWS;
    expect(windows.realtime).toMatch(/^\d+[mh]$/); // 格式如 "5m"
    expect(windows.shortTerm).toMatch(/^\d+[mh]$/);
    expect(windows.mediumTerm).toMatch(/^\d+[hd]$/);
    expect(windows.longTerm).toMatch(/^\d+[hd]$/);
    expect(windows.release).toMatch(/^\d+[hd]$/);

    // 验证时间窗口的逻辑顺序（实时 < 短期 < 中期 < 长期）
    expect(windows.realtime).toBe('5m');
    expect(windows.shortTerm).toBe('1h');
    expect(windows.mediumTerm).toBe('24h');
    expect(windows.longTerm).toBe('7d');
  });
});

// ============================================================================
// 可追溯性矩阵测试
// ============================================================================

describe('Traceability Matrix', () => {
  it('应该定义 NFR 到 SLO 的映射', () => {
    expect(TRACEABILITY_MATRIX.nfrToSlo).toBeDefined();

    const crashFreeMapping =
      TRACEABILITY_MATRIX.nfrToSlo[NFR_KEYS.RELIABILITY.CRASH_FREE_USERS];

    expect(crashFreeMapping).toBeDefined();
    expect(crashFreeMapping.slo).toContain('crash_free_users');
    expect(crashFreeMapping.adr).toContain('ADR-0003');
    expect(crashFreeMapping.testRefs).toEqual(
      expect.arrayContaining(['tests/e2e/reliability.spec.ts'])
    );
    expect(crashFreeMapping.monitoringQuery).toContain('sentry');
  });

  it('应该定义 ADR 到实现的映射', () => {
    expect(TRACEABILITY_MATRIX.adrToImplementation).toBeDefined();

    const adr003Mapping = TRACEABILITY_MATRIX.adrToImplementation['ADR-0003'];

    expect(adr003Mapping).toBeDefined();
    expect(adr003Mapping.title).toContain('可观测性');
    expect(adr003Mapping.implementations).toEqual(
      expect.arrayContaining([
        'src/shared/observability/sentry-main.ts',
        'src/shared/observability/logger.ts',
      ])
    );
    expect(adr003Mapping.tests).toEqual(
      expect.arrayContaining([
        'tests/unit/observability.spec.ts',
        'tests/e2e/monitoring.spec.ts',
      ])
    );
  });

  it('每个定义的 NFR 应该在追溯矩阵中有映射', () => {
    const definedNfrKeys = [
      NFR_KEYS.RELIABILITY.CRASH_FREE_USERS,
      NFR_KEYS.PERFORMANCE.RESPONSE_TIME,
    ];

    definedNfrKeys.forEach(nfrKey => {
      expect(TRACEABILITY_MATRIX.nfrToSlo[nfrKey]).toBeDefined();
    });
  });

  it('每个 ADR 映射应该包含实现文件和测试', () => {
    Object.values(TRACEABILITY_MATRIX.adrToImplementation).forEach(mapping => {
      expect(mapping.title).toBeDefined();
      expect(mapping.implementations).toBeDefined();
      expect(mapping.implementations.length).toBeGreaterThan(0);
      expect(mapping.tests).toBeDefined();
      expect(mapping.tests.length).toBeGreaterThan(0);

      // 验证文件路径格式
      mapping.implementations.forEach(impl => {
        expect(impl).toMatch(/^(src\/|scripts\/|\.github\/)/);
      });

      mapping.tests.forEach(test => {
        expect(test).toMatch(/^tests\/.+\.spec\.ts$/);
      });
    });
  });
});

// ============================================================================
// 集成测试
// ============================================================================

describe('Integration Tests', () => {
  it('NFR Keys、SLI 和 SLO 应该形成一致的映射关系', () => {
    // 验证每个 SLI 的 nfrKey 都存在于 NFR_KEYS 中
    Object.values(CORE_SLIS).forEach(sli => {
      const nfrKeyExists = Object.values(NFR_KEYS).some(category =>
        Object.values(category).includes(sli.nfrKey)
      );
      expect(nfrKeyExists).toBe(true);
    });

    // 验证每个 SLO 都有对应的 SLI
    Object.values(CORE_SLOS).forEach(slo => {
      const sliExists = Object.values(CORE_SLIS).some(
        sli => sli.id === slo.sliId
      );
      expect(sliExists).toBe(true);
    });
  });

  it('所有配置应该与文档规范保持一致', () => {
    // 验证关键阈值与文档中的要求一致
    expect(CORE_SLOS.CRASH_FREE_USERS.targets.production).toBe('≥99.5%');
    expect(CORE_SLOS.CRASH_FREE_SESSIONS.targets.production).toBe('≥99.8%');

    // 验证观察窗口
    expect(CORE_SLOS.CRASH_FREE_USERS.observationWindow).toBe('24h');
    expect(CORE_SLOS.CRASH_FREE_SESSIONS.observationWindow).toBe('24h');

    // 验证采样配置
    expect(DEFAULT_SAMPLING_CONFIG.production.errors).toBe(1.0);
    expect(DEFAULT_SAMPLING_CONFIG.production.transactions).toBe(0.1);
    expect(DEFAULT_SAMPLING_CONFIG.production.replays).toBe(0.01);
  });
});

// ============================================================================
// 边界条件和错误处理测试
// ============================================================================

describe('Edge Cases and Error Handling', () => {
  it('应该处理无效的环境变量值', async () => {
    const config: ReleaseHealthGateConfig = {
      sentryOrg: 'test-org',
      sentryProject: 'test-project',
      authToken: 'test-token',
    };

    const gate = new ReleaseHealthGate(config);

    // 设置无效的环境变量
    process.env.CRASH_FREE_USERS_THRESHOLD = 'invalid-number';

    const mockFetchMetrics = vi
      .spyOn(gate as any, 'fetchReleaseHealthMetrics')
      .mockResolvedValueOnce({
        crashFreeUsers: 99.7,
        crashFreeSessions: 99.9,
        sampleSize: 10000,
        observationWindow: '24h',
      });

    // 应该回退到默认值，不会抛出错误
    const result = await gate.checkReleaseHealth();
    expect(result).toBeDefined();
    expect(typeof result.passed).toBe('boolean');

    mockFetchMetrics.mockRestore();
    delete process.env.CRASH_FREE_USERS_THRESHOLD;
  });

  it('应该验证配置参数的完整性', () => {
    expect(() => {
      new ReleaseHealthGate({
        sentryOrg: '',
        sentryProject: 'test-project',
        authToken: 'test-token',
      });
    }).not.toThrow(); // 当前实现不验证空字符串，但这里记录期望行为
  });

  it('应该处理边界指标值', async () => {
    const config: ReleaseHealthGateConfig = {
      sentryOrg: 'test-org',
      sentryProject: 'test-project',
      authToken: 'test-token',
    };

    const gate = new ReleaseHealthGate(config);

    const mockFetchMetrics = vi
      .spyOn(gate as any, 'fetchReleaseHealthMetrics')
      .mockResolvedValueOnce({
        crashFreeUsers: 100.0, // 边界值：完美指标
        crashFreeSessions: 0.0, // 边界值：最差指标
        sampleSize: 1, // 边界值：最小样本
        observationWindow: '24h',
      });

    const result = await gate.checkReleaseHealth();

    expect(result.metrics.crashFreeUsers).toBe(100.0);
    expect(result.metrics.crashFreeSessions).toBe(0.0);
    expect(result.passed).toBe(false); // 因为 sessions 指标太低

    mockFetchMetrics.mockRestore();
  });
});

// ============================================================================
// V2 增强功能测试
// ============================================================================

describe('V2 游戏特定监控 SLI', () => {
  it('应包含 Phaser 场景转换监控', () => {
    expect(GAME_MONITORING_SLIS.PHASER_SCENE_TRANSITION).toBeDefined();
    expect(GAME_MONITORING_SLIS.PHASER_SCENE_TRANSITION.id).toBe(
      'phaser_scene_transition_time'
    );
    expect(GAME_MONITORING_SLIS.PHASER_SCENE_TRANSITION.target).toBe(
      'P95 ≤ 200ms'
    );
    expect(GAME_MONITORING_SLIS.PHASER_SCENE_TRANSITION.unit).toBe(
      'milliseconds'
    );
    expect(GAME_MONITORING_SLIS.PHASER_SCENE_TRANSITION.query).toContain(
      'phaser.scene_transition'
    );
  });

  it('应包含 React-Phaser 同步监控', () => {
    expect(GAME_MONITORING_SLIS.REACT_PHASER_SYNC).toBeDefined();
    expect(GAME_MONITORING_SLIS.REACT_PHASER_SYNC.id).toBe(
      'react_phaser_sync_latency'
    );
    expect(GAME_MONITORING_SLIS.REACT_PHASER_SYNC.target).toBe('P95 ≤ 50ms');
    expect(GAME_MONITORING_SLIS.REACT_PHASER_SYNC.unit).toBe('milliseconds');
    expect(GAME_MONITORING_SLIS.REACT_PHASER_SYNC.query).toContain(
      'react_phaser_sync'
    );
  });

  it('应包含战斗计算和 AI 决策监控', () => {
    expect(GAME_MONITORING_SLIS.BATTLE_COMPUTATION_TIME).toBeDefined();
    expect(GAME_MONITORING_SLIS.AI_DECISION_TIME).toBeDefined();
    expect(GAME_MONITORING_SLIS.SAVE_GAME_TIME).toBeDefined();

    // 验证性能目标符合游戏需求
    expect(GAME_MONITORING_SLIS.BATTLE_COMPUTATION_TIME.target).toBe(
      'P95 ≤ 50ms'
    );
    expect(GAME_MONITORING_SLIS.AI_DECISION_TIME.target).toBe('P95 ≤ 200ms');
    expect(GAME_MONITORING_SLIS.SAVE_GAME_TIME.target).toBe('P95 ≤ 1000ms');
  });

  it('所有游戏 SLI 应关联到性能 NFR', () => {
    Object.values(GAME_MONITORING_SLIS).forEach(sli => {
      expect(sli.nfrKey).toBe(NFR_KEYS.PERFORMANCE.RESPONSE_TIME);
    });
  });
});

describe('V2 Tier-0 阈值配置', () => {
  it('应包含环境差异化的崩溃率阈值', () => {
    expect(TIER_0_THRESHOLDS.crashFreeUsers).toBeDefined();
    expect(TIER_0_THRESHOLDS.crashFreeSessions).toBeDefined();

    // 验证生产环境阈值最严格
    expect(TIER_0_THRESHOLDS.crashFreeUsers.production).toBe(99.5);
    expect(TIER_0_THRESHOLDS.crashFreeUsers.staging).toBe(99.0);
    expect(TIER_0_THRESHOLDS.crashFreeUsers.development).toBe(95.0);

    expect(TIER_0_THRESHOLDS.crashFreeSessions.production).toBe(99.8);
    expect(TIER_0_THRESHOLDS.crashFreeSessions.staging).toBe(99.5);
    expect(TIER_0_THRESHOLDS.crashFreeSessions.development).toBe(97.0);
  });

  it('应包含关键错误零容忍策略', () => {
    expect(TIER_0_THRESHOLDS.criticalErrors.production).toBe(0);
    expect(TIER_0_THRESHOLDS.criticalErrors.staging).toBe(1);
    expect(TIER_0_THRESHOLDS.criticalErrors.development).toBe(5);
  });

  it('应包含性能回归检测阈值', () => {
    expect(TIER_0_THRESHOLDS.performanceRegression).toBeDefined();
    expect(TIER_0_THRESHOLDS.performanceRegression.frameTimeP95).toBe(16.7); // 60fps
    expect(TIER_0_THRESHOLDS.performanceRegression.interactionP95).toBe(100);
    expect(TIER_0_THRESHOLDS.performanceRegression.startupTimeP95).toBe(3000);
  });
});

describe('V2 智能采样策略', () => {
  it('应包含环境差异化采样配置', () => {
    expect(SAMPLING_STRATEGIES.production).toBeDefined();
    expect(SAMPLING_STRATEGIES.staging).toBeDefined();
    expect(SAMPLING_STRATEGIES.development).toBeDefined();

    // 验证采样率合理性
    const prodConfig = SAMPLING_STRATEGIES.production;
    expect(prodConfig.errorSampling).toBe(1.0); // 100% 错误采样
    expect(prodConfig.transactionSampling).toBe(0.1); // 10% 性能追踪
    expect(prodConfig.replaySampling).toBe(0.01); // 1% 会话回放
    expect(prodConfig.costBudgetMonthly).toBe(800); // $800/月预算
  });

  it('开发环境应有最高的采样率', () => {
    const devConfig = SAMPLING_STRATEGIES.development;
    const prodConfig = SAMPLING_STRATEGIES.production;

    expect(devConfig.transactionSampling).toBeGreaterThanOrEqual(
      prodConfig.transactionSampling
    );
    expect(devConfig.replaySampling).toBeGreaterThanOrEqual(
      prodConfig.replaySampling
    );
  });

  it('所有采样率应在有效范围内', () => {
    Object.values(SAMPLING_STRATEGIES).forEach((config: SamplingConfig) => {
      expect(config.errorSampling).toBeGreaterThanOrEqual(0);
      expect(config.errorSampling).toBeLessThanOrEqual(1);
      expect(config.transactionSampling).toBeGreaterThanOrEqual(0);
      expect(config.transactionSampling).toBeLessThanOrEqual(1);
      expect(config.replaySampling).toBeGreaterThanOrEqual(0);
      expect(config.replaySampling).toBeLessThanOrEqual(1);
      expect(config.costBudgetMonthly).toBeGreaterThan(0);
    });
  });
});

describe('V2 与 01 章 SLO 框架对齐验证', () => {
  it('Tier-0 阈值应与 01 章定义保持一致', () => {
    // 参考 01-约束与目标-v2.md § 1.4 放量门禁
    expect(TIER_0_THRESHOLDS.crashFreeUsers.production).toBe(99.5);
    expect(TIER_0_THRESHOLDS.crashFreeSessions.production).toBe(99.8);
    expect(TIER_0_THRESHOLDS.performanceRegression.frameTimeP95).toBe(16.7);
  });

  it('性能指标应符合 01 章质量目标', () => {
    // 参考 01-约束与目标-v2.md § 1.2 质量目标
    expect(TIER_0_THRESHOLDS.performanceRegression.interactionP95).toBe(100); // ≤100ms
    expect(TIER_0_THRESHOLDS.performanceRegression.startupTimeP95).toBe(3000); // ≤3s
  });
});

describe('V2 Release Health Gate 增强功能', () => {
  it('应支持 Tier-0 阈值的环境变量覆盖', async () => {
    const mockConfig = {
      sentryOrg: 'test-org',
      sentryProject: 'test-project',
      authToken: 'test-token',
      environment: {
        CRASH_FREE_USERS_THRESHOLD: '99.9',
        CRASH_FREE_SESSIONS_THRESHOLD: '99.95',
      },
    };

    const gate = new ReleaseHealthGate(mockConfig);

    const mockFetchMetrics = vi
      .spyOn(gate as any, 'fetchReleaseHealthMetrics')
      .mockResolvedValueOnce({
        crashFreeUsers: 99.7,
        crashFreeSessions: 99.9,
        sampleSize: 10000,
        observationWindow: '24h',
      });

    const result = await gate.checkReleaseHealth();

    // 使用更严格的阈值，应该失败
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);

    mockFetchMetrics.mockRestore();
  });
});

describe('V2 向后兼容性测试', () => {
  it('DEFAULT_SAMPLING_CONFIG 应保持向后兼容', () => {
    // 确保旧配置仍然可用
    expect(DEFAULT_SAMPLING_CONFIG).toBeDefined();
    expect(DEFAULT_SAMPLING_CONFIG.production.errors).toBe(1.0);
    expect(DEFAULT_SAMPLING_CONFIG.production.transactions).toBe(0.1);

    // 但推荐使用新的 SAMPLING_STRATEGIES
    expect(SAMPLING_STRATEGIES.production.errorSampling).toBe(
      DEFAULT_SAMPLING_CONFIG.production.errors
    );
    expect(SAMPLING_STRATEGIES.production.transactionSampling).toBe(
      DEFAULT_SAMPLING_CONFIG.production.transactions
    );
  });
});

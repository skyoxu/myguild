/**
 * 质量门禁单元测试套件
 * 对应 07 章 - 开发与构建 + 质量门禁
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  QualityGateConfig,
  SentryGateConfig,
  ElectronSecurityEnforce,
  DEFAULT_QUALITY_CONFIG,
  DEFAULT_SENTRY_CONFIG,
  ELECTRON_SECURITY_BASELINE,
  buildConfigFromEnv,
  sentryConfigFromEnv,
  type GateResult,
  type BuildPipelineResult,
  type ReleaseHealthData,
} from '@/shared/contracts/build';

describe('质量门禁配置', () => {
  describe('默认配置验证', () => {
    it('应提供合理的覆盖率阈值', () => {
      expect(DEFAULT_QUALITY_CONFIG.coverage.lines).toBeGreaterThanOrEqual(90);
      expect(DEFAULT_QUALITY_CONFIG.coverage.branches).toBeGreaterThanOrEqual(
        85
      );
      expect(DEFAULT_QUALITY_CONFIG.coverage.functions).toBeGreaterThanOrEqual(
        90
      );
      expect(DEFAULT_QUALITY_CONFIG.coverage.statements).toBeGreaterThanOrEqual(
        90
      );
    });

    it('应强制 Electron 安全配置', () => {
      const { electron } = DEFAULT_QUALITY_CONFIG;
      expect(electron.nodeIntegration).toBe(false);
      expect(electron.contextIsolation).toBe(true);
      expect(electron.sandbox).toBe(true);
      expect(electron.webSecurity).toBe(true);
    });

    it('应提供合理的超时配置', () => {
      const { timeouts } = DEFAULT_QUALITY_CONFIG;
      expect(timeouts.build).toBeGreaterThan(0);
      expect(timeouts.test).toBeGreaterThan(0);
      expect(timeouts.e2e).toBeGreaterThan(timeouts.test);
      expect(timeouts.build).toBeGreaterThan(timeouts.test);
    });
  });

  describe('Sentry 配置验证', () => {
    it('应提供合理的 Release Health 阈值', () => {
      const { releaseHealth } = DEFAULT_SENTRY_CONFIG;
      expect(releaseHealth.minCrashFreeUsers).toBeGreaterThanOrEqual(99.0);
      expect(releaseHealth.minCrashFreeSessions).toBeGreaterThanOrEqual(99.0);
      expect(releaseHealth.minAdoptionRate).toBeGreaterThan(0);
      expect(releaseHealth.windowHours).toBeGreaterThan(0);
    });

    it('应提供合理的性能阈值', () => {
      const { performance } = DEFAULT_SENTRY_CONFIG;
      expect(performance.maxP95).toBeGreaterThan(0);
      expect(performance.maxErrorRate).toBeGreaterThan(0);
      expect(performance.maxErrorRate).toBeLessThan(10); // 错误率应小于10%
    });
  });

  describe('Electron 安全基线验证', () => {
    it('应强制禁用危险的 Electron 特性', () => {
      const { browserWindow } = ELECTRON_SECURITY_BASELINE;
      expect(browserWindow.nodeIntegration).toBe(false);
      expect(browserWindow.contextIsolation).toBe(true);
      expect(browserWindow.sandbox).toBe(true);
      expect(browserWindow.webSecurity).toBe(true);
      expect(browserWindow.allowRunningInsecureContent).toBe(false);
      expect(browserWindow.experimentalFeatures).toBe(false);
    });

    it('应提供严格的 CSP 配置', () => {
      const { csp } = ELECTRON_SECURITY_BASELINE;
      expect(csp.defaultSrc).toEqual(["'self'"]);
      expect(csp.objectSrc).toEqual(["'none'"]);
      expect(csp.frameSrc).toEqual(["'none'"]);
    });

    it('应强制预加载脚本安全约束', () => {
      const { preload } = ELECTRON_SECURITY_BASELINE;
      expect(preload.whitelistOnly).toBe(true);
      expect(preload.noNodeAccess).toBe(true);
      expect(preload.contextBridgeRequired).toBe(true);
    });
  });
});

describe('环境变量配置', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildConfigFromEnv', () => {
    it('应使用环境变量覆盖默认配置', () => {
      const env = {
        COVERAGE_LINES_MIN: '95',
        COVERAGE_BRANCHES_MIN: '90',
        BUILD_TIMEOUT: '600000',
      };

      const config = buildConfigFromEnv(env);

      expect(config.coverage.lines).toBe(95);
      expect(config.coverage.branches).toBe(90);
      expect(config.timeouts.build).toBe(600000);
    });

    it('应在缺少环境变量时使用默认值', () => {
      const config = buildConfigFromEnv({});

      expect(config.coverage.lines).toBe(DEFAULT_QUALITY_CONFIG.coverage.lines);
      expect(config.timeouts.build).toBe(DEFAULT_QUALITY_CONFIG.timeouts.build);
    });
  });

  describe('sentryConfigFromEnv', () => {
    it('应使用环境变量覆盖 Sentry 配置', () => {
      const env = {
        CRASH_FREE_USERS_GA: '99.8',
        MIN_ADOPTION_RATE: '25.0',
      };

      const config = sentryConfigFromEnv(env);

      expect(config.releaseHealth.minCrashFreeUsers).toBe(99.8);
      expect(config.releaseHealth.minAdoptionRate).toBe(25.0);
    });
  });
});

describe('门禁脚本接口（占位）', () => {
  describe('package.json 脚本验证', () => {
    it('应暴露所有必需的门禁脚本', () => {
      const requiredScripts = [
        'guard:ci',
        'guard:electron',
        'guard:quality',
        'guard:base',
        'typecheck',
        'lint',
        'test:unit',
        'test:e2e',
      ];

      // TODO: 在实际环境中应读取 package.json 验证
      expect(requiredScripts.length).toBe(8);
    });
  });

  describe('门禁结果类型验证', () => {
    it('GateResult 应包含必要字段', () => {
      const mockResult: GateResult = {
        name: 'typecheck',
        passed: true,
        score: 100,
        violations: [],
        warnings: [],
        executionTime: 1500,
      };

      expect(mockResult).toHaveProperty('name');
      expect(mockResult).toHaveProperty('passed');
      expect(mockResult).toHaveProperty('violations');
      expect(mockResult).toHaveProperty('warnings');
      expect(mockResult).toHaveProperty('executionTime');
    });

    it('BuildPipelineResult 应聚合所有阶段结果', () => {
      const mockPipelineResult: BuildPipelineResult = {
        stages: {
          typecheck: {
            name: 'typecheck',
            passed: true,
            violations: [],
            warnings: [],
            executionTime: 1000,
          },
          lint: {
            name: 'lint',
            passed: true,
            violations: [],
            warnings: [],
            executionTime: 2000,
          },
          'test:unit': {
            name: 'test:unit',
            passed: true,
            violations: [],
            warnings: [],
            executionTime: 5000,
          },
          'test:e2e': {
            name: 'test:e2e',
            passed: true,
            violations: [],
            warnings: [],
            executionTime: 10000,
          },
          'guard:electron': {
            name: 'guard:electron',
            passed: true,
            violations: [],
            warnings: [],
            executionTime: 500,
          },
          'guard:quality': {
            name: 'guard:quality',
            passed: true,
            violations: [],
            warnings: [],
            executionTime: 1000,
          },
          'guard:base': {
            name: 'guard:base',
            passed: true,
            violations: [],
            warnings: [],
            executionTime: 300,
          },
          'guard:health': {
            name: 'guard:health',
            passed: true,
            violations: [],
            warnings: [],
            executionTime: 800,
          },
        },
        overallResult: 'passed',
        totalExecutionTime: 20600,
        timestamp: Date.now(),
      };

      expect(mockPipelineResult.stages).toHaveProperty('typecheck');
      expect(mockPipelineResult.stages).toHaveProperty('guard:electron');
      expect(mockPipelineResult.overallResult).toBe('passed');
    });
  });
});

describe('Release Health 数据处理（占位）', () => {
  it('应验证 Release Health 数据格式', () => {
    const mockHealthData: ReleaseHealthData = {
      windowHours: 24,
      release: 'app@1.0.0',
      sessions: {
        crashFreeRate: 99.2,
        adoption: 36.4,
        total: 1000,
      },
      users: {
        crashFreeRate: 99.0,
        total: 800,
      },
      thresholds: {
        sessions: 99.0,
        users: 98.5,
        minAdoption: 20,
      },
    };

    expect(mockHealthData.sessions.crashFreeRate).toBeGreaterThan(0);
    expect(mockHealthData.users.crashFreeRate).toBeGreaterThan(0);
    expect(mockHealthData.sessions.adoption).toBeGreaterThan(0);
  });

  it('应检测 Release Health 违规', () => {
    const healthData: ReleaseHealthData = {
      windowHours: 24,
      release: 'app@1.0.0',
      sessions: { crashFreeRate: 98.8, adoption: 15.0, total: 1000 },
      users: { crashFreeRate: 98.0, total: 800 },
      thresholds: { sessions: 99.0, users: 98.5, minAdoption: 20 },
    };

    // 模拟门禁检查逻辑
    const violations = [];
    if (healthData.sessions.crashFreeRate < healthData.thresholds.sessions) {
      violations.push('sessions-crash-free');
    }
    if (healthData.users.crashFreeRate < healthData.thresholds.users) {
      violations.push('users-crash-free');
    }
    if (healthData.sessions.adoption < healthData.thresholds.minAdoption) {
      violations.push('adoption-rate');
    }

    expect(violations).toContain('sessions-crash-free');
    expect(violations).toContain('users-crash-free');
    expect(violations).toContain('adoption-rate');
  });
});

// TODO: 集成实际的门禁脚本执行测试
// TODO: 添加 Electron 安全扫描器的单元测试
// TODO: 添加覆盖率门禁的单元测试
// TODO: 添加 Base-Clean 验证器的单元测试

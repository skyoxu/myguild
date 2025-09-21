/**
 * 构建与质量门禁相关的类型定义
 * 对应 07 章架构文档的契约接口
 *
 * @version 1.0.1 - 添加性能检查工作流测试注释
 */

export interface QualityGateConfig {
  coverage: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  electron: {
    nodeIntegration: false;
    contextIsolation: true;
    sandbox: true;
    webSecurity: true;
  };
  timeouts: {
    build: number; // 构建超时（毫秒）
    test: number; // 测试超时（毫秒）
    e2e: number; // E2E 测试超时（毫秒）
  };
}

export interface SentryGateConfig {
  releaseHealth: {
    minCrashFreeUsers: number; // 最小崩溃自由用户率 (%)
    minCrashFreeSessions: number; // 最小崩溃自由会话率 (%)
    minAdoptionRate: number; // 最小采用率 (%)
    windowHours: number; // 统计窗口（小时）
  };
  performance: {
    maxP95: number; // 最大 P95 响应时间（毫秒）
    maxErrorRate: number; // 最大错误率 (%)
  };
}

export interface ElectronSecurityEnforce {
  browserWindow: {
    nodeIntegration: false;
    contextIsolation: true;
    sandbox: true;
    webSecurity: true;
    allowRunningInsecureContent: false;
    experimentalFeatures: false;
  };
  csp: {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    connectSrc: string[];
    objectSrc: string[];
    frameSrc: string[];
  };
  preload: {
    whitelistOnly: true;
    noNodeAccess: true;
    contextBridgeRequired: true;
  };
}

/**
 * 质量门禁执行结果
 */
export interface GateResult {
  name: string;
  passed: boolean;
  score?: number;
  violations: string[];
  warnings: string[];
  executionTime: number;
}

/**
 * 构建管道状态
 */
export type BuildStage =
  | 'typecheck'
  | 'lint'
  | 'test:unit'
  | 'test:e2e'
  | 'guard:electron'
  | 'guard:quality'
  | 'guard:base'
  | 'guard:health';

export interface BuildPipelineResult {
  stages: Record<BuildStage, GateResult>;
  overallResult: 'passed' | 'failed' | 'warning';
  totalExecutionTime: number;
  timestamp: number;
}

/**
 * Release Health 数据结构
 */
export interface ReleaseHealthData {
  windowHours: number;
  release: string;
  sessions: {
    crashFreeRate: number;
    adoption: number;
    total: number;
  };
  users: {
    crashFreeRate: number;
    total: number;
  };
  thresholds: {
    sessions: number;
    users: number;
    minAdoption: number;
  };
}

/**
 * 默认配置常量
 */
export const DEFAULT_QUALITY_CONFIG: QualityGateConfig = {
  coverage: {
    lines: 90,
    branches: 85,
    functions: 90,
    statements: 90,
  },
  electron: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
  },
  timeouts: {
    build: 300000, // 5分钟
    test: 120000, // 2分钟
    e2e: 600000, // 10分钟
  },
};

export const DEFAULT_SENTRY_CONFIG: SentryGateConfig = {
  releaseHealth: {
    minCrashFreeUsers: 99.5,
    minCrashFreeSessions: 99.0,
    minAdoptionRate: 20.0,
    windowHours: 24,
  },
  performance: {
    maxP95: 100,
    maxErrorRate: 1.0,
  },
};

export const ELECTRON_SECURITY_BASELINE: ElectronSecurityEnforce = {
  browserWindow: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
  },
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
  },
  preload: {
    whitelistOnly: true,
    noNodeAccess: true,
    contextBridgeRequired: true,
  },
};

/**
 * 环境变量配置映射
 */
export interface QualityGateEnvConfig {
  COVERAGE_LINES_MIN?: string;
  COVERAGE_BRANCHES_MIN?: string;
  COVERAGE_FUNCTIONS_MIN?: string;
  COVERAGE_STATEMENTS_MIN?: string;
  CRASH_FREE_USERS_GA?: string;
  CRASH_FREE_SESSIONS_GA?: string;
  MIN_ADOPTION_RATE?: string;
  HEALTH_WINDOW_HOURS?: string;
  BUILD_TIMEOUT?: string;
  TEST_TIMEOUT?: string;
  E2E_TIMEOUT?: string;
}

/**
 * 从环境变量构建配置
 */
export function buildConfigFromEnv(
  _env: QualityGateEnvConfig = process.env as QualityGateEnvConfig
): QualityGateConfig {
  return {
    coverage: {
      lines: Number(
        _env.COVERAGE_LINES_MIN ?? DEFAULT_QUALITY_CONFIG.coverage.lines
      ),
      branches: Number(
        _env.COVERAGE_BRANCHES_MIN ?? DEFAULT_QUALITY_CONFIG.coverage.branches
      ),
      functions: Number(
        _env.COVERAGE_FUNCTIONS_MIN ?? DEFAULT_QUALITY_CONFIG.coverage.functions
      ),
      statements: Number(
        _env.COVERAGE_STATEMENTS_MIN ??
          DEFAULT_QUALITY_CONFIG.coverage.statements
      ),
    },
    electron: DEFAULT_QUALITY_CONFIG.electron,
    timeouts: {
      build: Number(
        _env.BUILD_TIMEOUT ?? DEFAULT_QUALITY_CONFIG.timeouts.build
      ),
      test: Number(_env.TEST_TIMEOUT ?? DEFAULT_QUALITY_CONFIG.timeouts.test),
      e2e: Number(_env.E2E_TIMEOUT ?? DEFAULT_QUALITY_CONFIG.timeouts.e2e),
    },
  };
}

export function sentryConfigFromEnv(
  _env: QualityGateEnvConfig = process.env as QualityGateEnvConfig
): SentryGateConfig {
  return {
    releaseHealth: {
      minCrashFreeUsers: Number(
        _env.CRASH_FREE_USERS_GA ??
          DEFAULT_SENTRY_CONFIG.releaseHealth.minCrashFreeUsers
      ),
      minCrashFreeSessions: Number(
        _env.CRASH_FREE_SESSIONS_GA ??
          DEFAULT_SENTRY_CONFIG.releaseHealth.minCrashFreeSessions
      ),
      minAdoptionRate: Number(
        _env.MIN_ADOPTION_RATE ??
          DEFAULT_SENTRY_CONFIG.releaseHealth.minAdoptionRate
      ),
      windowHours: Number(
        _env.HEALTH_WINDOW_HOURS ??
          DEFAULT_SENTRY_CONFIG.releaseHealth.windowHours
      ),
    },
    performance: DEFAULT_SENTRY_CONFIG.performance,
  };
}

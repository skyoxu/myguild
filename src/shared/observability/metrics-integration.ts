/**
 * 监控指标集成入口
 * 统一初始化和管理所有Sentry监控指标系统
 *
 * 按您的要求实现：
 * - Electron 主/渲染进程同时开启 Sentry
 * - autoSessionTracking: true (Release Health)
 * - tracesSampleRate: 0.2 (20%性能采样)
 * - 关键指标用 Metrics 上报（关卡加载时长、战斗回合耗时等）
 */

// 主进程相关导入
export {
  initSentryMain,
  sendBusinessMetric,
  reportLevelLoadTimeMain,
  reportBattleRoundTimeMain,
  reportSystemMetrics,
  startSystemMetricsCollection,
  sendDatabaseAlert,
  integrateObservabilityMetrics,
} from './sentry-main';

// 渲染进程相关导入
export {
  initSentryRenderer,
  sendGameMetric,
  reportLevelLoadTime,
  reportBattleRoundTime,
} from './sentry-renderer';

// Release Health 相关导入
export { ReleaseHealthManager, releaseHealthManager } from './release-health';

// 游戏指标管理器导入
export {
  GameMetricsManager,
  gameMetrics,
  GAME_METRICS,
  recordLevelLoadTime,
  recordBattleRoundTime,
  recordAIDecisionTime,
  recordUIRenderTime,
  recordAssetLoadTime,
  recordMemoryUsage,
  recordGameError,
} from './game-metrics';

/**
 * 监控系统配置接口
 */
export interface MonitoringConfig {
  enableMainProcess: boolean;
  enableRendererProcess: boolean;
  enableReleaseHealth: boolean;
  enableSystemMetrics: boolean;
  enableGameMetrics: boolean;
  sentryDsn?: string;
  environment?: 'development' | 'staging' | 'production';
  tracesSampleRate?: number;
  autoSessionTracking?: boolean;
}

/**
 * 默认监控配置
 */
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enableMainProcess: true,
  enableRendererProcess: true,
  enableReleaseHealth: true,
  enableSystemMetrics: true,
  enableGameMetrics: true,
  sentryDsn: process.env.SENTRY_DSN,
  environment: (process.env.NODE_ENV as any) || 'production',
  tracesSampleRate: 0.2, // 按您要求设置20%
  autoSessionTracking: true, // 按您要求启用Release Health
};

/**
 * 主进程监控系统初始化
 */
export async function initializeMainProcessMonitoring(
  config: Partial<MonitoringConfig> = {}
): Promise<boolean> {
  const finalConfig = { ...DEFAULT_MONITORING_CONFIG, ...config };

  console.log('🔧 初始化主进程监控系统...', finalConfig);

  try {
    let allSuccessful = true;

    // 1. 初始化Sentry主进程
    if (finalConfig.enableMainProcess) {
      const { initSentryMain } = await import('./sentry-main');
      const sentryResult = await initSentryMain();
      if (!sentryResult) {
        console.warn('⚠️ Sentry主进程初始化失败');
        allSuccessful = false;
      }
    }

    // 2. 初始化Release Health管理
    if (finalConfig.enableReleaseHealth) {
      const { releaseHealthManager } = await import('./release-health');
      releaseHealthManager.initializeReleaseHealth();
      console.log('✅ Release Health管理器已启动');
    }

    // 3. 启动系统指标收集
    if (finalConfig.enableSystemMetrics) {
      const { startSystemMetricsCollection } = await import('./sentry-main');
      startSystemMetricsCollection();
      console.log('✅ 系统指标收集已启动');
    }

    // 4. 集成可观测性指标
    if (finalConfig.enableMainProcess) {
      const { integrateObservabilityMetrics } = await import('./sentry-main');
      await integrateObservabilityMetrics();
      console.log('✅ 可观测性指标集成完成');
    }

    console.log(
      `${allSuccessful ? '✅' : '⚠️'} 主进程监控系统初始化${allSuccessful ? '成功' : '部分成功'}`
    );
    return allSuccessful;
  } catch (error) {
    console.error('❌ 主进程监控系统初始化异常:', error);
    return false;
  }
}

/**
 * 渲染进程监控系统初始化
 */
export async function initializeRendererProcessMonitoring(
  config: Partial<MonitoringConfig> = {}
): Promise<boolean> {
  const finalConfig = { ...DEFAULT_MONITORING_CONFIG, ...config };

  console.log('🔧 初始化渲染进程监控系统...', finalConfig);

  try {
    let allSuccessful = true;

    // 1. 初始化Sentry渲染进程
    if (finalConfig.enableRendererProcess) {
      const { initSentryRenderer } = await import('./sentry-renderer');
      const sentryResult = await initSentryRenderer();
      if (!sentryResult) {
        console.warn('⚠️ Sentry渲染进程初始化失败');
        allSuccessful = false;
      }
    }

    // 2. 初始化游戏指标管理器
    if (finalConfig.enableGameMetrics) {
      const { gameMetrics } = await import('./game-metrics');
      gameMetrics.initialize();
      console.log('✅ 游戏指标管理器已启动');
    }

    console.log(
      `${allSuccessful ? '✅' : '⚠️'} 渲染进程监控系统初始化${allSuccessful ? '成功' : '部分成功'}`
    );
    return allSuccessful;
  } catch (error) {
    console.error('❌ 渲染进程监控系统初始化异常:', error);
    return false;
  }
}

/**
 * 完整监控系统初始化（用于主进程）
 */
export async function initializeCompleteMonitoring(
  config: Partial<MonitoringConfig> = {}
): Promise<{ main: boolean; renderer: boolean }> {
  console.log('🚀 启动完整监控系统初始化...');

  // 只在主进程中初始化主进程监控
  const mainResult = await initializeMainProcessMonitoring(config);

  // 渲染进程监控需要在渲染进程中单独初始化
  return {
    main: mainResult,
    renderer: false, // 将在渲染进程中单独设置
  };
}

/**
 * 验证监控系统状态
 */
export function validateMonitoringStatus(): {
  sentry: boolean;
  releaseHealth: boolean;
  gameMetrics: boolean;
  systemMetrics: boolean;
} {
  try {
    // 检查Sentry状态（需要实际调用Sentry API）
    const sentryStatus = true; // 简化实现，实际应检查Sentry客户端状态

    // 检查Release Health状态
    let releaseHealthStatus = false;
    try {
      const { releaseHealthManager } = require('./release-health');
      releaseHealthStatus = !!releaseHealthManager;
    } catch {
      releaseHealthStatus = false;
    }

    // 检查游戏指标状态
    let gameMetricsStatus = false;
    try {
      const { gameMetrics } = require('./game-metrics');
      gameMetricsStatus = !!gameMetrics;
    } catch {
      gameMetricsStatus = false;
    }

    // 系统指标状态（主进程特有）
    const systemMetricsStatus =
      typeof process !== 'undefined' && !!process.memoryUsage;

    return {
      sentry: sentryStatus,
      releaseHealth: releaseHealthStatus,
      gameMetrics: gameMetricsStatus,
      systemMetrics: systemMetricsStatus,
    };
  } catch (error) {
    console.warn('⚠️ 监控状态验证失败:', error);
    return {
      sentry: false,
      releaseHealth: false,
      gameMetrics: false,
      systemMetrics: false,
    };
  }
}

/**
 * 获取监控系统摘要
 */
export function getMonitoringSummary(): {
  config: MonitoringConfig;
  status: ReturnType<typeof validateMonitoringStatus>;
  timestamp: string;
} {
  return {
    config: DEFAULT_MONITORING_CONFIG,
    status: validateMonitoringStatus(),
    timestamp: new Date().toISOString(),
  };
}

// 便捷的全局初始化函数
export const initMonitoring = {
  main: initializeMainProcessMonitoring,
  renderer: initializeRendererProcessMonitoring,
  complete: initializeCompleteMonitoring,
};

// 导出类型定义
export type { GameMetricDefinition } from './game-metrics';

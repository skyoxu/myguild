/**
 * [main-only] Observability aggregator
 * Unifies initialization and management of Sentry and metrics.
 *
 * Key behaviors:
 * - Split by process: main vs renderer responsibilities
 * - Release Health enabled (autoSessionTracking: true)
 * - Default tracesSampleRate: 0.2 (20% tracing)
 * - Game metrics: level load time, battle round duration, etc.
 */

// Main-process exports
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

// Renderer-process exports
export { initSentryRenderer, sendGameMetric } from './sentry-renderer';
// Backward-compatible API: expose renderer game metric reporters via game-metrics
export {
  recordLevelLoadTime as reportLevelLoadTime,
  recordBattleRoundTime as reportBattleRoundTime,
} from './game-metrics';

// Release Health exports
export { ReleaseHealthManager, releaseHealthManager } from './release-health';

// Game metrics exports
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
 * Unified monitoring config interface
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
 * Default configuration
 */
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enableMainProcess: true,
  enableRendererProcess: true,
  enableReleaseHealth: true,
  enableSystemMetrics: true,
  enableGameMetrics: true,
  sentryDsn: process.env.SENTRY_DSN,
  environment: (process.env.NODE_ENV as any) || 'production',
  tracesSampleRate: 0.2, // 20% tracing by default
  autoSessionTracking: true, // Enable Release Health by default
};

/**
 * Initialize main-process monitoring
 */
export async function initializeMainProcessMonitoring(
  config: Partial<MonitoringConfig> = {}
): Promise<boolean> {
  const finalConfig = { ...DEFAULT_MONITORING_CONFIG, ...config };

  console.log('[observability:main] Initializing...', finalConfig);

  try {
    let allSuccessful = true;

    // 1) Init Sentry (main)
    if (finalConfig.enableMainProcess) {
      const { initSentryMain } = await import('./sentry-main');
      const sentryResult = await initSentryMain();
      if (!sentryResult) {
        console.warn('[observability:main] Sentry main init failed');
        allSuccessful = false;
      }
    }

    // 2) Init Release Health (main)
    if (finalConfig.enableReleaseHealth) {
      const { releaseHealthManager } = await import('./release-health');
      releaseHealthManager.initializeReleaseHealth();
      console.log('[observability:main] Release Health initialized');
    }

    // 3) Start system metrics collection
    if (finalConfig.enableSystemMetrics) {
      const { startSystemMetricsCollection } = await import('./sentry-main');
      startSystemMetricsCollection();
      console.log('[observability:main] System metrics collection started');
    }

    // 4) Integrate aggregated observability metrics
    if (finalConfig.enableMainProcess) {
      const { integrateObservabilityMetrics } = await import('./sentry-main');
      await integrateObservabilityMetrics();
      console.log(
        '[observability:main] Observability metrics aggregation completed'
      );
    }

    console.log(
      `[observability:main] Initialization ${allSuccessful ? 'succeeded' : 'partially succeeded'}`
    );
    return allSuccessful;
  } catch (error) {
    console.error('[observability:main] Initialization error:', error);
    return false;
  }
}

/**
 * Initialize renderer-process monitoring
 */
export async function initializeRendererProcessMonitoring(
  config: Partial<MonitoringConfig> = {}
): Promise<boolean> {
  const finalConfig = { ...DEFAULT_MONITORING_CONFIG, ...config };

  console.log('[observability:renderer] Initializing...', finalConfig);

  try {
    let allSuccessful = true;

    // 1) Init Sentry (renderer)
    if (finalConfig.enableRendererProcess) {
      const { initSentryRenderer } = await import('./sentry-renderer');
      const sentryResult = await initSentryRenderer();
      if (!sentryResult) {
        console.warn('[observability:renderer] Sentry renderer init failed');
        allSuccessful = false;
      }
    }

    // 2) Init game metrics manager
    if (finalConfig.enableGameMetrics) {
      const { gameMetrics } = await import('./game-metrics');
      gameMetrics.initialize();
      console.log('[observability:renderer] Game metrics manager initialized');
    }

    console.log(
      `[observability:renderer] Initialization ${allSuccessful ? 'succeeded' : 'partially succeeded'}`
    );
    return allSuccessful;
  } catch (error) {
    console.error('[observability:renderer] Initialization error:', error);
    return false;
  }
}

/**
 * Initialize complete monitoring sequence (main only here; renderer initializes in renderer entry)
 */
export async function initializeCompleteMonitoring(
  config: Partial<MonitoringConfig> = {}
): Promise<{ main: boolean; renderer: boolean }> {
  console.log('[observability] Starting complete monitoring initialization...');

  // Only initialize main monitoring here
  const mainResult = await initializeMainProcessMonitoring(config);

  // Renderer monitoring is initialized in the renderer entry
  return {
    main: mainResult,
    renderer: false, // Initialized elsewhere
  };
}

/**
 * Validate monitoring status (shallow)
 */
export function validateMonitoringStatus(): {
  sentry: boolean;
  releaseHealth: boolean;
  gameMetrics: boolean;
  systemMetrics: boolean;
} {
  try {
    // TODO: read real Sentry client status if needed
    const sentryStatus = true;

    // Release Health status (presence check only)
    let releaseHealthStatus = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- presence check only; avoids bundler static include
      const { releaseHealthManager } = require('./release-health');
      releaseHealthStatus = !!releaseHealthManager;
    } catch {
      releaseHealthStatus = false;
    }

    // Game metrics status (presence check only)
    let gameMetricsStatus = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- presence check only; avoids bundler static include
      const { gameMetrics } = require('./game-metrics');
      gameMetricsStatus = !!gameMetrics;
    } catch {
      gameMetricsStatus = false;
    }

    // System metrics status (placeholder)
    const systemMetricsStatus =
      typeof process !== 'undefined' && !!process.memoryUsage;

    return {
      sentry: sentryStatus,
      releaseHealth: releaseHealthStatus,
      gameMetrics: gameMetricsStatus,
      systemMetrics: systemMetricsStatus,
    };
  } catch (error) {
    console.warn(
      '[observability] Status validation failed:',
      (error as any)?.message ?? error
    );
    return {
      sentry: false,
      releaseHealth: false,
      gameMetrics: false,
      systemMetrics: false,
    };
  }
}

/**
 * Get monitoring summary (placeholder)
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

// Global init placeholder
export const initMonitoring = {
  main: initializeMainProcessMonitoring,
  renderer: initializeRendererProcessMonitoring,
  complete: initializeCompleteMonitoring,
};

// Domain types placeholder
export type { GameMetricDefinition } from './game-metrics';

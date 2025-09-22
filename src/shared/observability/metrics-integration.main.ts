/**
 * Main-process only observability integration (no renderer imports).
 * Keeps API surface for main initialization and system/business metrics.
 */

// Re-exports from main side
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

export interface MonitoringConfigMain {
  enableMainProcess: boolean;
  enableReleaseHealth: boolean;
  enableSystemMetrics: boolean;
  tracesSampleRate?: number;
  autoSessionTracking?: boolean;
  enableRendererProcess?: boolean;
}

export const DEFAULT_MONITORING_CONFIG_MAIN: MonitoringConfigMain = {
  enableMainProcess: true,
  enableReleaseHealth: true,
  enableSystemMetrics: true,
};

/** Initialize main-process observability */
export async function initializeMainProcessMonitoring(
  config: Partial<MonitoringConfigMain> = {}
): Promise<boolean> {
  const finalConfig = { ...DEFAULT_MONITORING_CONFIG_MAIN, ...config };
  try {
    let ok = true;

    // 1) Sentry (main)
    if (finalConfig.enableMainProcess) {
      const { initSentryMain } = await import('./sentry-main');
      const ready = await initSentryMain();
      if (!ready) ok = false;
    }

    // 2) Release Health (main)
    if (finalConfig.enableReleaseHealth) {
      const { releaseHealthManager } = await import('./release-health');
      releaseHealthManager.initializeReleaseHealth();
    }

    // 3) System metrics collection
    if (finalConfig.enableSystemMetrics) {
      const { startSystemMetricsCollection } = await import('./sentry-main');
      startSystemMetricsCollection();
    }

    return ok;
  } catch (err) {
    console.error('[main-observability] initialization error:', err);
    return false;
  }
}

/** Initialize complete flow from main (renderer init is done in renderer entry) */
export async function initializeCompleteMonitoring(
  config: Partial<MonitoringConfigMain> = {}
): Promise<{ main: boolean; renderer: boolean }> {
  const mainResult = await initializeMainProcessMonitoring(config);
  return { main: mainResult, renderer: false };
}

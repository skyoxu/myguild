/**
 * Renderer-only observability integration (no main-process imports).
 * Keeps API surface for renderer initialization and game metrics.
 */

// Use static imports only to avoid Vite "static + dynamic" chunking warnings
import { initSentryRenderer, sendGameMetric } from './sentry-renderer';
import {
  gameMetrics,
  recordLevelLoadTime,
  recordBattleRoundTime,
} from './game-metrics';

// Re-export public APIs (keep legacy names stable)
export { initSentryRenderer, sendGameMetric };
export {
  recordLevelLoadTime as reportLevelLoadTime,
  recordBattleRoundTime as reportBattleRoundTime,
};

export interface MonitoringConfigRenderer {
  enableRendererProcess: boolean;
  enableGameMetrics: boolean;
  // Accept tracesSampleRate for callsite compatibility; currently unused here
  tracesSampleRate?: number;
}

const DEFAULT_RENDERER_CONFIG: MonitoringConfigRenderer = {
  enableRendererProcess: true,
  enableGameMetrics: true,
};

export async function initializeRendererProcessMonitoring(
  config: Partial<MonitoringConfigRenderer> = {}
): Promise<boolean> {
  const finalConfig = { ...DEFAULT_RENDERER_CONFIG, ...config };
  try {
    let ok = true;
    if (finalConfig.enableRendererProcess) {
      const ready = await initSentryRenderer();
      if (!ready) ok = false;
    }
    if (finalConfig.enableGameMetrics) {
      gameMetrics.initialize();
    }
    return ok;
  } catch (err) {
    console.error('[renderer-observability] initialization error:', err);
    return false;
  }
}

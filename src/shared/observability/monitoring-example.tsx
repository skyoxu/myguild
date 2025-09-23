/**
 * [example] Observability demo (Electron + React + Phaser)
 * - main-side aggregator: metrics-integration.main (Electron main process)
 * - renderer-side aggregator: metrics-integration.renderer (renderer process)
 * - Do NOT import metrics-integration.ts directly from renderer.
 *
 * Notes
 * - This is a documentation example. It is not executed in production.
 * - Keep imports explicit to avoid confusion between main/renderer.
 * - Replace placeholder imports with actual implementations when ready.
 */

// ===========================================
// 1) Main process setup (electron/main.ts)
// ===========================================

export async function setupMainProcessMonitoring() {
  // Example: main-only
  // const { initializeMainProcessMonitoring } = await import('./metrics-integration.main');
  // const ok = await initializeMainProcessMonitoring({
  //   enableMainProcess: true,
  //   enableReleaseHealth: true,
  //   enableSystemMetrics: true,
  // });
  // if (!ok) console.warn('[example] main monitoring init failed');

  console.log('[example] Main process monitoring setup (placeholder)');
  return true;
}

// ===========================================
// 2) Renderer setup (src/app.tsx)
// ===========================================

export async function setupRendererProcessMonitoring() {
  // Example: renderer-only
  // const { initializeRendererProcessMonitoring } = await import('./metrics-integration.renderer');
  // const ok = await initializeRendererProcessMonitoring({
  //   enableRendererProcess: true,
  //   enableGameMetrics: true,
  // });
  // if (!ok) console.warn('[example] renderer monitoring init failed');

  console.log('[example] Renderer process monitoring setup (placeholder)');
  return true;
}

// ===========================================
// 3) Example usage in game flow (renderer only)
// ===========================================

export class LevelLoaderExample {
  async loadLevel(levelId: string, difficulty: string = 'normal') {
    const start = Date.now();
    // ... loading assets/data/physics (omitted)
    const elapsed = Date.now() - start;

    // Example: renderer metrics
    // const { recordLevelLoadTime, gameMetrics } = await import('./metrics-integration.renderer');
    // recordLevelLoadTime(elapsed, levelId, difficulty);
    // gameMetrics.recordLevelLoadSuccess(levelId);

    console.log(
      `[example] Level ${levelId} loaded in ${elapsed}ms (${difficulty})`
    );
  }
}

// ===========================================
// 4) UI performance metrics (renderer only)
// ===========================================

export async function recordUIRenderExample(component: string, ms: number) {
  // Example: UI metrics
  // const { recordUIRenderTime } = await import('./metrics-integration.renderer');
  // recordUIRenderTime(ms, component, 'example');

  console.log(`[example] UI component ${component} rendered in ${ms}ms`);
}

// ===========================================
// 5) Validation example (main-only)
// ===========================================

export async function validateMonitoringIntegrationExample(): Promise<boolean> {
  // Example: validation
  // const { validateMonitoringStatus } = await import('./metrics-integration.main');
  // const status = validateMonitoringStatus();
  // return Object.values(status).every(Boolean);

  console.log('[example] Monitoring validation (placeholder)');
  return true;
}

// Reminder
// - In renderer, only import from './metrics-integration.renderer'.
// - In main, only import from './metrics-integration.main'.
// - Avoid using './metrics-integration' directly in renderer code.

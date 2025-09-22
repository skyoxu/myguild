/**
 *
 *
 * Electron + React + Phaser
 * Sentry
 *
 *
 *  Electron/Sentry
 *  autoSessionTracking: true (Release Health)
 *  tracesSampleRate: 0.2 (20%)
 *  Metrics - Sentry.metrics.distribution()
 *
 */

// ===========================================
// 1.  (electron/main.ts)
// ===========================================

export async function setupMainProcessMonitoring() {
  const { initializeMainProcessMonitoring } = await import(
    './metrics-integration'
  );

  // Release Health
  const success = await initializeMainProcessMonitoring({
    enableMainProcess: true,
    enableReleaseHealth: true,
    enableSystemMetrics: true,
    tracesSampleRate: 0.2, // 20%
    autoSessionTracking: true, // Release Health
  });

  if (success) {
    console.log(' ');
  } else {
    console.warn(' ');
  }
}

// ===========================================
// 2.  (src/app.tsx)
// ===========================================

export async function setupRendererProcessMonitoring() {
  const { initializeRendererProcessMonitoring } = await import(
    './metrics-integration'
  );

  //
  const success = await initializeRendererProcessMonitoring({
    enableRendererProcess: true,
    enableGameMetrics: true,
    tracesSampleRate: 0.2, // 20%
    autoSessionTracking: true, // Release Health
  });

  if (success) {
    console.log(' ');
  } else {
    console.warn(' ');
  }
}

// ===========================================
// 3.
// ===========================================

export class LevelLoader {
  async loadLevel(levelId: string, difficulty: string = 'normal') {
    const startTime = Date.now();

    try {
      //
      await this.loadLevelAssets(levelId);
      await this.initializeLevelData(levelId);
      await this.setupLevelPhysics();

      //
      const loadTime = Date.now() - startTime;

      //
      const { recordLevelLoadTime } = await import('./metrics-integration');
      recordLevelLoadTime(loadTime, levelId, difficulty);

      //
      const { gameMetrics } = await import('./metrics-integration');
      gameMetrics.recordLevelLoadSuccess(levelId);

      console.log(`? �ؿ�${levelId}������ɣ���ʱ${loadTime}ms`);
      return true;
    } catch (error) {
      const loadTime = Date.now() - startTime;

      //
      const { gameMetrics } = await import('./metrics-integration');
      gameMetrics.recordLevelLoadFailure(levelId, error.name, error.message);

      console.error(`? �ؿ�${levelId}����ʧ�ܣ���ʱ${loadTime}ms`, error);
      throw error;
    }
  }

  private async loadLevelAssets(levelId: string) {
    const startTime = Date.now();

    // ...
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));

    const loadTime = Date.now() - startTime;
    const { recordAssetLoadTime } = await import('./metrics-integration');
    recordAssetLoadTime(loadTime, 'level-assets', 1024 * 1024); // 1MB
  }

  private async initializeLevelData(levelId: string) {
    // ...
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
  }

  private async setupLevelPhysics() {
    // ...
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300));
  }
}

// ===========================================
// 4.
// ===========================================

export class BattleManager {
  private currentRound = 0;
  private battleType: string;

  constructor(battleType: string = 'normal') {
    this.battleType = battleType;
  }

  async executeBattleRound(playerCount: number = 2) {
    this.currentRound++;
    const startTime = Date.now();

    try {
      // AI
      const aiDecisionStart = Date.now();
      await this.executeAIDecisions();
      const aiDecisionTime = Date.now() - aiDecisionStart;

      // AI
      const { recordAIDecisionTime } = await import('./metrics-integration');
      recordAIDecisionTime(aiDecisionTime, 'smart-ai', 'high');

      //
      await this.processBattleLogic();

      //
      await this.playBattleAnimations();

      const roundTime = Date.now() - startTime;

      //
      const { recordBattleRoundTime } = await import('./metrics-integration');
      recordBattleRoundTime(
        roundTime,
        this.battleType,
        this.currentRound,
        playerCount
      );

      console.log(`?? ս���غ�${this.currentRound}��ɣ���ʱ${roundTime}ms`);
      return true;
    } catch (error) {
      const roundTime = Date.now() - startTime;

      //
      const { recordGameError } = await import('./metrics-integration');
      recordGameError('battle-round-error', 'high', 'battle-manager');

      console.error(`? ս���غ�${this.currentRound}ִ��ʧ��`, error);
      throw error;
    }
  }

  private async executeAIDecisions() {
    // AI...
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
  }

  private async processBattleLogic() {
    // ...
    await new Promise(resolve => setTimeout(resolve, Math.random() * 800));
  }

  private async playBattleAnimations() {
    // ...
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1200));
  }

  completeBattle(result: 'victory' | 'defeat' | 'draw') {
    const { gameMetrics } = require('./metrics-integration');
    gameMetrics.recordMetric('BATTLE_COMPLETION', 1, {
      battleType: this.battleType,
      result,
      rounds: this.currentRound.toString(),
    });

    console.log(`?? ս������: ${result}, ��${this.currentRound}�غ�`);
  }
}

// ===========================================
// 5. UI
// ===========================================

export class UIPerformanceMonitor {
  static monitorComponentRender<T>(
    componentName: string,
    renderFunction: () => T
  ): T {
    const startTime = Date.now();

    try {
      const result = renderFunction();
      const renderTime = Date.now() - startTime;

      // UI
      const { recordUIRenderTime } = require('./metrics-integration');
      recordUIRenderTime(
        renderTime,
        componentName,
        renderTime > 100 ? 'complex' : 'simple'
      );

      if (renderTime > 100) {
        console.warn(`?? ���${componentName}��Ⱦ��ʱ${renderTime}ms��������Ҫ�Ż�`);
      }

      return result;
    } catch (error) {
      const renderTime = Date.now() - startTime;

      // UI
      const { recordGameError } = require('./metrics-integration');
      recordGameError('ui-render-error', 'medium', componentName);

      throw error;
    }
  }

  static measureInteractionDelay(action: string, component: string) {
    const startTime = Date.now();

    return () => {
      const delay = Date.now() - startTime;

      //
      const { gameMetrics } = require('./metrics-integration');
      gameMetrics.recordMetric('UI_INTERACTION_DELAY', delay, {
        action,
        component,
      });

      if (delay > 200) {
        console.warn(`?? ${component}��${action}������Ӧ�ӳ�${delay}ms`);
      }
    };
  }
}

// ===========================================
// 6. React
// ===========================================

export function GameLevelComponent({ levelId }: { levelId: string }) {
  const [loading, setLoading] = React.useState(false);

  const loadLevel = async () => {
    setLoading(true);
    const measureDelay = UIPerformanceMonitor.measureInteractionDelay(
      'level-load',
      'GameLevelComponent'
    );

    try {
      const loader = new LevelLoader();
      await loader.loadLevel(levelId, 'normal');

      //
      measureDelay();
    } catch (error) {
      console.error(':', error);
    } finally {
      setLoading(false);
    }
  };

  return UIPerformanceMonitor.monitorComponentRender(
    'GameLevelComponent',
    () => (
      <div data-testid="game-level-root">
        <h2>�ؿ� {levelId}</h2>
        <button onClick={loadLevel} disabled={loading}>
          {loading ? '...' : ''}
        </button>
      </div>
    )
  );
}

// ===========================================
// 7.
// ===========================================

export class SystemMonitor {
  static startMemoryMonitoring() {
    setInterval(() => {
      const memInfo = (performance as any).memory;
      if (memInfo) {
        const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);

        //
        const { recordMemoryUsage } = require('./metrics-integration');
        recordMemoryUsage(usedMB, 'renderer-process', 'periodic-check');

        //
        if (usedMB > 200) {
          // 200MB
          console.warn(`?? ��Ⱦ�����ڴ�ʹ��${usedMB}MB����ע���ڴ�й©`);

          const { recordGameError } = require('./metrics-integration');
          recordGameError('high-memory-usage', 'medium', 'renderer-process');
        }
      }
    }, 60000); //
  }
}

// ===========================================
// 8.
// ===========================================

export async function initializeGameMonitoring() {
  console.log(' ...');

  try {
    //
    if (typeof window !== 'undefined') {
      //
      await setupRendererProcessMonitoring();
      SystemMonitor.startMemoryMonitoring();
    } else if (typeof process !== 'undefined' && process.type === 'browser') {
      //
      await setupMainProcessMonitoring();
    }

    console.log(' ');
  } catch (error) {
    console.error(' :', error);
  }
}

// ===========================================
// 9.
// ===========================================

export async function validateMonitoringIntegration(): Promise<boolean> {
  console.log(' ...');

  try {
    //
    const loader = new LevelLoader();
    await loader.loadLevel('test-level', 'easy');

    //
    const battle = new BattleManager('test-battle');
    await battle.executeBattleRound(2);
    battle.completeBattle('victory');

    // UI
    UIPerformanceMonitor.monitorComponentRender('TestComponent', () => {
      return 'test-result';
    });

    //
    const { validateMonitoringStatus } = await import('./metrics-integration');
    const status = validateMonitoringStatus();

    const allHealthy = Object.values(status).every(s => s === true);

    console.log(' :', status);
    console.log(`${allHealthy ? '' : ''} ���ϵͳ${allHealthy ? '' : ''}`);

    return allHealthy;
  } catch (error) {
    console.error(' :', error);
    return false;
  }
}

import React from 'react';

/**
 * 监控指标集成使用示例
 *
 * 此文件展示了如何在您的Electron + React + Phaser游戏中
 * 集成和使用Sentry监控指标系统
 *
 * 按您要求实现的功能：
 * ✅ Electron主/渲染进程同时启用Sentry
 * ✅ autoSessionTracking: true (Release Health)
 * ✅ tracesSampleRate: 0.2 (20%性能采样)
 * ✅ 自定义Metrics上报 - Sentry.metrics.distribution()
 * ✅ 关卡加载时长、战斗回合耗时等关键指标
 */

// ===========================================
// 1. 在主进程中 (electron/main.ts)
// ===========================================

export async function setupMainProcessMonitoring() {
  const { initializeMainProcessMonitoring } = await import(
    './metrics-integration'
  );

  // 初始化主进程监控（包含Release Health和系统指标）
  const success = await initializeMainProcessMonitoring({
    enableMainProcess: true,
    enableReleaseHealth: true,
    enableSystemMetrics: true,
    tracesSampleRate: 0.2, // 20%性能采样
    autoSessionTracking: true, // Release Health
  });

  if (success) {
    console.log('✅ 主进程监控系统启动成功');
  } else {
    console.warn('⚠️ 主进程监控系统启动失败');
  }
}

// ===========================================
// 2. 在渲染进程中 (src/app.tsx)
// ===========================================

export async function setupRendererProcessMonitoring() {
  const { initializeRendererProcessMonitoring } = await import(
    './metrics-integration'
  );

  // 初始化渲染进程监控（包含游戏指标）
  const success = await initializeRendererProcessMonitoring({
    enableRendererProcess: true,
    enableGameMetrics: true,
    tracesSampleRate: 0.2, // 20%性能采样
    autoSessionTracking: true, // Release Health
  });

  if (success) {
    console.log('✅ 渲染进程监控系统启动成功');
  } else {
    console.warn('⚠️ 渲染进程监控系统启动失败');
  }
}

// ===========================================
// 3. 游戏关卡加载指标示例
// ===========================================

export class LevelLoader {
  async loadLevel(levelId: string, difficulty: string = 'normal') {
    const startTime = Date.now();

    try {
      // 模拟关卡资源加载
      await this.loadLevelAssets(levelId);
      await this.initializeLevelData(levelId);
      await this.setupLevelPhysics();

      // 计算加载时长
      const loadTime = Date.now() - startTime;

      // 🎯 按您要求的格式发送指标
      const { recordLevelLoadTime } = await import('./metrics-integration');
      recordLevelLoadTime(loadTime, levelId, difficulty);

      // 记录成功加载
      const { gameMetrics } = await import('./metrics-integration');
      gameMetrics.recordLevelLoadSuccess(levelId);

      console.log(`✅ 关卡${levelId}加载完成，耗时${loadTime}ms`);
      return true;
    } catch (error) {
      const loadTime = Date.now() - startTime;

      // 记录加载失败
      const { gameMetrics } = await import('./metrics-integration');
      gameMetrics.recordLevelLoadFailure(levelId, error.name, error.message);

      console.error(`❌ 关卡${levelId}加载失败，耗时${loadTime}ms`, error);
      throw error;
    }
  }

  private async loadLevelAssets(levelId: string) {
    const startTime = Date.now();

    // 模拟资源加载...
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));

    const loadTime = Date.now() - startTime;
    const { recordAssetLoadTime } = await import('./metrics-integration');
    recordAssetLoadTime(loadTime, 'level-assets', 1024 * 1024); // 假设1MB资源
  }

  private async initializeLevelData(levelId: string) {
    // 模拟数据初始化...
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
  }

  private async setupLevelPhysics() {
    // 模拟物理引擎设置...
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300));
  }
}

// ===========================================
// 4. 战斗回合指标示例
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
      // 模拟AI决策阶段
      const aiDecisionStart = Date.now();
      await this.executeAIDecisions();
      const aiDecisionTime = Date.now() - aiDecisionStart;

      // 记录AI决策时长
      const { recordAIDecisionTime } = await import('./metrics-integration');
      recordAIDecisionTime(aiDecisionTime, 'smart-ai', 'high');

      // 模拟战斗计算
      await this.processBattleLogic();

      // 模拟动画播放
      await this.playBattleAnimations();

      const roundTime = Date.now() - startTime;

      // 🎯 按您要求的格式发送战斗回合指标
      const { recordBattleRoundTime } = await import('./metrics-integration');
      recordBattleRoundTime(
        roundTime,
        this.battleType,
        this.currentRound,
        playerCount
      );

      console.log(`⚔️ 战斗回合${this.currentRound}完成，耗时${roundTime}ms`);
      return true;
    } catch (error) {
      const roundTime = Date.now() - startTime;

      // 记录战斗错误
      const { recordGameError } = await import('./metrics-integration');
      recordGameError('battle-round-error', 'high', 'battle-manager');

      console.error(`❌ 战斗回合${this.currentRound}执行失败`, error);
      throw error;
    }
  }

  private async executeAIDecisions() {
    // 模拟AI决策过程...
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
  }

  private async processBattleLogic() {
    // 模拟战斗逻辑计算...
    await new Promise(resolve => setTimeout(resolve, Math.random() * 800));
  }

  private async playBattleAnimations() {
    // 模拟动画播放...
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1200));
  }

  completeBattle(result: 'victory' | 'defeat' | 'draw') {
    const { gameMetrics } = require('./metrics-integration');
    gameMetrics.recordMetric('BATTLE_COMPLETION', 1, {
      battleType: this.battleType,
      result,
      rounds: this.currentRound.toString(),
    });

    console.log(`🏆 战斗结束: ${result}, 共${this.currentRound}回合`);
  }
}

// ===========================================
// 5. UI性能监控示例
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

      // 记录UI渲染时长
      const { recordUIRenderTime } = require('./metrics-integration');
      recordUIRenderTime(
        renderTime,
        componentName,
        renderTime > 100 ? 'complex' : 'simple'
      );

      if (renderTime > 100) {
        console.warn(
          `⚠️ 组件${componentName}渲染耗时${renderTime}ms，可能需要优化`
        );
      }

      return result;
    } catch (error) {
      const renderTime = Date.now() - startTime;

      // 记录UI错误
      const { recordGameError } = require('./metrics-integration');
      recordGameError('ui-render-error', 'medium', componentName);

      throw error;
    }
  }

  static measureInteractionDelay(action: string, component: string) {
    const startTime = Date.now();

    return () => {
      const delay = Date.now() - startTime;

      // 记录交互延迟
      const { gameMetrics } = require('./metrics-integration');
      gameMetrics.recordMetric('UI_INTERACTION_DELAY', delay, {
        action,
        component,
      });

      if (delay > 200) {
        console.warn(`⚠️ ${component}的${action}操作响应延迟${delay}ms`);
      }
    };
  }
}

// ===========================================
// 6. React组件集成示例
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

      // 测量交互延迟
      measureDelay();
    } catch (error) {
      console.error('关卡加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return UIPerformanceMonitor.monitorComponentRender(
    'GameLevelComponent',
    () => (
      <div data-testid="game-level-root">
        <h2>关卡 {levelId}</h2>
        <button onClick={loadLevel} disabled={loading}>
          {loading ? '加载中...' : '开始关卡'}
        </button>
      </div>
    )
  );
}

// ===========================================
// 7. 系统资源监控示例
// ===========================================

export class SystemMonitor {
  static startMemoryMonitoring() {
    setInterval(() => {
      const memInfo = (performance as any).memory;
      if (memInfo) {
        const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);

        // 记录内存使用
        const { recordMemoryUsage } = require('./metrics-integration');
        recordMemoryUsage(usedMB, 'renderer-process', 'periodic-check');

        // 内存使用预警
        if (usedMB > 200) {
          // 200MB 预警线
          console.warn(`⚠️ 渲染进程内存使用${usedMB}MB，请注意内存泄漏`);

          const { recordGameError } = require('./metrics-integration');
          recordGameError('high-memory-usage', 'medium', 'renderer-process');
        }
      }
    }, 60000); // 每分钟检查一次
  }
}

// ===========================================
// 8. 应用启动集成示例
// ===========================================

export async function initializeGameMonitoring() {
  console.log('🚀 初始化游戏监控系统...');

  try {
    // 根据进程类型初始化不同的监控
    if (typeof window !== 'undefined') {
      // 渲染进程
      await setupRendererProcessMonitoring();
      SystemMonitor.startMemoryMonitoring();
    } else if (typeof process !== 'undefined' && process.type === 'browser') {
      // 主进程
      await setupMainProcessMonitoring();
    }

    console.log('✅ 游戏监控系统初始化完成');
  } catch (error) {
    console.error('❌ 游戏监控系统初始化失败:', error);
  }
}

// ===========================================
// 9. 验收测试示例
// ===========================================

export async function validateMonitoringIntegration(): Promise<boolean> {
  console.log('🧪 验证监控集成...');

  try {
    // 测试关卡加载指标
    const loader = new LevelLoader();
    await loader.loadLevel('test-level', 'easy');

    // 测试战斗指标
    const battle = new BattleManager('test-battle');
    await battle.executeBattleRound(2);
    battle.completeBattle('victory');

    // 测试UI指标
    UIPerformanceMonitor.monitorComponentRender('TestComponent', () => {
      return 'test-result';
    });

    // 验证监控状态
    const { validateMonitoringStatus } = await import('./metrics-integration');
    const status = validateMonitoringStatus();

    const allHealthy = Object.values(status).every(s => s === true);

    console.log('📊 监控状态验证结果:', status);
    console.log(
      `${allHealthy ? '✅' : '⚠️'} 监控系统${allHealthy ? '运行正常' : '部分异常'}`
    );

    return allHealthy;
  } catch (error) {
    console.error('❌ 监控集成验证失败:', error);
    return false;
  }
}

import React from 'react';

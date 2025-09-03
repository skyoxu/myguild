import * as Sentry from '@sentry/electron/renderer';

// 游戏指标类型定义
export interface GameMetricDefinition {
  name: string;
  unit: string;
  description: string;
  tags: string[];
  defaultTags?: Record<string, string>;
}

// 预定义的游戏指标
export const GAME_METRICS: Record<string, GameMetricDefinition> = {
  // 关卡加载相关指标
  LEVEL_LOAD_TIME: {
    name: 'level.load.ms',
    unit: 'millisecond',
    description: '关卡加载时长',
    tags: ['levelId', 'difficulty', 'assetSize'],
    defaultTags: { category: 'performance' },
  },

  LEVEL_LOAD_SUCCESS: {
    name: 'level.load.success',
    unit: 'count',
    description: '关卡加载成功次数',
    tags: ['levelId'],
    defaultTags: { category: 'reliability' },
  },

  LEVEL_LOAD_FAILURE: {
    name: 'level.load.failure',
    unit: 'count',
    description: '关卡加载失败次数',
    tags: ['levelId', 'errorType', 'errorCode'],
    defaultTags: { category: 'reliability' },
  },

  // 战斗相关指标
  BATTLE_ROUND_TIME: {
    name: 'battle.round.ms',
    unit: 'millisecond',
    description: '战斗回合耗时',
    tags: ['battleType', 'round', 'playerCount'],
    defaultTags: { category: 'gameplay' },
  },

  BATTLE_DECISION_TIME: {
    name: 'battle.decision.ms',
    unit: 'millisecond',
    description: 'AI决策耗时',
    tags: ['aiType', 'complexity'],
    defaultTags: { category: 'ai_performance' },
  },

  BATTLE_COMPLETION: {
    name: 'battle.completed',
    unit: 'count',
    description: '战斗完成次数',
    tags: ['battleType', 'result', 'duration'],
    defaultTags: { category: 'gameplay' },
  },

  // UI性能相关指标
  UI_RENDER_TIME: {
    name: 'ui.render.ms',
    unit: 'millisecond',
    description: 'UI渲染耗时',
    tags: ['component', 'complexity'],
    defaultTags: { category: 'ui_performance' },
  },

  UI_INTERACTION_DELAY: {
    name: 'ui.interaction.delay.ms',
    unit: 'millisecond',
    description: 'UI交互响应延迟',
    tags: ['action', 'component'],
    defaultTags: { category: 'ui_performance' },
  },

  // 资源加载相关指标
  ASSET_LOAD_TIME: {
    name: 'asset.load.ms',
    unit: 'millisecond',
    description: '资源加载时长',
    tags: ['assetType', 'size', 'source'],
    defaultTags: { category: 'resource_performance' },
  },

  MEMORY_USAGE: {
    name: 'memory.usage.mb',
    unit: 'megabyte',
    description: '内存使用量',
    tags: ['component', 'phase'],
    defaultTags: { category: 'resource_usage' },
  },

  // 游戏会话相关指标
  SESSION_DURATION: {
    name: 'session.duration.min',
    unit: 'minute',
    description: '游戏会话时长',
    tags: ['sessionType'],
    defaultTags: { category: 'engagement' },
  },

  SAVE_OPERATION_TIME: {
    name: 'save.operation.ms',
    unit: 'millisecond',
    description: '存档操作耗时',
    tags: ['saveType', 'dataSize'],
    defaultTags: { category: 'persistence' },
  },

  // 错误相关指标
  GAME_ERROR_RATE: {
    name: 'game.error.count',
    unit: 'count',
    description: '游戏错误次数',
    tags: ['errorType', 'severity', 'component'],
    defaultTags: { category: 'reliability' },
  },
};

/**
 * 游戏指标管理器
 * 统一管理所有游戏相关的自定义指标上报
 */
export class GameMetricsManager {
  private static instance: GameMetricsManager;
  private metricsBuffer: Map<string, any[]> = new Map();
  private isInitialized = false;
  private batchTimer?: NodeJS.Timeout;

  static getInstance(): GameMetricsManager {
    if (!GameMetricsManager.instance) {
      GameMetricsManager.instance = new GameMetricsManager();
    }
    return GameMetricsManager.instance;
  }

  /**
   * 初始化指标管理器
   */
  initialize(): void {
    if (this.isInitialized) return;

    console.log('🎮 游戏指标管理器初始化中...');

    // 设置批量发送定时器（每30秒批量发送一次指标）
    this.batchTimer = setInterval(() => {
      this.flushMetrics();
    }, 30000);

    // 监听页面卸载事件，确保指标发送
    window.addEventListener('beforeunload', () => {
      this.flushMetrics();
    });

    this.isInitialized = true;
    console.log('✅ 游戏指标管理器初始化完成');
  }

  /**
   * 发送指标 - 按您要求的格式
   */
  recordMetric(
    metricKey: keyof typeof GAME_METRICS,
    value: number,
    tags: Record<string, string> = {}
  ): void {
    try {
      const metricDef = GAME_METRICS[metricKey];
      if (!metricDef) {
        console.warn(`⚠️ 未知的指标类型: ${metricKey}`);
        return;
      }

      const finalTags = {
        ...metricDef.defaultTags,
        ...tags,
        timestamp: Date.now().toString(),
      };

      // 发送指标作为自定义事件（metrics API已移除）
      Sentry.addBreadcrumb({
        message: `Metric: ${metricDef.name}`,
        level: 'info',
        data: {
          value,
          unit: metricDef.unit,
          ...finalTags,
        },
        category: 'metrics',
      });

      console.log(
        `📊 [${metricKey}] ${metricDef.name}=${value}${metricDef.unit}`,
        finalTags
      );

      // 同时记录到批量缓冲区用于汇总分析
      this.bufferMetric(metricKey, value, finalTags);
    } catch (error) {
      console.warn(`⚠️ 指标记录失败 [${metricKey}]:`, error.message);
    }
  }

  /**
   * 记录关卡加载时长 - 按您的示例实现
   */
  recordLevelLoadTime(
    loadMs: number,
    levelId: string,
    difficulty?: string
  ): void {
    this.recordMetric('LEVEL_LOAD_TIME', loadMs, {
      levelId,
      ...(difficulty && { difficulty }),
    });
  }

  /**
   * 记录战斗回合耗时
   */
  recordBattleRoundTime(
    roundMs: number,
    battleType: string,
    round: number,
    playerCount?: number
  ): void {
    this.recordMetric('BATTLE_ROUND_TIME', roundMs, {
      battleType,
      round: round.toString(),
      ...(playerCount && { playerCount: playerCount.toString() }),
    });
  }

  /**
   * 记录AI决策耗时
   */
  recordAIDecisionTime(
    decisionMs: number,
    aiType: string,
    complexity: string
  ): void {
    this.recordMetric('BATTLE_DECISION_TIME', decisionMs, {
      aiType,
      complexity,
    });
  }

  /**
   * 记录UI渲染时长
   */
  recordUIRenderTime(
    renderMs: number,
    component: string,
    complexity?: string
  ): void {
    this.recordMetric('UI_RENDER_TIME', renderMs, {
      component,
      ...(complexity && { complexity }),
    });
  }

  /**
   * 记录资源加载时长
   */
  recordAssetLoadTime(loadMs: number, assetType: string, size?: number): void {
    this.recordMetric('ASSET_LOAD_TIME', loadMs, {
      assetType,
      ...(size && { size: size.toString() }),
    });
  }

  /**
   * 记录内存使用量
   */
  recordMemoryUsage(usageMB: number, component: string, phase: string): void {
    this.recordMetric('MEMORY_USAGE', usageMB, {
      component,
      phase,
    });
  }

  /**
   * 记录游戏会话时长
   */
  recordSessionDuration(
    durationMin: number,
    sessionType: string = 'normal'
  ): void {
    this.recordMetric('SESSION_DURATION', durationMin, {
      sessionType,
    });
  }

  /**
   * 记录存档操作时长
   */
  recordSaveOperationTime(
    saveMs: number,
    saveType: string,
    dataSize?: number
  ): void {
    this.recordMetric('SAVE_OPERATION_TIME', saveMs, {
      saveType,
      ...(dataSize && { dataSize: dataSize.toString() }),
    });
  }

  /**
   * 记录游戏错误
   */
  recordGameError(
    errorType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    component: string
  ): void {
    this.recordMetric('GAME_ERROR_RATE', 1, {
      errorType,
      severity,
      component,
    });
  }

  /**
   * 记录关卡加载成功
   */
  recordLevelLoadSuccess(levelId: string): void {
    this.recordMetric('LEVEL_LOAD_SUCCESS', 1, { levelId });
  }

  /**
   * 记录关卡加载失败
   */
  recordLevelLoadFailure(
    levelId: string,
    errorType: string,
    errorCode?: string
  ): void {
    this.recordMetric('LEVEL_LOAD_FAILURE', 1, {
      levelId,
      errorType,
      ...(errorCode && { errorCode }),
    });
  }

  /**
   * 批量发送性能摘要
   */
  private bufferMetric(
    metricKey: string,
    value: number,
    tags: Record<string, string>
  ): void {
    if (!this.metricsBuffer.has(metricKey)) {
      this.metricsBuffer.set(metricKey, []);
    }

    this.metricsBuffer.get(metricKey)!.push({
      value,
      tags,
      timestamp: Date.now(),
    });
  }

  /**
   * 刷新指标缓冲区（发送汇总信息）
   */
  private flushMetrics(): void {
    if (this.metricsBuffer.size === 0) return;

    try {
      const summary: Record<string, any> = {};

      for (const [metricKey, values] of this.metricsBuffer) {
        if (values.length === 0) continue;

        const metricValues = values.map(v => v.value);
        summary[metricKey] = {
          count: values.length,
          avg: metricValues.reduce((a, b) => a + b, 0) / metricValues.length,
          min: Math.min(...metricValues),
          max: Math.max(...metricValues),
          total: metricValues.reduce((a, b) => a + b, 0),
          timeRange: {
            start: Math.min(...values.map(v => v.timestamp)),
            end: Math.max(...values.map(v => v.timestamp)),
          },
        };
      }

      // 发送性能摘要事件
      Sentry.addBreadcrumb({
        message: '游戏指标批量摘要',
        category: 'game.metrics.summary',
        level: 'info',
        data: {
          summary,
          metricsCount: Object.keys(summary).length,
          period: '30s',
        },
      });

      // 清空缓冲区
      this.metricsBuffer.clear();

      console.log('📊 游戏指标批量摘要已发送', {
        metricsCount: Object.keys(summary).length,
      });
    } catch (error) {
      console.warn('⚠️ 指标摘要发送失败:', error.message);
    }
  }

  /**
   * 获取指标定义
   */
  getMetricDefinition(
    metricKey: keyof typeof GAME_METRICS
  ): GameMetricDefinition | undefined {
    return GAME_METRICS[metricKey];
  }

  /**
   * 获取所有指标定义
   */
  getAllMetricDefinitions(): Record<string, GameMetricDefinition> {
    return GAME_METRICS;
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = undefined;
    }

    // 最后一次刷新指标
    this.flushMetrics();

    this.isInitialized = false;
    console.log('🧹 游戏指标管理器已清理');
  }
}

// 导出单例实例和便捷函数
export const gameMetrics = GameMetricsManager.getInstance();

// 便捷的全局函数，可以直接在游戏代码中使用
export const recordLevelLoadTime = (
  loadMs: number,
  levelId: string,
  difficulty?: string
) => {
  gameMetrics.recordLevelLoadTime(loadMs, levelId, difficulty);
};

export const recordBattleRoundTime = (
  roundMs: number,
  battleType: string,
  round: number,
  playerCount?: number
) => {
  gameMetrics.recordBattleRoundTime(roundMs, battleType, round, playerCount);
};

export const recordAIDecisionTime = (
  decisionMs: number,
  aiType: string,
  complexity: string
) => {
  gameMetrics.recordAIDecisionTime(decisionMs, aiType, complexity);
};

export const recordUIRenderTime = (
  renderMs: number,
  component: string,
  complexity?: string
) => {
  gameMetrics.recordUIRenderTime(renderMs, component, complexity);
};

export const recordAssetLoadTime = (
  loadMs: number,
  assetType: string,
  size?: number
) => {
  gameMetrics.recordAssetLoadTime(loadMs, assetType, size);
};

export const recordMemoryUsage = (
  usageMB: number,
  component: string,
  phase: string
) => {
  gameMetrics.recordMemoryUsage(usageMB, component, phase);
};

export const recordGameError = (
  errorType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  component: string
) => {
  gameMetrics.recordGameError(errorType, severity, component);
};

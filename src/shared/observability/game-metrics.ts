import * as Sentry from '@sentry/electron/renderer';

// Game metric definition
export interface GameMetricDefinition {
  name: string;
  unit: string;
  description: string;
  tags: string[];
  defaultTags?: Record<string, string>;
}

// Predefined game metrics
export const GAME_METRICS: Record<string, GameMetricDefinition> = {
  //
  LEVEL_LOAD_TIME: {
    name: 'level.load.ms',
    unit: 'millisecond',
    description: 'Level loading time',
    tags: ['levelId', 'difficulty', 'assetSize'],
    defaultTags: { category: 'performance' },
  },

  LEVEL_LOAD_SUCCESS: {
    name: 'level.load.success',
    unit: 'count',
    description: 'Level load success count',
    tags: ['levelId'],
    defaultTags: { category: 'reliability' },
  },

  LEVEL_LOAD_FAILURE: {
    name: 'level.load.failure',
    unit: 'count',
    description: 'Level load failure count',
    tags: ['levelId', 'errorType', 'errorCode'],
    defaultTags: { category: 'reliability' },
  },

  //
  BATTLE_ROUND_TIME: {
    name: 'battle.round.ms',
    unit: 'millisecond',
    description: 'Battle round duration',
    tags: ['battleType', 'round', 'playerCount'],
    defaultTags: { category: 'gameplay' },
  },

  BATTLE_DECISION_TIME: {
    name: 'battle.decision.ms',
    unit: 'millisecond',
    description: 'AI decision latency',
    tags: ['aiType', 'complexity'],
    defaultTags: { category: 'ai_performance' },
  },

  BATTLE_COMPLETION: {
    name: 'battle.completed',
    unit: 'count',
    description: 'Battle completion count',
    tags: ['battleType', 'result', 'duration'],
    defaultTags: { category: 'gameplay' },
  },

  // UI
  UI_RENDER_TIME: {
    name: 'ui.render.ms',
    unit: 'millisecond',
    description: 'UI render time',
    tags: ['component', 'complexity'],
    defaultTags: { category: 'ui_performance' },
  },

  UI_INTERACTION_DELAY: {
    name: 'ui.interaction.delay.ms',
    unit: 'millisecond',
    description: 'UI interaction delay',
    tags: ['action', 'component'],
    defaultTags: { category: 'ui_performance' },
  },

  //
  ASSET_LOAD_TIME: {
    name: 'asset.load.ms',
    unit: 'millisecond',
    description: 'Asset load time',
    tags: ['assetType', 'size', 'source'],
    defaultTags: { category: 'resource_performance' },
  },

  MEMORY_USAGE: {
    name: 'memory.usage.mb',
    unit: 'megabyte',
    description: 'Memory usage',
    tags: ['component', 'phase'],
    defaultTags: { category: 'resource_usage' },
  },

  //
  SESSION_DURATION: {
    name: 'session.duration.min',
    unit: 'minute',
    description: 'Session duration',
    tags: ['sessionType'],
    defaultTags: { category: 'engagement' },
  },

  SAVE_OPERATION_TIME: {
    name: 'save.operation.ms',
    unit: 'millisecond',
    description: 'Save operation time',
    tags: ['saveType', 'dataSize'],
    defaultTags: { category: 'persistence' },
  },

  //
  GAME_ERROR_RATE: {
    name: 'game.error.count',
    unit: 'count',
    description: 'Game error count',
    tags: ['errorType', 'severity', 'component'],
    defaultTags: { category: 'reliability' },
  },
};

/**
 *
 *
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
   *
   */
  initialize(): void {
    if (this.isInitialized) return;

    console.log(' ...');

    // 30
    this.batchTimer = setInterval(() => {
      this.flushMetrics();
    }, 30000);

    //
    window.addEventListener('beforeunload', () => {
      this.flushMetrics();
    });

    this.isInitialized = true;
    console.log(' ');
  }

  /**
   *  -
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

      // metrics API
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

      //
      this.bufferMetric(metricKey, value, finalTags);
    } catch (error) {
      console.warn(`⚠️ 指标记录失败 [${metricKey}]:`, error.message);
    }
  }

  /**
   *  -
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
   *
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
   * AI
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
   * UI
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
   *
   */
  recordAssetLoadTime(loadMs: number, assetType: string, size?: number): void {
    this.recordMetric('ASSET_LOAD_TIME', loadMs, {
      assetType,
      ...(size && { size: size.toString() }),
    });
  }

  /**
   *
   */
  recordMemoryUsage(usageMB: number, component: string, phase: string): void {
    this.recordMetric('MEMORY_USAGE', usageMB, {
      component,
      phase,
    });
  }

  /**
   *
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
   *
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
   *
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
   *
   */
  recordLevelLoadSuccess(levelId: string): void {
    this.recordMetric('LEVEL_LOAD_SUCCESS', 1, { levelId });
  }

  /**
   *
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
   *
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
   *
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

      //
      Sentry.addBreadcrumb({
        message: 'game.metrics.summary',
        category: 'game.metrics.summary',
        level: 'info',
        data: {
          summary,
          metricsCount: Object.keys(summary).length,
          period: '30s',
        },
      });

      //
      this.metricsBuffer.clear();

      console.log('[game-metrics] summary emitted', {
        metricsCount: Object.keys(summary).length,
      });
    } catch (error) {
      console.warn(
        '[game-metrics] summary emission failed:',
        (error as any)?.message ?? error
      );
    }
  }

  /**
   *
   */
  getMetricDefinition(
    metricKey: keyof typeof GAME_METRICS
  ): GameMetricDefinition | undefined {
    return GAME_METRICS[metricKey];
  }

  /**
   *
   */
  getAllMetricDefinitions(): Record<string, GameMetricDefinition> {
    return GAME_METRICS;
  }

  /**
   *
   */
  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = undefined;
    }

    //
    this.flushMetrics();

    this.isInitialized = false;
    console.log(' ');
  }
}

//
export const gameMetrics = GameMetricsManager.getInstance();

//
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

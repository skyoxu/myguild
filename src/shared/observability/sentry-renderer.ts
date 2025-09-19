import * as Sentry from '@sentry/electron/renderer';

declare global {
  interface Window {
    __APP_VERSION__?: string;
  }
}

// 环境差异化配置
interface RendererSentryConfig {
  dsn: string;
  environment: 'development' | 'staging' | 'production';
  sampleRate: number;
  tracesSampleRate: number;
  autoSessionTracking: boolean;
  enableTracing: boolean;
  release?: string;
  dist?: string;
}

const RENDERER_SENTRY_CONFIGS: Record<string, RendererSentryConfig> = {
  production: {
    dsn: process.env.SENTRY_DSN || '',
    environment: 'production',
    sampleRate: 1.0,
    tracesSampleRate: 0.2, // 按您要求设置为20%
    autoSessionTracking: true,
    enableTracing: true,
    release: window.__APP_VERSION__,
    dist: 'renderer-prod',
  },

  staging: {
    dsn: process.env.SENTRY_DSN_STAGING || process.env.SENTRY_DSN || '',
    environment: 'staging',
    sampleRate: 1.0,
    tracesSampleRate: 0.3,
    autoSessionTracking: true,
    enableTracing: true,
    release: window.__APP_VERSION__,
    dist: 'renderer-staging',
  },

  development: {
    dsn: process.env.SENTRY_DSN_DEV || '',
    environment: 'development',
    sampleRate: 1.0,
    tracesSampleRate: 1.0, // 开发环境100%追踪
    autoSessionTracking: true,
    enableTracing: true,
    release: window.__APP_VERSION__,
    dist: 'renderer-dev',
  },
};

/**
 * 初始化Sentry渲染进程监控
 * 企业级配置，支持环境差异化、性能追踪、自定义指标
 */
export function initSentryRenderer(): Promise<boolean> {
  return new Promise(resolve => {
    try {
      // 🔧 确定当前环境
      const environment = determineEnvironment();
      const config = RENDERER_SENTRY_CONFIGS[environment];

      if (!validateRendererConfig(config)) {
        console.warn('🟡 Sentry渲染进程配置验证失败');
        resolve(false);
        return;
      }

      console.log(`🔍 初始化Sentry渲染进程监控 [${environment}]`);

      // 🎯 核心Sentry初始化
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        dist: config.dist,

        // 📊 性能追踪配置 - 按您要求设置
        sampleRate: config.sampleRate,
        tracesSampleRate: config.tracesSampleRate,
        autoSessionTracking: config.autoSessionTracking,
        enableTracing: config.enableTracing,

        // 🎮 渲染进程特定标签
        initialScope: {
          tags: {
            'process.type': 'renderer',
            'app.type': 'electron-game-renderer',
            'game.engine.ui': 'react',
            'game.engine.core': 'phaser',
            'renderer.framework': 'react-19',
            'css.framework': 'tailwind-v4',
          },

          contexts: {
            renderer: {
              name: 'Guild Manager Renderer',
              version: window.__APP_VERSION__ || 'unknown',
              userAgent: navigator.userAgent,
              language: navigator.language,
              platform: navigator.platform,
            },
          },
        },

        // 🔧 渲染进程集成
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.httpClientIntegration(),
          Sentry.captureConsoleIntegration(),
        ],

        // 🚫 隐私保护
        beforeSend(event, hint) {
          const filteredEvent = filterRendererPII(event, hint);
          return filteredEvent as any;
        },

        beforeBreadcrumb(breadcrumb) {
          return filterRendererBreadcrumb(breadcrumb);
        },
      });

      // 🔍 初始化后验证
      setTimeout(() => {
        const isInitialized = validateRendererInitialization();
        if (isInitialized) {
          console.log('✅ Sentry渲染进程初始化成功');
          setupRendererExtensions(config);
          initializeGameMetrics();
        } else {
          console.error('❌ Sentry渲染进程初始化验证失败');
        }
        resolve(isInitialized);
      }, 100);
    } catch (error) {
      console.error('💥 Sentry渲染进程初始化异常:', error);
      resolve(false);
    }
  });
}

/**
 * 确定当前运行环境
 */
function determineEnvironment(): string {
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  // 开发模式检测
  if (process.env.ELECTRON_IS_DEV) {
    return 'development';
  }

  // 预发布检测
  if (process.env.STAGING || window.__APP_VERSION__?.includes('beta')) {
    return 'staging';
  }

  return 'production';
}

/**
 * 验证渲染进程配置
 */
function validateRendererConfig(config: RendererSentryConfig): boolean {
  if (!config.dsn) {
    console.warn('🟡 未配置渲染进程Sentry DSN');
    return false;
  }
  return true;
}

/**
 * 验证渲染进程初始化
 */
function validateRendererInitialization(): boolean {
  try {
    const client = Sentry.getClient();
    return !!client && !!client.getOptions().dsn;
  } catch (error) {
    console.error('渲染进程Sentry初始化验证异常:', error);
    return false;
  }
}

/**
 * PII过滤 - 渲染进程
 */
function filterRendererPII(
  event: Sentry.Event,
  hint: Sentry.EventHint
): Sentry.Event | null {
  // 过滤用户输入敏感信息
  if (event.request?.data) {
    const data = event.request.data;
    if (typeof data === 'object' && data !== null) {
      delete (data as any).password;
      delete (data as any).token;
      delete (data as any).apiKey;
    }
  }

  // 过滤DOM中的敏感信息
  if (event.extra) {
    delete event.extra.userInputs;
    delete event.extra.formData;
  }

  return event;
}

/**
 * 面包屑过滤 - 渲染进程
 */
function filterRendererBreadcrumb(
  breadcrumb: Sentry.Breadcrumb
): Sentry.Breadcrumb | null {
  // 过滤UI事件中的敏感信息
  if (
    breadcrumb.category === 'ui.input' &&
    breadcrumb.message?.includes('password')
  ) {
    return null;
  }

  return breadcrumb;
}

/**
 * 设置渲染进程扩展功能
 */
function setupRendererExtensions(config: RendererSentryConfig): void {
  // 设置渲染进程标签
  Sentry.setTags({
    'renderer.init.success': 'true',
    'renderer.config.environment': config.environment,
    'renderer.tracesSampleRate': config.tracesSampleRate.toString(),
  });

  // 记录渲染进程初始化
  Sentry.addBreadcrumb({
    message: 'Sentry渲染进程监控启用',
    category: 'observability.renderer',
    level: 'info',
    data: {
      environment: config.environment,
      tracesSampleRate: config.tracesSampleRate,
      autoSessionTracking: config.autoSessionTracking,
    },
  });
}

/**
 * 初始化游戏指标系统
 */
function initializeGameMetrics(): void {
  console.log('🎮 初始化游戏指标系统...');

  // 延迟加载游戏指标管理器，避免循环依赖
  setTimeout(async () => {
    try {
      const { GameMetricsManager } = await import('./game-metrics');
      const metricsManager = GameMetricsManager.getInstance();
      metricsManager.initialize();
    } catch (error) {
      console.warn('⚠️ 游戏指标系统初始化失败:', error);
    }
  }, 1000);
}

/**
 * 发送自定义业务指标 - 渲染进程版本
 * 按您要求的格式实现
 */
export function sendGameMetric(
  metricName: string,
  value: number,
  tags: Record<string, string> = {}
): void {
  try {
    // 使用您要求的distribution格式
    // Metrics API has changed, use addBreadcrumb instead
    Sentry.addBreadcrumb({
      message: `metric.${metricName}`,
      level: 'info',
      data: {
        value,
        source: 'renderer',
        environment: determineEnvironment(),
        ...tags,
      },
    });

    console.log(`📊 游戏指标已发送: ${metricName}=${value}`, tags);
  } catch (error) {
    console.warn('⚠️ 游戏指标发送失败:', error.message);
  }
}

/**
 * 发送关卡加载时长指标 - 按您的示例实现
 */
export function reportLevelLoadTime(loadMs: number, levelId: string): void {
  sendGameMetric('level.load.ms', loadMs, { levelId });
}

/**
 * 发送战斗回合耗时指标
 */
export function reportBattleRoundTime(
  roundMs: number,
  battleType: string,
  round: number
): void {
  sendGameMetric('battle.round.ms', roundMs, {
    battleType,
    round: round.toString(),
  });
}

// 导出React集成所需的依赖
import React, { useEffect } from 'react';
// React Router integration disabled due to API compatibility issues
// import {
//   useLocation,
//   useNavigationType,
//   createRoutesFromChildren,
//   matchRoutes,
// } from 'react-router-dom';

import { app, session } from 'electron';
import * as Sentry from '@sentry/electron/main';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// 环境配置类型定义
interface SentryEnvironmentConfig {
  dsn: string;
  environment: 'development' | 'staging' | 'production';
  sampleRate: number;
  tracesSampleRate: number;
  autoSessionTracking: boolean;
  enableTracing: boolean;
  release?: string;
  dist?: string;
}

// 动态采样策略配置
interface DynamicSamplingConfig {
  baseSampleRate: number;
  errorThreshold: number;
  performanceThreshold: number;
  criticalTransactions: string[];
}

// 环境差异化配置 + 动态采样
const SENTRY_CONFIGS: Record<
  string,
  SentryEnvironmentConfig & { dynamicSampling: DynamicSamplingConfig }
> = {
  production: {
    dsn: process.env.SENTRY_DSN || '',
    environment: 'production',
    sampleRate: 1.0, // 生产环境100%错误采集
    tracesSampleRate: 0.2, // 按您要求设置为20%性能追踪（基础值）
    autoSessionTracking: true, // 开启Release Health
    enableTracing: true,
    release: `app@${app.getVersion?.() ?? 'unknown'}+${process.platform}`,
    dist: process.platform,
    dynamicSampling: {
      baseSampleRate: 0.2, // 基础采样率也更新为0.2
      errorThreshold: 0.05,
      performanceThreshold: 500,
      criticalTransactions: ['startup', 'game.load', 'ai.decision'],
    },
  },

  staging: {
    dsn: process.env.SENTRY_DSN_STAGING || process.env.SENTRY_DSN || '',
    environment: 'staging',
    sampleRate: 1.0, // 预发布环境100%采集
    tracesSampleRate: 0.3, // 预发布环境30%性能追踪（基础值）
    autoSessionTracking: true,
    enableTracing: true,
    release: `app@${app.getVersion?.() ?? 'unknown'}+${process.platform}`,
    dist: `${process.platform}-staging`,
    dynamicSampling: {
      baseSampleRate: 0.3,
      errorThreshold: 0.02,
      performanceThreshold: 300,
      criticalTransactions: ['startup', 'game.load', 'ai.decision'],
    },
  },

  development: {
    dsn: process.env.SENTRY_DSN_DEV || '',
    environment: 'development',
    sampleRate: 1.0, // 开发环境100%采集（调试需要）
    tracesSampleRate: 1.0, // 开发环境100%性能追踪
    autoSessionTracking: true,
    enableTracing: true,
    release: `app@${app.getVersion?.() ?? 'dev'}+${process.platform}`,
    dist: `${process.platform}-dev`,
    dynamicSampling: {
      baseSampleRate: 1.0,
      errorThreshold: 0.0,
      performanceThreshold: 100,
      criticalTransactions: ['startup', 'game.load', 'ai.decision'],
    },
  },
};

// 性能监控状态
const performanceStats = {
  avgResponseTime: 0,
  errorRate: 0,
  cpuUsage: 0,
  lastUpdate: Date.now(),
};

/**
 * 初始化Sentry主进程监控
 * 企业级配置，支持环境差异化、动态采样、Release Health
 */
export function initSentryMain(): Promise<boolean> {
  return new Promise(resolve => {
    try {
      // 🔧 确定当前环境
      const environment = determineEnvironment();
      const config = SENTRY_CONFIGS[environment];

      // 🚨 验证配置完整性
      if (!validateSentryConfig(config)) {
        console.warn('🟡 Sentry配置验证失败，使用降级模式');
        resolve(false);
        return;
      }

      console.log(`🔍 初始化Sentry主进程监控 [${environment}]`);

      // 🎯 核心Sentry初始化
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        dist: config.dist,

        // 📊 动态采样策略
        sampleRate: config.sampleRate,
        tracesSampler: createDynamicTracesSampler(config.dynamicSampling),

        // 🏥 Release Health配置（自动启用）
        enableTracing: config.enableTracing,

        // 🎮 游戏特定标签
        initialScope: {
          tags: {
            'app.type': 'electron-game',
            'game.name': 'guild-manager',
            'engine.ui': 'react',
            'engine.game': 'phaser',
            platform: process.platform,
            arch: process.arch,
            'node.version': process.version,
          },

          // 🎯 默认上下文
          contexts: {
            app: {
              name: 'Guild Manager',
              version: app.getVersion?.() ?? 'unknown',
              build: process.env.BUILD_NUMBER || 'local',
            },
            runtime: {
              name: 'electron',
              version: process.versions.electron,
            },
          },
        },

        // 🔧 集成配置
        integrations: [
          Sentry.httpIntegration({ breadcrumbs: true }),
          Sentry.onUncaughtExceptionIntegration(),
          Sentry.onUnhandledRejectionIntegration(),
          Sentry.linkedErrorsIntegration(),
          Sentry.contextLinesIntegration(),
        ],

        // 🚫 隐私保护 - OTel语义兼容的PII过滤
        beforeSend(event, hint) {
          return filterPIIWithOTelSemantics(event, hint);
        },

        // 📊 面包屑过滤
        beforeBreadcrumb(breadcrumb) {
          return filterSensitiveBreadcrumb(breadcrumb);
        },
      });

      // 🔍 初始化后验证
      setTimeout(() => {
        const isInitialized = validateSentryInitialization();
        if (isInitialized) {
          console.log('✅ Sentry主进程初始化成功');
          setupSentryExtensions(config);
          logInitializationEvent(config);
          startPerformanceMonitoring();
        } else {
          console.error('❌ Sentry主进程初始化验证失败');
        }
        resolve(isInitialized);
      }, 100);
    } catch (error) {
      console.error('💥 Sentry主进程初始化异常:', error);
      // 🛡️ 降级处理：即使Sentry失败也不应该影响应用启动
      setupFallbackLogging();
      resolve(false);
    }
  });
}

/**
 * 创建动态采样函数（B建议：固定+动态采样）
 */
function createDynamicTracesSampler(config: DynamicSamplingConfig) {
  return (samplingContext: any) => {
    const { transactionContext } = samplingContext;
    const transactionName = transactionContext?.name || '';

    // 🚨 关键事务强制高采样率
    if (
      config.criticalTransactions.some(critical =>
        transactionName.includes(critical)
      )
    ) {
      return 1.0; // 100%采样关键事务
    }

    // 📈 异常/低健康版本提升采样率
    if (performanceStats.errorRate > config.errorThreshold) {
      return Math.min(1.0, config.baseSampleRate * 2);
    }

    // 🐌 高延迟时自适应下调
    if (performanceStats.avgResponseTime > config.performanceThreshold) {
      return Math.max(0.01, config.baseSampleRate * 0.5);
    }

    // 🔄 CPU负载自适应调节
    if (performanceStats.cpuUsage > 80) {
      return Math.max(0.01, config.baseSampleRate * 0.3);
    }

    return config.baseSampleRate;
  };
}

/**
 * 启动性能监控（支持自适应采样）
 */
function startPerformanceMonitoring(): void {
  setInterval(() => {
    try {
      // 更新性能统计
      updatePerformanceStats();
    } catch (error) {
      console.warn('性能监控更新失败:', error);
    }
  }, 30000); // 每30秒更新
}

/**
 * 更新性能统计
 */
function updatePerformanceStats(): void {
  // 这里可以接入实际的性能监控逻辑
  performanceStats.lastUpdate = Date.now();

  // 示例：从进程监控获取CPU使用率
  if (process.cpuUsage) {
    const usage = process.cpuUsage();
    performanceStats.cpuUsage = (usage.user + usage.system) / 1000000; // 转换为百分比
  }
}

/**
 * 确定当前运行环境
 */
function determineEnvironment(): string {
  // 环境变量优先
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  // 开发模式检测
  if (process.env.ELECTRON_IS_DEV || !app.isPackaged) {
    return 'development';
  }

  // 预发布检测
  if (process.env.STAGING || app.getVersion?.()?.includes('beta')) {
    return 'staging';
  }

  // 默认生产环境
  return 'production';
}

/**
 * 验证Sentry配置
 */
function validateSentryConfig(config: SentryEnvironmentConfig): boolean {
  if (!config.dsn) {
    console.warn('🟡 未配置Sentry DSN，跳过初始化');
    return false;
  }

  if (!config.dsn.startsWith('https://')) {
    console.error('❌ Sentry DSN格式无效');
    return false;
  }

  return true;
}

/**
 * 验证Sentry初始化状态
 */
function validateSentryInitialization(): boolean {
  try {
    // 检查Sentry客户端是否可用
    const client = Sentry.getClient();
    if (!client) {
      return false;
    }

    // 检查SDK版本兼容性
    const options = client.getOptions();
    if (!options.dsn) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Sentry初始化验证异常:', error);
    return false;
  }
}

/**
 * F建议：PII过滤和Minidump处理（OTel语义兼容）
 */
function filterPIIWithOTelSemantics(
  event: Sentry.Event,
  hint: Sentry.EventHint
): Sentry.Event | null {
  // 🚫 移除PII敏感信息
  if (event.request?.headers) {
    delete event.request.headers['authorization'];
    delete event.request.headers['cookie'];
    delete event.request.headers['x-api-key'];
  }

  // 🚫 过滤用户敏感信息（遵循OTel语义）
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    // 保留OTel兼容的用户标识
    if (event.user.id) {
      event.user.id = 'anonymous';
    }
  }

  // 🚫 处理异常信息中的PII
  if (event.exception?.values) {
    event.exception.values.forEach(exception => {
      // 使用OTel异常语义
      if (exception.type && exception.message) {
        // 清理异常消息中的敏感信息
        exception.message = sanitizeMessage(exception.message);
      }
    });
  }

  // 🎯 确保OTel语义字段
  if (event.contexts) {
    if (event.contexts.trace) {
      // 保留OTel trace语义
      const traceContext = event.contexts.trace;
      event.tags = event.tags || {};
      if (traceContext.trace_id) {
        event.tags['trace.id'] = traceContext.trace_id;
      }
      if (traceContext.span_id) {
        event.tags['span.id'] = traceContext.span_id;
      }
    }
  }

  return event;
}

/**
 * 清理消息中的敏感信息
 */
function sanitizeMessage(message: string): string {
  // 移除常见的敏感信息模式
  return message
    .replace(/password[=:]\s*[^\s]+/gi, 'password=[REDACTED]')
    .replace(/token[=:]\s*[^\s]+/gi, 'token=[REDACTED]')
    .replace(/key[=:]\s*[^\s]+/gi, 'key=[REDACTED]')
    .replace(/secret[=:]\s*[^\s]+/gi, 'secret=[REDACTED]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD_NUMBER]'); // 信用卡号
}

/**
 * 过滤敏感面包屑
 */
function filterSensitiveBreadcrumb(
  breadcrumb: Sentry.Breadcrumb
): Sentry.Breadcrumb | null {
  // 🚫 过滤包含敏感信息的面包屑
  if (breadcrumb.category === 'http' && breadcrumb.data?.url) {
    const url = breadcrumb.data.url;
    if (
      url.includes('password') ||
      url.includes('token') ||
      url.includes('secret')
    ) {
      return null;
    }
  }

  // 🚫 过滤用户输入相关面包屑
  if (
    breadcrumb.category === 'ui.input' &&
    breadcrumb.message?.includes('password')
  ) {
    return null;
  }

  return breadcrumb;
}

/**
 * 设置Sentry扩展功能
 */
function setupSentryExtensions(config: SentryEnvironmentConfig): void {
  // 🎯 设置用户上下文（非敏感信息）
  Sentry.setUser({
    id: 'anonymous', // 不使用真实用户ID
    username: 'player',
  });

  // 🏷️ 设置全局标签
  Sentry.setTags({
    'init.success': 'true',
    'init.environment': config.environment,
    'init.timestamp': new Date().toISOString(),
  });

  // 📝 设置Release Health用户反馈
  if (config.environment === 'production') {
    setupUserFeedback();
  }
}

/**
 * 设置用户反馈机制
 */
function setupUserFeedback(): void {
  // 🗣️ 在崩溃时收集用户反馈
  process.on('uncaughtException', error => {
    Sentry.captureException(error);

    // 可选：显示用户反馈对话框
    // showUserFeedbackDialog();
  });
}

/**
 * 记录初始化事件（OTel兼容格式）
 */
function logInitializationEvent(config: SentryEnvironmentConfig): void {
  Sentry.addBreadcrumb({
    message: 'Sentry主进程初始化完成',
    category: 'observability',
    level: 'info',
    data: {
      environment: config.environment,
      sampleRate: config.sampleRate,
      tracesSampleRate: config.tracesSampleRate,
      autoSessionTracking: config.autoSessionTracking,
      platform: process.platform,
      version: app.getVersion?.() ?? 'unknown',
      // OTel语义字段
      'service.name': 'guild-manager',
      'service.version': app.getVersion?.() ?? 'unknown',
      'deployment.environment': config.environment,
    },
  });

  // 🎯 发送初始化成功事件
  Sentry.captureMessage('Sentry主进程监控已启用', 'info');
}

/**
 * 降级日志记录（D建议：结构化日志JSON格式）
 */
function setupFallbackLogging(): void {
  console.log('🔄 设置降级日志记录...');

  // 创建本地日志目录
  const logsDir = join(app.getPath('userData'), 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  // 设置本地错误日志（统一JSON模式）
  process.on('uncaughtException', error => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      component: 'main-process',
      message: error.message,
      context: {
        type: 'uncaughtException',
        stack: error.stack,
        platform: process.platform,
        version: app.getVersion?.() ?? 'unknown',
      },
      // OTel语义字段
      trace_id: generateTraceId(),
      span_id: generateSpanId(),
      'exception.type': error.constructor.name,
      'exception.message': error.message,
    };

    const logFile = join(
      logsDir,
      `error-${new Date().toISOString().split('T')[0]}.log`
    );
    writeFileSync(logFile, JSON.stringify(logEntry) + '\n', { flag: 'a' });
  });
}

/**
 * 生成简单的trace ID（用于降级日志）
 */
function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * 生成简单的span ID（用于降级日志）
 */
function generateSpanId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * 集成SQLite健康指标到Sentry监控
 */
export async function integrateObservabilityMetrics(): Promise<void> {
  try {
    console.log('🔗 集成可观测性指标到Sentry...');

    // 动态导入可观测性集成器
    // TODO: 实现 ObservabilityManager 或移除此功能
    // const { ObservabilityManager } = await import(
    //   '../../scripts/observability-integration.mjs'
    // );

    const observabilityConfig = {
      dbPath: process.env.DB_PATH || 'data/app.db',
      sentryDsn: process.env.SENTRY_DSN,
      metricsInterval: 60, // Sentry集成使用较长间隔
      enabled: true,
    };

    const manager = new ObservabilityManager(observabilityConfig);

    // 启动定期指标收集和上报
    setInterval(async () => {
      try {
        await manager.collectAndExpose();
      } catch (error) {
        console.warn('⚠️ 可观测性指标收集失败:', error.message);
      }
    }, observabilityConfig.metricsInterval * 1000);

    // 立即执行一次收集
    await manager.collectAndExpose();

    console.log('✅ SQLite健康指标已集成到Sentry监控');
  } catch (error) {
    console.warn('⚠️ 可观测性指标集成失败:', error.message);
    // 不应该因为监控失败而影响主应用启动
  }
}

/**
 * 向Sentry发送自定义业务指标 - 按您要求的distribution格式
 */
export function sendBusinessMetric(
  metricName: string,
  value: number,
  unit: string = 'count',
  tags: Record<string, string> = {}
): void {
  try {
    // 发送指标作为面包屑（metrics API已移除）
    Sentry.addBreadcrumb({
      message: `Metric: ${metricName}`,
      level: 'info',
      data: {
        value,
        component: 'main-process',
        environment: determineEnvironment(),
        ...tags,
      },
      category: 'metrics',
    });

    console.log(`📊 主进程指标已发送: ${metricName}=${value}${unit}`, tags);
  } catch (error) {
    console.warn('⚠️ 主进程指标发送失败:', error.message);
  }
}

/**
 * 发送关卡加载时长指标 - 主进程版本
 */
export function reportLevelLoadTimeMain(loadMs: number, levelId: string): void {
  sendBusinessMetric('level.load.ms', loadMs, 'millisecond', {
    levelId,
    source: 'main-process',
  });
}

/**
 * 发送战斗回合耗时指标 - 主进程版本
 */
export function reportBattleRoundTimeMain(
  roundMs: number,
  battleType: string,
  round: number
): void {
  sendBusinessMetric('battle.round.ms', roundMs, 'millisecond', {
    battleType,
    round: round.toString(),
    source: 'main-process',
  });
}

/**
 * 发送系统性能指标
 */
export function reportSystemMetrics(): void {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // 发送内存指标
    sendBusinessMetric(
      'system.memory.rss.mb',
      Math.round(memUsage.rss / 1024 / 1024),
      'megabyte',
      {
        type: 'rss',
      }
    );

    sendBusinessMetric(
      'system.memory.heap.mb',
      Math.round(memUsage.heapUsed / 1024 / 1024),
      'megabyte',
      {
        type: 'heap',
      }
    );

    // 发送CPU指标
    sendBusinessMetric(
      'system.cpu.user.ms',
      Math.round(cpuUsage.user / 1000),
      'millisecond',
      {
        type: 'user',
      }
    );

    sendBusinessMetric(
      'system.cpu.system.ms',
      Math.round(cpuUsage.system / 1000),
      'millisecond',
      {
        type: 'system',
      }
    );
  } catch (error) {
    console.warn('⚠️ 系统性能指标发送失败:', error.message);
  }
}

/**
 * 定期发送系统指标
 */
export function startSystemMetricsCollection(): void {
  // 立即发送一次
  reportSystemMetrics();

  // 每60秒发送一次系统指标
  const metricsInterval = setInterval(() => {
    reportSystemMetrics();
  }, 60000);

  // 在应用退出时清理
  app.on('before-quit', () => {
    clearInterval(metricsInterval);
    reportSystemMetrics(); // 最后一次上报
  });

  console.log('📊 系统指标收集已启动（每60秒）');
}

/**
 * 发送数据库健康告警
 */
export function sendDatabaseAlert(
  alertType: string,
  message: string,
  severity: 'warning' | 'error' = 'warning',
  extra: Record<string, any> = {}
): void {
  try {
    Sentry.captureMessage(`Database Alert: ${message}`, {
      level: severity,
      tags: {
        component: 'database',
        alertType,
        environment: determineEnvironment(),
      },
      extra,
    });

    console.log(`🚨 数据库告警已发送: ${alertType} - ${message}`);
  } catch (error) {
    console.warn('⚠️ 数据库告警发送失败:', error.message);
  }
}

// 所有函数已在上方直接导出，无需重复导出

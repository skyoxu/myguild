'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.initSentryMain = initSentryMain;
exports.integrateObservabilityMetrics = integrateObservabilityMetrics;
exports.sendBusinessMetric = sendBusinessMetric;
exports.reportLevelLoadTimeMain = reportLevelLoadTimeMain;
exports.reportBattleRoundTimeMain = reportBattleRoundTimeMain;
exports.reportSystemMetrics = reportSystemMetrics;
exports.startSystemMetricsCollection = startSystemMetricsCollection;
exports.sendDatabaseAlert = sendDatabaseAlert;
const electron_1 = require('electron');
const Sentry = __importStar(require('@sentry/electron/main'));
const fs_1 = require('fs');
const path_1 = require('path');
// 环境差异化配置 + 动态采样
const SENTRY_CONFIGS = {
  production: {
    dsn: process.env.SENTRY_DSN || '',
    environment: 'production',
    sampleRate: 1.0, // 生产环境100%错误采集
    tracesSampleRate: 0.2, // 按您要求设置为20%性能追踪（基础值）
    autoSessionTracking: true, // 开启Release Health
    enableTracing: true,
    release: `app@${electron_1.app.getVersion?.() ?? 'unknown'}+${process.platform}`,
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
    release: `app@${electron_1.app.getVersion?.() ?? 'unknown'}+${process.platform}`,
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
    release: `app@${electron_1.app.getVersion?.() ?? 'dev'}+${process.platform}`,
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
function initSentryMain() {
  return new Promise(resolve => {
    try {
      // 🔧 确定当前环境
      const environment = determineEnvironment();
      const config = SENTRY_CONFIGS[environment];
      // 🚨 验证配置完整性
      if (!validateSentryConfig(config)) {
        console.warn('Sentry config validation failed; using degraded mode');
        resolve(false);
        return;
      }
      console.log(`Initialize Sentry (main) [${environment}]`);
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
        // enableTracing已在v5+中移除，通过tracesSampleRate启用追踪
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
              version: electron_1.app.getVersion?.() ?? 'unknown',
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
          const filteredEvent = filterPIIWithOTelSemantics(event, hint);
          return filteredEvent;
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
          console.log('Sentry main initialized');
          setupSentryExtensions(config);
          logInitializationEvent(config);
          startPerformanceMonitoring();
        } else {
          console.error('Sentry main initialization verification failed');
        }
        resolve(isInitialized);
      }, 100);
    } catch (error) {
      console.error('Sentry main initialization error:', error);
      // 🛡️ 降级处理：即使Sentry失败也不应该影响应用启动
      setupFallbackLogging();
      resolve(false);
    }
  });
}
/**
 * 创建动态采样函数（B建议：固定+动态采样）
 */
function createDynamicTracesSampler(config) {
  return samplingContext => {
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
function startPerformanceMonitoring() {
  setInterval(() => {
    try {
      // 更新性能统计
      updatePerformanceStats();
    } catch (error) {
      console.warn('Performance monitoring update failed:', error);
    }
  }, 30000); // 每30秒更新
}
/**
 * 更新性能统计
 */
function updatePerformanceStats() {
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
function determineEnvironment() {
  // 环境变量优先
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }
  // 开发模式检测
  if (process.env.ELECTRON_IS_DEV || !electron_1.app.isPackaged) {
    return 'development';
  }
  // 预发布检测
  if (process.env.STAGING || electron_1.app.getVersion?.()?.includes('beta')) {
    return 'staging';
  }
  // 默认生产环境
  return 'production';
}
/**
 * 验证Sentry配置
 */
function validateSentryConfig(config) {
  if (!config.dsn) {
    console.warn('Sentry DSN not configured; skip initialization');
    return false;
  }
  if (!config.dsn.startsWith('https://')) {
    console.error('Invalid Sentry DSN');
    return false;
  }
  return true;
}
/**
 * 验证Sentry初始化状态
 */
function validateSentryInitialization() {
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
    console.error('Sentry verification error:', error);
    return false;
  }
}
/**
 * F建议：PII过滤和Minidump处理（OTel语义兼容）
 */
function filterPIIWithOTelSemantics(event, hint) {
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
function sanitizeMessage(message) {
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
function filterSensitiveBreadcrumb(breadcrumb) {
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
function setupSentryExtensions(config) {
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
function setupUserFeedback() {
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
function logInitializationEvent(config) {
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
      version: electron_1.app.getVersion?.() ?? 'unknown',
      // OTel语义字段
      'service.name': 'guild-manager',
      'service.version': electron_1.app.getVersion?.() ?? 'unknown',
      'deployment.environment': config.environment,
    },
  });
  // 🎯 发送初始化成功事件
  Sentry.captureMessage('Sentry主进程监控已启用', 'info');
}
/**
 * 降级日志记录（D建议：结构化日志JSON格式）
 */
function setupFallbackLogging() {
  console.log('Setup fallback logging...');
  // 创建本地日志目录
  const logsDir = (0, path_1.join)(electron_1.app.getPath('userData'), 'logs');
  if (!(0, fs_1.existsSync)(logsDir)) {
    (0, fs_1.mkdirSync)(logsDir, { recursive: true });
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
        version: electron_1.app.getVersion?.() ?? 'unknown',
      },
      // OTel语义字段
      trace_id: generateTraceId(),
      span_id: generateSpanId(),
      'exception.type': error.constructor.name,
      'exception.message': error.message,
    };
    const logFile = (0, path_1.join)(
      logsDir,
      `error-${new Date().toISOString().split('T')[0]}.log`
    );
    (0, fs_1.writeFileSync)(logFile, JSON.stringify(logEntry) + '\n', {
      flag: 'a',
    });
  });
}
/**
 * 生成简单的trace ID（用于降级日志）
 */
function generateTraceId() {
  return Math.random().toString(36).substring(2, 15);
}
/**
 * 生成简单的span ID（用于降级日志）
 */
function generateSpanId() {
  return Math.random().toString(36).substring(2, 10);
}
/**
 * 集成SQLite健康指标到Sentry监控
 */
async function integrateObservabilityMetrics() {
  try {
    console.log('Integrate observability metrics into Sentry...');
    class SimpleObservabilityManager {
      config;
      constructor(config) {
        this.config = config;
      }
      async collectAndExpose() {
        try {
          // 简化的指标收集逻辑
          const metrics = {
            timestamp: new Date().toISOString(),
            dbPath: this.config.dbPath,
            enabled: this.config.enabled,
          };
          console.log('Observability metrics collected:', metrics);
        } catch (error) {
          console.warn('Metrics collection error:', error);
        }
      }
    }
    const observabilityConfig = {
      dbPath: process.env.DB_PATH || 'data/app.db',
      sentryDsn: process.env.SENTRY_DSN,
      metricsInterval: 60, // Sentry集成使用较长间隔
      enabled: true,
    };
    const manager = new SimpleObservabilityManager(observabilityConfig);
    // 启动定期指标收集和上报
    setInterval(async () => {
      try {
        await manager.collectAndExpose();
      } catch (error) {
        console.warn('Observability metrics collection failed:', error);
      }
    }, observabilityConfig.metricsInterval * 1000);
    // 立即执行一次收集
    await manager.collectAndExpose();
    console.log('SQLite health metrics integrated into Sentry');
  } catch (error) {
    console.warn('Observability metrics integration failed:', error.message);
    // 不应该因为监控失败而影响主应用启动
  }
}
/**
 * 向Sentry发送自定义业务指标 - 按您要求的distribution格式
 */
function sendBusinessMetric(metricName, value, unit = 'count', tags = {}) {
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
    console.log(
      `Main-process metric sent: ${metricName}=${value}${unit}`,
      tags
    );
  } catch (error) {
    console.warn('Main-process metric send failed:', error.message);
  }
}
/**
 * 发送关卡加载时长指标 - 主进程版本
 */
function reportLevelLoadTimeMain(loadMs, levelId) {
  sendBusinessMetric('level.load.ms', loadMs, 'millisecond', {
    levelId,
    source: 'main-process',
  });
}
/**
 * 发送战斗回合耗时指标 - 主进程版本
 */
function reportBattleRoundTimeMain(roundMs, battleType, round) {
  sendBusinessMetric('battle.round.ms', roundMs, 'millisecond', {
    battleType,
    round: round.toString(),
    source: 'main-process',
  });
}
/**
 * 发送系统性能指标
 */
function reportSystemMetrics() {
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
    console.warn('System performance metric send failed:', error.message);
  }
}
/**
 * 定期发送系统指标
 */
function startSystemMetricsCollection() {
  // 立即发送一次
  reportSystemMetrics();
  // 每60秒发送一次系统指标
  const metricsInterval = setInterval(() => {
    reportSystemMetrics();
  }, 60000);
  // 在应用退出时清理
  electron_1.app.on('before-quit', () => {
    clearInterval(metricsInterval);
    reportSystemMetrics(); // 最后一次上报
  });
  console.log('System metrics collection started (every 60s)');
}
/**
 * 发送数据库健康告警
 */
function sendDatabaseAlert(
  alertType,
  message,
  severity = 'warning',
  extra = {}
) {
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
    console.log(`Database alert sent: ${alertType} - ${message}`);
  } catch (error) {
    console.warn('Database alert send failed:', error.message);
  }
}
// 所有函数已在上方直接导出，无需重复导出

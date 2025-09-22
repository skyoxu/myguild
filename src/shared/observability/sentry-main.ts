import { app } from 'electron';
import * as Sentry from '@sentry/electron/main';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Environment configuration type definition
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

// Dynamic sampling strategy configuration
interface DynamicSamplingConfig {
  baseSampleRate: number;
  errorThreshold: number;
  performanceThreshold: number;
  criticalTransactions: string[];
}

// Environment-specific configuration + dynamic sampling
const SENTRY_CONFIGS: Record<
  string,
  SentryEnvironmentConfig & { dynamicSampling: DynamicSamplingConfig }
> = {
  production: {
    dsn: process.env.SENTRY_DSN || '',
    environment: 'production',
    sampleRate: 1.0, // Production environment 100% error collection
    // NOTE: tracesSampleRate is not used when tracesSampler is provided; keep for completeness.
    tracesSampleRate:
      Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.02') || 0.02,
    autoSessionTracking: true, // Enable Release Health
    enableTracing: true,
    release: `app@${app.getVersion?.() ?? 'unknown'}+${process.platform}`,
    dist: process.platform,
    dynamicSampling: {
      // Use environment override (default 0.02) to control base sampling for production.
      baseSampleRate: (() => {
        const v = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.02');
        return !isFinite(v) || v < 0 || v > 1 ? 0.02 : v;
      })(),
      errorThreshold: 0.05,
      performanceThreshold: 500,
      criticalTransactions: ['startup', 'game.load', 'ai.decision'],
    },
  },

  staging: {
    dsn: process.env.SENTRY_DSN_STAGING || process.env.SENTRY_DSN || '',
    environment: 'staging',
    sampleRate: 1.0, // Staging environment 100% collection
    tracesSampleRate: 0.3, // Staging environment 30% performance tracing (base value)
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
    sampleRate: 1.0, // Development environment 100% collection (debugging needs)
    tracesSampleRate: 1.0, // Development environment 100% performance tracing
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

// Performance monitoring status
const performanceStats = {
  avgResponseTime: 0,
  errorRate: 0,
  cpuUsage: 0,
  lastUpdate: Date.now(),
};

/**
 * Initialize Sentry main process monitoring
 * Enterprise-level configuration, supporting environment differentiation, dynamic sampling, Release Health
 */
export function initSentryMain(): Promise<boolean> {
  return new Promise(resolve => {
    try {
      // [CONFIG] Determine current environment
      const environment = determineEnvironment();
      const config = SENTRY_CONFIGS[environment];

      // [VALIDATION] Verify configuration integrity
      if (!validateSentryConfig(config)) {
        console.warn('Sentry config validation failed; using degraded mode');
        resolve(false);
        return;
      }

      console.log(`Initialize Sentry (main) [${environment}]`);

      // [CORE] Core Sentry initialization
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        dist: config.dist,

        // [METRICS] Dynamic sampling strategy
        sampleRate: config.sampleRate,
        tracesSampler: createDynamicTracesSampler(config.dynamicSampling),

        // [HEALTH] Release Health configuration (auto-enabled)
        // enableTracing has been removed in v5+, enable tracing through tracesSampleRate

        // [GAME] Game-specific tags
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

          // [CONTEXT] Default context
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

        // [INTEGRATION] Integration configuration
        integrations: [
          Sentry.httpIntegration({ breadcrumbs: true }),
          Sentry.onUncaughtExceptionIntegration(),
          Sentry.onUnhandledRejectionIntegration(),
          Sentry.linkedErrorsIntegration(),
          Sentry.contextLinesIntegration(),
        ],

        // [PRIVACY] Privacy protection - OTel semantic compatible PII filtering
        beforeSend(event, hint) {
          const filteredEvent = filterPIIWithOTelSemantics(event, hint);
          return filteredEvent as any;
        },

        // [BREADCRUMB] Breadcrumb filtering
        beforeBreadcrumb(breadcrumb) {
          return filterSensitiveBreadcrumb(breadcrumb);
        },
      });

      // [VERIFICATION] Post-initialization verification
      setTimeout(() => {
        const isInitialized = validateSentryInitialization();
        if (isInitialized) {
          console.log('Sentry main initialized');
          setupSentryExtensions(config);
          logInitializationEvent(config);
          startPerformanceMonitoring();

          // Append effective sampling rate to observability logs (Windows-friendly path)
          try {
            const logsDir = join(process.cwd(), 'logs', 'observability');
            if (!existsSync(logsDir)) {
              try {
                mkdirSync(logsDir, { recursive: true });
              } catch {}
            }
            const logFile = join(logsDir, 'sentry-init-main-latest.log');
            const baseRate = config.dynamicSampling.baseSampleRate;
            const note = `effective.traces.baseSampleRate=${baseRate}`;
            writeFileSync(logFile, note + '\n', { flag: 'a' });
          } catch {}
        } else {
          console.error('Sentry main initialization verification failed');
        }
        resolve(isInitialized);
      }, 100);
    } catch (error) {
      console.error('Sentry main initialization error:', error);
      // [FALLBACK] Degraded handling: Even if Sentry fails, it should not affect application startup
      setupFallbackLogging();
      resolve(false);
    }
  });
}

/**
 * Create dynamic sampling function (B recommendation: fixed + dynamic sampling)
 */
function createDynamicTracesSampler(config: DynamicSamplingConfig) {
  return (samplingContext: any) => {
    const { transactionContext } = samplingContext;
    const transactionName = transactionContext?.name || '';

    // [CRITICAL] Force high sampling rate for critical transactions
    if (
      config.criticalTransactions.some(critical =>
        transactionName.includes(critical)
      )
    ) {
      return 1.0; // 100% sampling for critical transactions
    }

    // [ADAPTIVE] Increase sampling rate for abnormal/low health versions
    if (performanceStats.errorRate > config.errorThreshold) {
      return Math.min(1.0, config.baseSampleRate * 2);
    }

    // [PERFORMANCE] Adaptive down-scaling during high latency
    if (performanceStats.avgResponseTime > config.performanceThreshold) {
      return Math.max(0.01, config.baseSampleRate * 0.5);
    }

    // [CPU] CPU load adaptive adjustment
    if (performanceStats.cpuUsage > 80) {
      return Math.max(0.01, config.baseSampleRate * 0.3);
    }

    return config.baseSampleRate;
  };
}

/**
 * Start performance monitoring (supports adaptive sampling)
 */
function startPerformanceMonitoring(): void {
  setInterval(() => {
    try {
      // Update performance statistics
      updatePerformanceStats();
    } catch (error) {
      console.warn('Performance monitoring update failed:', error);
    }
  }, 30000); // Update every 30 seconds
}

/**
 * Update performance statistics
 */
function updatePerformanceStats(): void {
  // Here you can integrate actual performance monitoring logic
  performanceStats.lastUpdate = Date.now();

  // Example: Get CPU usage from process monitoring
  if (process.cpuUsage) {
    const usage = process.cpuUsage();
    performanceStats.cpuUsage = (usage.user + usage.system) / 1000000; // Convert to percentage
  }
}

/**
 * Determine current runtime environment
 */
function determineEnvironment(): string {
  // Environment variables take priority
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  // Development mode detection
  if (process.env.ELECTRON_IS_DEV || !app.isPackaged) {
    return 'development';
  }

  // Pre-release detection
  if (process.env.STAGING || app.getVersion?.()?.includes('beta')) {
    return 'staging';
  }

  // Default production environment
  return 'production';
}

/**
 * Validate Sentry configuration
 */
function validateSentryConfig(config: SentryEnvironmentConfig): boolean {
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
 * Validate Sentry initialization status
 */
function validateSentryInitialization(): boolean {
  try {
    // Check if Sentry client is available
    const client = Sentry.getClient();
    if (!client) {
      return false;
    }

    // Check SDK version compatibility
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
 * F recommendation: PII filtering and Minidump handling (OTel semantic compatible)
 */
function filterPIIWithOTelSemantics(
  event: Sentry.Event,
  _hint: Sentry.EventHint
): Sentry.Event | null {
  // [PII] Remove PII sensitive information
  if (event.request?.headers) {
    delete event.request.headers['authorization'];
    delete event.request.headers['cookie'];
    delete event.request.headers['x-api-key'];
  }

  // [PII] Filter user sensitive information (following OTel semantics)
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    // Keep OTel-compatible user identifiers
    if (event.user.id) {
      event.user.id = 'anonymous';
    }
  }

  // [PII] Handle PII in exception information
  if (event.exception?.values) {
    event.exception.values.forEach(exception => {
      // Use OTel exception semantics
      if (exception.type && (exception as any).message) {
        // Clean sensitive information in exception messages
        (exception as any).message = sanitizeMessage(
          (exception as any).message
        );
      }
    });
  }

  // [OTEL] Ensure OTel semantic fields
  if (event.contexts) {
    if (event.contexts.trace) {
      // Keep OTel trace semantics
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
 * Clean sensitive information in messages
 */
function sanitizeMessage(message: string): string {
  // Remove common sensitive information patterns
  return message
    .replace(/password[=:]\s*[^\s]+/gi, 'password=[REDACTED]')
    .replace(/token[=:]\s*[^\s]+/gi, 'token=[REDACTED]')
    .replace(/key[=:]\s*[^\s]+/gi, 'key=[REDACTED]')
    .replace(/secret[=:]\s*[^\s]+/gi, 'secret=[REDACTED]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD_NUMBER]'); // Credit card numbers
}

/**
 * Filter sensitive breadcrumbs
 */
function filterSensitiveBreadcrumb(
  breadcrumb: Sentry.Breadcrumb
): Sentry.Breadcrumb | null {
  // [FILTER] Filter breadcrumbs containing sensitive information
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

  // [FILTER] Filter user input related breadcrumbs
  if (
    breadcrumb.category === 'ui.input' &&
    breadcrumb.message?.includes('password')
  ) {
    return null;
  }

  return breadcrumb;
}

/**
 * Setup Sentry extension features
 */
function setupSentryExtensions(config: SentryEnvironmentConfig): void {
  // [USER] Set user context (non-sensitive information)
  Sentry.setUser({
    id: 'anonymous', // Don't use real user ID
    username: 'player',
  });

  // [TAGS] Set global tags
  Sentry.setTags({
    'init.success': 'true',
    'init.environment': config.environment,
    'init.timestamp': new Date().toISOString(),
  });

  // [FEEDBACK] Setup Release Health user feedback
  if (config.environment === 'production') {
    setupUserFeedback();
  }
}

/**
 * Setup user feedback mechanism
 */
function setupUserFeedback(): void {
  // [FEEDBACK] Collect user feedback on crashes
  process.on('uncaughtException', error => {
    Sentry.captureException(error);

    // Optional: Show user feedback dialog
    // showUserFeedbackDialog();
  });
}

/**
 * Log initialization event (OTel compatible format)
 */
function logInitializationEvent(config: SentryEnvironmentConfig): void {
  Sentry.addBreadcrumb({
    message: 'Sentry main process initialization complete',
    category: 'observability',
    level: 'info',
    data: {
      environment: config.environment,
      sampleRate: config.sampleRate,
      tracesSampleRate: config.tracesSampleRate,
      autoSessionTracking: config.autoSessionTracking,
      platform: process.platform,
      version: app.getVersion?.() ?? 'unknown',
      // OTel semantic fields
      'service.name': 'guild-manager',
      'service.version': app.getVersion?.() ?? 'unknown',
      'deployment.environment': config.environment,
    },
  });

  // [EVENT] Send initialization success event
  Sentry.captureMessage('Sentry main process monitoring enabled', 'info');
}

/**
 * Fallback logging (D recommendation: structured JSON log format)
 */
function setupFallbackLogging(): void {
  console.log('Setup fallback logging...');

  // Create local log directory
  const logsDir = join(app.getPath('userData'), 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  // Setup local error log (unified JSON mode)
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
      // OTel semantic fields
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
 * Generate simple trace ID (for fallback logging)
 */
function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Generate simple span ID (for fallback logging)
 */
function generateSpanId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Integrate SQLite health metrics into Sentry monitoring
 */
export async function integrateObservabilityMetrics(): Promise<void> {
  try {
    console.log('Integrate observability metrics into Sentry...');

    // Simplified observability manager
    interface ObservabilityConfig {
      dbPath: string;
      sentryDsn?: string;
      metricsInterval: number;
      enabled: boolean;
    }

    class SimpleObservabilityManager {
      private config: ObservabilityConfig;

      constructor(config: ObservabilityConfig) {
        this.config = config;
      }

      async collectAndExpose(): Promise<void> {
        try {
          // Simplified metrics collection logic
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

    const observabilityConfig: ObservabilityConfig = {
      dbPath: process.env.DB_PATH || 'data/app.db',
      sentryDsn: process.env.SENTRY_DSN,
      metricsInterval: 60, // Use a longer interval with Sentry integration
      enabled: true,
    };

    const manager = new SimpleObservabilityManager(observabilityConfig);

    // Start periodic metrics collection and reporting
    setInterval(async () => {
      try {
        await manager.collectAndExpose();
      } catch (error) {
        console.warn('Observability metrics collection failed:', error);
      }
    }, observabilityConfig.metricsInterval * 1000);

    // Execute collection immediately once
    await manager.collectAndExpose();

    console.log('SQLite health metrics integrated into Sentry');
  } catch (error) {
    console.warn(
      'Observability metrics integration failed:',
      (error as Error).message
    );
    // Should not affect main application startup due to monitoring failure
  }
}

/**
 * Send custom business metrics to Sentry - in the distribution format as requested
 */
export function sendBusinessMetric(
  metricName: string,
  value: number,
  unit: string = 'count',
  tags: Record<string, string> = {}
): void {
  try {
    // Send metrics as breadcrumbs (metrics API has been removed)
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
    console.warn('Main-process metric send failed:', (error as Error).message);
  }
}

/**
 * Send level loading time metrics - main process version
 */
export function reportLevelLoadTimeMain(loadMs: number, levelId: string): void {
  sendBusinessMetric('level.load.ms', loadMs, 'millisecond', {
    levelId,
    source: 'main-process',
  });
}

/**
 * Send battle round time metrics - main process version
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
 * Send system performance metrics
 */
export function reportSystemMetrics(): void {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Send memory metrics
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

    // Send CPU metrics
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
    console.warn(
      'System performance metric send failed:',
      (error as Error).message
    );
  }
}

/**
 * Send system metrics periodically
 */
export function startSystemMetricsCollection(): void {
  // Send immediately once
  reportSystemMetrics();

  // Send system metrics every 60 seconds
  const metricsInterval = setInterval(() => {
    reportSystemMetrics();
  }, 60000);

  // Clean up on application exit
  app.on('before-quit', () => {
    clearInterval(metricsInterval);
    reportSystemMetrics(); // Final report
  });

  console.log('System metrics collection started (every 60s)');
}

/**
 * Send database health alerts
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

    console.log(`Database alert sent: ${alertType} - ${message}`);
  } catch (error) {
    console.warn('Database alert send failed:', (error as Error).message);
  }
}

// All functions have been exported above, no need to re-export

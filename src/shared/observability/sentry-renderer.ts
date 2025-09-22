import * as Sentry from '@sentry/electron/renderer';

// Read Vite env safely in renderer (fallback to process.env)
const VITE_ENV: Record<string, any> =
  (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

declare global {
  interface Window {
    __APP_VERSION__?: string;
  }
}

// Renderer Sentry config (environment-scoped)
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
    dsn: (VITE_ENV.VITE_SENTRY_DSN as string) || process.env.SENTRY_DSN || '',
    environment: 'production',
    sampleRate: 1.0,
    tracesSampleRate:
      Number(VITE_ENV.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.02') || 0,
    autoSessionTracking: true,
    enableTracing: true,
    release: window.__APP_VERSION__,
    dist: 'renderer-prod',
  },

  staging: {
    dsn:
      (VITE_ENV.VITE_SENTRY_DSN_STAGING as string) ||
      (VITE_ENV.VITE_SENTRY_DSN as string) ||
      process.env.SENTRY_DSN_STAGING ||
      process.env.SENTRY_DSN ||
      '',
    environment: 'staging',
    sampleRate: 1.0,
    tracesSampleRate:
      Number(VITE_ENV.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.05') || 0.05,
    autoSessionTracking: true,
    enableTracing: true,
    release: window.__APP_VERSION__,
    dist: 'renderer-staging',
  },

  development: {
    // Keep disabled by default in development
    dsn:
      (VITE_ENV.VITE_SENTRY_DSN_DEV as string) ||
      (VITE_ENV.MODE === 'development'
        ? ''
        : (VITE_ENV.VITE_SENTRY_DSN as string) || ''),
    environment: 'development',
    sampleRate: 1.0,
    tracesSampleRate: 1.0,
    autoSessionTracking: true,
    enableTracing: true,
    release: window.__APP_VERSION__,
    dist: 'renderer-dev',
  },
};

/**
 * Initialize Sentry for renderer process (production-focused).
 * Supports dynamic sampling and auto session tracking (Release Health).
 */
export function initSentryRenderer(): Promise<boolean> {
  return new Promise(resolve => {
    try {
      // Resolve environment
      const environment = determineEnvironment();
      const config = RENDERER_SENTRY_CONFIGS[environment];

      if (!validateRendererConfig(config)) {
        console.warn('Sentry renderer config invalid; skip initialization');
        resolve(false);
        return;
      }

      console.log(`Initialize Sentry (renderer) [${environment}]`);

      // Sentry init
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        dist: config.dist,

        // Sampling
        sampleRate: config.sampleRate,
        tracesSampleRate: config.tracesSampleRate,
        autoSessionTracking: config.autoSessionTracking,
        enableTracing: config.enableTracing,

        // Renderer-specific tags/contexts
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

        // Integrations
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.httpClientIntegration(),
          Sentry.captureConsoleIntegration(),
        ],

        // Privacy filter
        beforeSend(event, hint) {
          const filteredEvent = filterRendererPII(event, hint);
          return filteredEvent as any;
        },

        beforeBreadcrumb(breadcrumb) {
          return filterRendererBreadcrumb(breadcrumb);
        },
      });

      // Post-init verification
      setTimeout(() => {
        const isInitialized = validateRendererInitialization();
        if (isInitialized) {
          console.log('Sentry renderer initialized');
          setupRendererExtensions(config);
          initializeGameMetrics();
        } else {
          console.error('Sentry renderer initialization verification failed');
        }
        resolve(isInitialized);
      }, 100);
    } catch (error) {
      console.error('Sentry renderer initialization error:', error);
      resolve(false);
    }
  });
}

/** Determine current environment */
function determineEnvironment(): string {
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  // Dev hints
  if (process.env.ELECTRON_IS_DEV) {
    return 'development';
  }

  // Staging hints
  if (process.env.STAGING || window.__APP_VERSION__?.includes('beta')) {
    return 'staging';
  }

  return 'production';
}

/** Validate renderer config */
function validateRendererConfig(config: RendererSentryConfig): boolean {
  if (!config.dsn) {
    console.warn('Renderer Sentry DSN is not provided');
    return false;
  }
  return true;
}

/** Validate renderer initialization */
function validateRendererInitialization(): boolean {
  try {
    const client = Sentry.getClient();
    return !!client && !!client.getOptions().dsn;
  } catch (error) {
    console.error('Renderer Sentry verification error:', error);
    return false;
  }
}

/** PII filter - renderer */
function filterRendererPII(
  event: Sentry.Event,
  hint: Sentry.EventHint
): Sentry.Event | null {
  // Remove sensitive fields from requests
  if (event.request?.data) {
    const data = event.request.data;
    if (typeof data === 'object' && data !== null) {
      delete (data as any).password;
      delete (data as any).token;
      delete (data as any).apiKey;
    }
  }

  // Remove potentially sensitive DOM extras
  if (event.extra) {
    delete event.extra.userInputs;
    delete event.extra.formData;
  }

  return event;
}

/** Breadcrumb filter - renderer */
function filterRendererBreadcrumb(
  breadcrumb: Sentry.Breadcrumb
): Sentry.Breadcrumb | null {
  // Hide sensitive UI input breadcrumbs
  if (
    breadcrumb.category === 'ui.input' &&
    breadcrumb.message?.includes('password')
  ) {
    return null;
  }

  return breadcrumb;
}

/** Setup renderer extensions */
function setupRendererExtensions(config: RendererSentryConfig): void {
  // Set renderer tags
  Sentry.setTags({
    'renderer.init.success': 'true',
    'renderer.config.environment': config.environment,
    'renderer.tracesSampleRate': config.tracesSampleRate.toString(),
  });

  // Add init breadcrumb
  Sentry.addBreadcrumb({
    message: 'Sentry renderer monitoring initialized',
    category: 'observability.renderer',
    level: 'info',
    data: {
      environment: config.environment,
      tracesSampleRate: config.tracesSampleRate,
      autoSessionTracking: config.autoSessionTracking,
    },
  });
}

/** Initialize game metrics (renderer) */
function initializeGameMetrics(): void {
  console.log('Initialize game metrics (renderer)');

  // Delay game metrics to avoid impacting first paint
  setTimeout(async () => {
    try {
      const { GameMetricsManager } = await import('./game-metrics');
      const metricsManager = GameMetricsManager.getInstance();
      metricsManager.initialize();
    } catch (error) {
      console.warn('Game metrics initialization failed:', error);
    }
  }, 1000);
}

/** Send custom game metric (renderer) */
export function sendGameMetric(
  metricName: string,
  value: number,
  tags: Record<string, string> = {}
): void {
  try {
    // Use breadcrumb for lightweight metrics
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

    console.log(`game metric sent: ${metricName}=${value}`, tags);
  } catch (error) {
    console.warn('sendGameMetric failed:', (error as any)?.message || error);
  }
}

// React integration placeholder (kept for future route tracing)
import React from 'react';


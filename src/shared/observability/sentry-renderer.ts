import * as Sentry from '@sentry/electron/renderer';

declare global {
  interface Window {
    __APP_VERSION__?: string;
  }
}

export function initSentryRenderer() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    release: window.__APP_VERSION__,
    environment: process.env.NODE_ENV || 'development',
    autoSessionTracking: true,
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
  });
}

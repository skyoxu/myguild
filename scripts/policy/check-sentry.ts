import * as Sentry from '@sentry/electron/main';
import { initSentryMain } from '../../src/shared/observability/sentry-main';

initSentryMain();

const isInit =
  typeof (Sentry as any).isInitialized === 'function'
    ? (Sentry as any).isInitialized?.()
    : (Sentry as any).getCurrentHub?.().getClient?.() != null;

if (!isInit) {
  console.error('Sentry 未初始化');
  process.exit(1);
} else {
  console.log('Sentry 初始化成功（最小门禁通过）');
}

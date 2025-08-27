import { describe, it, expect } from 'vitest';
import * as Sentry from '@sentry/electron/main';
import { initSentryMain } from '../../src/shared/observability/sentry-main';

describe('03 Sentry 初始化', () => {
  it('应成功初始化并可被检测到', async () => {
    initSentryMain();
    const isInit =
      typeof (Sentry as any).isInitialized === 'function'
        ? (Sentry as any).isInitialized?.()
        : (Sentry as any).getCurrentHub?.().getClient?.() != null;
    expect(isInit).toBe(true);
  });
});

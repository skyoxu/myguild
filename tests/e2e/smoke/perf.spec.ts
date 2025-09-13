/**
 * Perf smoke (minimal) — Electron + Playwright
 * Focus: basic app boot and interaction P95 with stable sampling.
 */
import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp } from '../../helpers/launch';
import { PerformanceTestUtils } from '../../utils/PerformanceTestUtils';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  electronApp = await launchApp();
  page = await electronApp.firstWindow();
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('@smoke Perf Smoke Suite', () => {
  test('@smoke App renders', async () => {
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 5000 });
    expect(
      await page.locator('[data-testid="app-root"]').count()
    ).toBeGreaterThan(0);
  });

  test('@smoke Interaction P95', async () => {
    const env = (
      process.env.SENTRY_ENVIRONMENT ||
      process.env.NODE_ENV ||
      'dev'
    ).toLowerCase();
    const threshold = env.includes('prod')
      ? 100
      : env.includes('stag')
        ? 150
        : 200;

    await page.waitForSelector('[data-testid="app-root"]');
    await page.bringToFront();

    // Ensure perf harness is present without re-navigation (avoid custom protocol reload flakiness)
    await page.evaluate(
      () =>
        new Promise(resolve =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(null))
          )
        )
    );
    // Wait perf harness to mount (lazy-loaded component)
    await page
      .waitForSelector('[data-testid="perf-harness"]', { timeout: 10000 })
      .catch(() => {});

    const testButton = page.locator('[data-testid="test-button"]').first();
    // Ensure present & visible before interaction; dump diagnostics if missing
    try {
      await testButton.waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      const ids = await page
        .$$eval('[data-testid]', els =>
          els.map(e => (e as HTMLElement).getAttribute('data-testid'))
        )
        .catch(() => [] as any);
      console.log('Diagnostics: available [data-testid] values =>', ids);
      throw new Error('test-button not visible for interaction');
    }
    if ((await testButton.count()) > 0) {
      // warm-up
      for (let i = 0; i < 5; i++) {
        await page.evaluate(
          () =>
            new Promise(resolve =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve(null))
              )
            )
        );
        await testButton.click({ force: true });
        await page.waitForSelector('[data-testid="response-indicator"]', {
          timeout: threshold,
        });
        await page.waitForSelector('[data-testid="response-indicator"]', {
          state: 'detached',
          timeout: 1000,
        });
      }
      await PerformanceTestUtils.runInteractionP95Test(
        async () => {
          await page.evaluate(
            () =>
              new Promise(resolve =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve(null))
                )
              )
          );
          const t0 = Date.now();
          await testButton.click({ force: true });
          await page.waitForSelector('[data-testid="response-indicator"]', {
            timeout: threshold,
          });
          const latency = Date.now() - t0;
          await page.waitForSelector('[data-testid="response-indicator"]', {
            state: 'detached',
            timeout: 1000,
          });
          return latency;
        },
        threshold,
        30
      );
    } else {
      const ids = await page.$$eval('[data-testid]', els =>
        els.map(e => (e as HTMLElement).getAttribute('data-testid'))
      );
      console.log('Available data-testids:', ids);
      throw new Error('No test button found after attempting to start game');
    }
  });
});

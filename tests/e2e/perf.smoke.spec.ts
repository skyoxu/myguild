/**
 * Perf smoke (minimal) — Electron + Playwright
 * Focus: basic app boot and interaction P95 with stable sampling.
 */
import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp } from '../helpers/launch';
import { DEFAULT_LATENCY_BUDGET } from '../../src/shared/contracts/perf';
import { PerformanceTestUtils } from '../utils/PerformanceTestUtils';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  const { app, page: launchedPage } = await launchApp();
  electronApp = app;
  page = launchedPage;
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
    await page.evaluate(
      () =>
        new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    );

    const testButton = page.locator('[data-testid="test-button"]').first();
    if ((await testButton.count()) > 0) {
      // warm-up
      for (let i = 0; i < 5; i++) {
        await page.evaluate(
          () =>
            new Promise(r =>
              requestAnimationFrame(() => requestAnimationFrame(r))
            )
        );
        await testButton.click();
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
              new Promise(r =>
                requestAnimationFrame(() => requestAnimationFrame(r))
              )
          );
          const t0 = Date.now();
          await testButton.click();
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
      console.log('No test button found, skip interaction test');
    }
  });
});

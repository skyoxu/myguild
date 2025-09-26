/**
 * Perf smoke (minimal) - Electron + Playwright
 * Focus: basic app boot and interaction P95 with stable sampling.
 */
import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp, prepareWindowForInteraction } from '../../helpers/launch';
import { PerformanceTestUtils } from '../../utils/PerformanceTestUtils';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  const { app, page: p } = await launchApp();
  electronApp = app;
  page = p;

  // Wait for page to load and prepare for interaction
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });

  // Validate custom protocol and no chrome-error
  const url = page.url();
  expect(url.startsWith('app://')).toBeTruthy();
  expect(url.startsWith('chrome-error://')).toBeFalsy();
  console.log(`[perf] URL verified: ${url}`);

  await prepareWindowForInteraction(page);
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
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

    // Ensure perf harness is present without re-navigation
    await page.evaluate(
      () =>
        new Promise(resolve =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(null))
          )
        )
    );
    // PR often runs with auto-start=1; harness may mount after game auto-starts
    await page
      .waitForSelector('[data-testid="perf-harness"]', { timeout: 30000 })
      .catch(async () => {
        const ids = await page
          .$$eval('[data-testid]', els =>
            els.map(e => (e as HTMLElement).getAttribute('data-testid'))
          )
          .catch(() => [] as any);
        console.log(
          'Diagnostics: perf-harness not found initially; [data-testid] =>',
          ids
        );
      });

    // Prefer perf harness test-button; if absent, try single start-game click then retry
    let testButton = page.locator('[data-testid="test-button"]').first();
    let hasTestButton = (await testButton.count()) > 0;

    if (!hasTestButton) {
      const startGame = page.locator('[data-testid="start-game"]').first();
      const hasStartGame = (await startGame.count()) > 0;
      if (hasStartGame) {
        await startGame.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(200);
        await page
          .waitForSelector('[data-testid="perf-harness"]', { timeout: 15000 })
          .catch(() => {});
        testButton = page.locator('[data-testid="test-button"]').first();
        hasTestButton = (await testButton.count()) > 0;
      }
    }

    // Fail fast with diagnostics if no test-button
    if (!hasTestButton) {
      const ids = await page
        .$$eval('[data-testid]', els =>
          els.map(e => (e as HTMLElement).getAttribute('data-testid'))
        )
        .catch(() => [] as any);
      console.log('Diagnostics: available [data-testid] =>', ids);
      throw new Error(
        'test-button (perf-harness) not available for interaction'
      );
    }

    await testButton.waitFor({ state: 'visible', timeout: 15000 });

    // Warm-up: always use test-button; tolerate missing response-indicator
    for (let i = 0; i < 3; i++) {
      await page.evaluate(
        () =>
          new Promise(resolve =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve(null))
            )
          )
      );
      await testButton.click({ force: true });
      await page
        .waitForSelector('[data-testid="response-indicator"]', {
          timeout: threshold,
        })
        .catch(() => {});
      await page
        .waitForSelector('[data-testid="response-indicator"]', {
          state: 'detached',
          timeout: 1000,
        })
        .catch(() => {});
    }

    const sampleCount = Number(
      process.env.PERF_SAMPLE_COUNT ||
        (process.env.PERF_GATE_MODE === 'soft' ? '10' : '30')
    );
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
        await page
          .waitForSelector('[data-testid="response-indicator"]', {
            timeout: threshold,
          })
          .catch(() => {});
        const latency = Date.now() - t0;
        await page
          .waitForSelector('[data-testid="response-indicator"]', {
            state: 'detached',
            timeout: 1000,
          })
          .catch(() => {});
        return latency;
      },
      threshold,
      sampleCount
    );
  });
});

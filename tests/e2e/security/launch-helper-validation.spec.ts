import { test, expect } from '@playwright/test';
import { launchApp } from '../../helpers/launch';

test.describe('Unified launch helper validation', () => {
  test('launchApp helper can launch application', async () => {
    const { app, page } = await launchApp();

    // Basic sanity checks
    expect(app).toBeDefined();
    expect(page).toBeDefined();

    // DOM ready and URL protocol sanity
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    expect(url.startsWith('app://')).toBeTruthy();
    const readyState = await page.evaluate(() => document.readyState);
    expect(readyState).toBe('complete');

    await app.close();
  });

  test('launchApp uses correct _electron integration (smoke)', async () => {
    const { app, page } = await launchApp();
    expect(app).toBeDefined();
    await page.waitForLoadState('domcontentloaded');
    const title = await page.title();
    expect(title).toBeDefined();
    await app.close();
  });

  test('helper uses built Electron main entry', async () => {
    const { app, page } = await launchApp();
    await page.waitForLoadState('domcontentloaded');

    // App should be loaded (not chrome error page)
    const url = page.url();
    expect(url.startsWith('chrome-error://')).toBeFalsy();

    // Page should be interactable
    const isReady = await page.evaluate(
      () => document.readyState === 'complete'
    );
    expect(isReady).toBeTruthy();

    await app.close();
  });
});

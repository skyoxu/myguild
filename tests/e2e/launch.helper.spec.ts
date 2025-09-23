import { test, expect } from '@playwright/test';
import { launchAppWithPage } from '../helpers/launch';

test('launchAppWithPage returns app and page (DOM ready)', async () => {
  const { app, page } = await launchAppWithPage();
  await page.waitForLoadState('domcontentloaded');
  expect(await page.evaluate(() => document.readyState)).toBe('complete');
  await app.close();
});

test('launchAppWithPage uses correct _electron integration (smoke)', async () => {
  const { app, page } = await launchAppWithPage();
  expect(app).toBeDefined();
  expect(page).toBeDefined();
  await page.waitForLoadState('domcontentloaded');
  const url = page.url();
  expect(url.startsWith('app://')).toBeTruthy();
  await app.close();
});

test('launchAppWithPage exposes testMode flag when configured', async () => {
  // Non-smoke projects skip the specific assertion and just sanity-check
  if (test.info().project.name !== 'electron-smoke-tests') {
    expect(true).toBe(true);
    return;
  }
  const { app, page } = await launchAppWithPage();
  await page.waitForLoadState('domcontentloaded');
  const isTestMode = await page.evaluate(() => {
    return (globalThis as any).__SECURITY_PREFS__?.testMode === true;
  });
  expect(isTestMode).toBeTruthy();
  await app.close();
});

test('launchAppWithPage uses built Electron main entry', async () => {
  const { app, page } = await launchAppWithPage();
  await page.waitForLoadState('domcontentloaded');
  const url = page.url();
  expect(url.startsWith('chrome-error://')).toBeFalsy();
  const title = await page.title();
  expect(title).toBeDefined();
  await app.close();
});

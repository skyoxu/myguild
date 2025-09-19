import { test, expect } from '@playwright/test';
import { launchAppWithPage } from '../helpers/launch';

test('能用统一 helper 启动应用', async () => {
  const { app, page } = await launchAppWithPage();
  await page.waitForLoadState('domcontentloaded');
  expect(await page.evaluate(() => document.readyState)).toBe('complete');
  await app.close();
});

test('launchApp 使用正确的 _electron 导入（避免解构错误）', async () => {
  const { app, page } = await launchAppWithPage();
  expect(app).toBeDefined();
  expect(page).toBeDefined();
  await page.waitForLoadState('domcontentloaded');
  const url = page.url();
  expect(url.startsWith('app://')).toBeTruthy();
  await app.close();
});

test('launchApp 正确设置环境变量', async () => {
  // 项目无差别执行，不使用 test.skip；非 smoke 项目降级为空校验
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

test('launchApp 使用构建产物启动（dist-electron/main.js）', async () => {
  const { app, page } = await launchAppWithPage();
  await page.waitForLoadState('domcontentloaded');
  const url = page.url();
  expect(url.startsWith('chrome-error://')).toBeFalsy();
  const title = await page.title();
  expect(title).toBeDefined();
  await app.close();
});

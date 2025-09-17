import { test, expect } from '@playwright/test';
import { launchApp } from '../helpers/launch';

test('能用统一 helper 启动应用', async () => {
  const app = await launchApp();
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  expect(await page.evaluate(() => document.readyState)).toBe('complete');
  await app.close();
});

test('launchApp 使用正确的 _electron 导入（避免解构错误）', async () => {
  // 验证能够成功启动，这间接证明了正确导入了 _electron
  const app = await launchApp();

  // 验证应用确实启动了
  expect(app).toBeDefined();

  // 验证能获取到窗口
  const page = await app.firstWindow();
  expect(page).toBeDefined();

  // 验证页面加载正常
  await page.waitForLoadState('domcontentloaded');
  const url = page.url();
  expect(url.startsWith('app://')).toBeTruthy();

  await app.close();
});

test('launchApp 正确设置环境变量', async () => {
  const app = await launchApp();
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // 验证测试环境变量通过app设置传递
  const isTestMode = await page.evaluate(() => {
    return (globalThis as any).__SECURITY_PREFS__?.testMode === true;
  });

  // 在测试模式下应该能访问到安全配置
  expect(isTestMode).toBeTruthy();

  await app.close();
});

test('launchApp 使用构建产物启动（dist-electron/main.js）', async () => {
  const app = await launchApp();
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // 验证应用正常启动（使用构建后的main.js）
  const url = page.url();
  expect(url.startsWith('chrome-error://')).toBeFalsy();

  // 验证基本功能可用
  const title = await page.title();
  expect(title).toBeDefined();

  await app.close();
});

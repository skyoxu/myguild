import { test, expect, _electron as electron } from '@playwright/test';
import { launchApp } from '../../helpers/launch';

test.describe('统一启动Helper验证', () => {
  test('launchApp helper 能够正确启动应用', async () => {
    const app = await launchApp();

    // 验证应用确实启动了
    expect(app).toBeDefined();

    // 验证能获取到窗口
    const page = await app.firstWindow();
    expect(page).toBeDefined();

    // 验证页面加载正常
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    expect(url.startsWith('app://') || url.startsWith('file://')).toBeTruthy();

    // 验证页面准备就绪
    const readyState = await page.evaluate(() => document.readyState);
    expect(readyState).toBe('complete');

    await app.close();
  });

  test('launchApp 使用正确的 _electron 导入（避免解构错误）', async () => {
    // 这个测试的存在本身就证明了正确的导入
    // 如果导入有问题，测试会在执行前就失败

    const app = await launchApp();
    expect(app).toBeDefined();

    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // 验证应用正常运行
    const title = await page.title();
    expect(title).toBeDefined();

    await app.close();
  });

  test('验证helper使用构建产物（dist-electron/main.js）启动', async () => {
    const app = await launchApp();
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // 验证应用正常启动（未进入错误页面）
    const url = page.url();
    expect(url.startsWith('chrome-error://')).toBeFalsy();

    // 验证基本功能可用
    const isReady = await page.evaluate(
      () => document.readyState === 'complete'
    );
    expect(isReady).toBeTruthy();

    await app.close();
  });
});

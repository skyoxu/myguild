import { test, expect, _electron as electron } from '@playwright/test';

test('外部导航阻止 - 不应落到 chrome-error', async () => {
  const app = await electron.launch({ args: ['dist-electron/main.js'] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // 触发外部跳转
  await page.evaluate(() => (window.location.href = 'https://example.com'));

  // 等待导航处理完成
  await page.waitForTimeout(1000);

  // 仍停留在 app:// 协议；也不应是 chrome-error
  const url = page.url();
  expect(url.startsWith('app://')).toBeTruthy();
  expect(url.startsWith('chrome-error://')).toBeFalsy();

  await app.close();
});

test('外部弹窗阻止 - window.open应被拦截', async () => {
  const app = await electron.launch({ args: ['dist-electron/main.js'] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // 记录初始窗口数量
  const initialWindows = await app.windows();
  const initialWindowCount = initialWindows.length;

  // 尝试打开外部弹窗
  await page.evaluate(() => {
    window.open('https://example.com', '_blank');
  });

  // 等待处理完成
  await page.waitForTimeout(500);

  // 窗口数量不应增加（弹窗被阻止）
  const currentWindows = await app.windows();
  expect(currentWindows.length).toBe(initialWindowCount);

  await app.close();
});

test('内部导航允许 - app协议应正常工作', async () => {
  const app = await electron.launch({ args: ['dist-electron/main.js'] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // 记录初始URL
  const initialUrl = page.url();
  expect(initialUrl.startsWith('app://')).toBeTruthy();

  // 内部导航到自身应该被允许
  await page.evaluate(() => {
    window.location.href = 'app://index.html';
  });

  await page.waitForTimeout(500);

  // 确认仍在app协议
  const finalUrl = page.url();
  expect(finalUrl.startsWith('app://')).toBeTruthy();
  expect(finalUrl.startsWith('chrome-error://')).toBeFalsy();

  await app.close();
});

import { test, expect, _electron as electron } from '@playwright/test';
import { testLocationNavigation, testWindowOpen } from '../../helpers/launch';

test('外部导航阻止 - 不应落到 chrome-error', async () => {
  const { app, page } = await import('../../helpers/launch').then(m =>
    m.launchApp()
  );
  await page.waitForLoadState('domcontentloaded');

  // 使用统一Helper触发外部跳转并验证被阻止
  const navigationBlocked = await testLocationNavigation(
    page,
    'https://example.com'
  );
  expect(navigationBlocked).toBeTruthy();

  // 仍停留在 app:// 协议；也不应是 chrome-error
  const url = page.url();
  expect(url.startsWith('app://')).toBeTruthy();
  expect(url.startsWith('chrome-error://')).toBeFalsy();

  await app.close();
});

test('外部弹窗阻止 - window.open应被拦截', async () => {
  const { app, page } = await import('../../helpers/launch').then(m =>
    m.launchApp()
  );
  await page.waitForLoadState('domcontentloaded');

  // 记录初始窗口数量
  const initialWindows = await app.windows();
  const initialWindowCount = initialWindows.length;

  // 使用统一Helper尝试打开外部弹窗
  const popupBlocked = await testWindowOpen(page, 'https://example.com');
  expect(popupBlocked).toBeTruthy();

  // 窗口数量不应增加（弹窗被阻止）
  const currentWindows = await app.windows();
  expect(currentWindows.length).toBe(initialWindowCount);

  await app.close();
});

test('内部导航允许 - app协议应正常工作', async () => {
  const { app, page } = await import('../../helpers/launch').then(m =>
    m.launchApp()
  );
  await page.waitForLoadState('domcontentloaded');

  // 记录初始URL
  const initialUrl = page.url();
  expect(initialUrl.startsWith('app://')).toBeTruthy();

  // 内部导航到自身应该被允许（这是期望的行为，所以不使用testLocationNavigation）
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

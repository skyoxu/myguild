import { test, expect } from '@playwright/test';
import { launchApp } from '../../helpers/launch';

test('ADR-0002: defaultSession 仅在 ready 后访问，且首窗可打开', async () => {
  const app = await launchApp();

  const ok = await app.evaluate(async ({ app, session }) => {
    return app.isReady() && !!session.defaultSession;
  });
  expect(ok).toBe(true);

  const win = await app.firstWindow();
  await expect(win).toBeTruthy();

  // 校验 CSP 头是否注入（navigate 到 app:// 后取响应头，按你的加载方式适配）
  // 这里给出占位断言，可改为在渲染里读取 <meta http-equiv="Content-Security-Policy"> 或抓响应头
  await app.close();
});

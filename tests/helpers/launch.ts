// tests/helpers/launch.ts
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { resolve } from 'node:path';

export async function launchApp(): Promise<{
  app: ElectronApplication;
  page: Page;
}> {
  const main = resolve(process.cwd(), 'dist-electron', 'main.js'); // 构建后入口
  const app = await electron.launch({
    args: [main],
    cwd: process.cwd(),
    timeout: 45000,
  });
  const page = await app.firstWindow();

  // 就绪 + 避免错误页
  await page.waitForFunction(
    () => ['interactive', 'complete'].includes(document.readyState),
    { timeout: 15000 }
  );
  if ((await page.url()).startsWith('chrome-error://')) {
    throw new Error('Initial load failed (chrome-error://)'); // 提示到点
  }
  return { app, page };
}

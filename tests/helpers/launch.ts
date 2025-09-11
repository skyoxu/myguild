// tests/helpers/launch.ts
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { resolve } from 'node:path';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * 启动Electron应用程序 - 统一化测试启动函数
 * 符合cifix1.txt要求，使用构建产物而非源文件
 * @param entry 可选的入口文件路径，默认使用 dist-electron/main.js
 */
export async function launchApp(entry?: string): Promise<ElectronApplication> {
  const main = entry ?? resolve(process.cwd(), 'dist-electron', 'main.js');
  return electron.launch({
    args: [main],
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
    },
  });
}

/**
 * 启动Electron应用程序（支持额外参数） - 扩展版本
 * @param entryOrArgs 入口文件路径或额外参数数组
 * @param extraArgs 当第一个参数是entry时的额外参数
 */
export async function launchAppWithArgs(
  entryOrArgs?: string | string[],
  extraArgs?: string[]
): Promise<ElectronApplication> {
  let main: string;
  let args: string[];

  if (Array.isArray(entryOrArgs)) {
    // 第一个参数是额外参数数组
    main = resolve(process.cwd(), 'dist-electron', 'main.js');
    args = [main, ...entryOrArgs];
  } else {
    // 第一个参数是entry路径
    main = entryOrArgs ?? resolve(process.cwd(), 'dist-electron', 'main.js');
    args = extraArgs ? [main, ...extraArgs] : [main];
  }

  return electron.launch({
    args,
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
    },
  });
}

export async function launchAppWithPage(
  electronOverride?,
  entry?
): Promise<{
  app: ElectronApplication;
  page: Page;
}> {
  const main = entry || resolve(process.cwd(), 'dist-electron', 'main.js'); // 构建后入口
  const app = await (electronOverride || electron).launch({
    args: [main],
    env: { CI: 'true', SECURITY_TEST_MODE: 'true' },
    cwd: process.cwd(),
    timeout: 45000,
  });
  const page = await app.firstWindow();

  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  if (page.url().startsWith('chrome-error://')) {
    await page
      .reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
      .catch(() => {});
  }
  if (page.url().startsWith('chrome-error://')) {
    const fallback = pathToFileURL(
      path.join(process.cwd(), 'dist', 'index.html')
    ).toString();
    await page
      .goto(fallback, { waitUntil: 'domcontentloaded', timeout: 15000 })
      .catch(() => {});
  }
  if (page.url().startsWith('chrome-error://')) {
    throw new Error('Initial load failed (chrome-error://)');
  }
  return { app, page };
}

/**
 * 专为CI环境优化的窗口准备函数
 * 确保窗口完全前置且准备好接收交互，避免后台节流导致的响应延迟
 * @param page Playwright页面对象
 * @returns 准备就绪的页面对象
 */
export async function prepareWindowForInteraction(page: Page): Promise<Page> {
  // 等待页面内容完全加载
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });

  // CI环境专项优化：确保窗口前置和活跃状态
  if (process.env.CI === 'true' || process.env.NODE_ENV === 'test') {
    // 强制窗口前置
    await page.evaluate(() => {
      if (window.electronAPI?.bringToFront) {
        window.electronAPI.bringToFront();
      }
    });

    // 双重 requestAnimationFrame 确保渲染完成
    await page.evaluate(
      () =>
        new Promise(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve(true);
            });
          });
        })
    );

    // 等待150ms让窗口前置完全生效
    await page.waitForTimeout(150);

    console.log('🧪 [CI优化] 窗口交互准备完成');
  }

  return page;
}

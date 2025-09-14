// tests/helpers/launch.ts
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// 默认入口路径常量
const DEFAULT_ENTRY_PATH = resolve(process.cwd(), 'dist-electron', 'main.js');

/**
 * 严格验证Electron入口路径，禁止构建fallback
 * 只接受显式传入的entry参数或ELECTRON_MAIN_PATH环境变量
 */
function validateEntryPath(entry?: string): string {
  const entryPath =
    entry || process.env.ELECTRON_MAIN_PATH || DEFAULT_ENTRY_PATH;

  if (!existsSync(entryPath)) {
    throw new Error(
      `Electron entry point not found at "${entryPath}". ` +
        `Please build the application before running tests (npm run build) ` +
        `or set ELECTRON_MAIN_PATH environment variable to a valid path.`
    );
  }

  console.log(`[launch] using Electron entry: ${entryPath}`);
  return entryPath;
}

export async function launchApp(entry?: string): Promise<ElectronApplication> {
  const main = validateEntryPath(entry);
  return electron.launch({
    args: [main],
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
      E2E_AUTO_START: '1',
      VITE_E2E_SMOKE: 'true', // 运行时环境变量
    },
  });
}

export async function launchAppWithArgs(
  entryOrArgs?: string | string[],
  extraArgs?: string[]
): Promise<ElectronApplication> {
  let args: string[];
  if (Array.isArray(entryOrArgs)) {
    const main = validateEntryPath();
    args = [main, ...entryOrArgs];
  } else {
    const main = validateEntryPath(entryOrArgs);
    args = extraArgs ? [main, ...extraArgs] : [main];
  }
  return electron.launch({
    args,
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
      E2E_AUTO_START: '1',
      VITE_E2E_SMOKE: 'true', // 运行时环境变量
    },
  });
}

export async function launchAppWithPage(
  electronOverride?: typeof electron,
  entry?: string
): Promise<{ app: ElectronApplication; page: Page }> {
  const main = validateEntryPath(entry);
  const app = await (electronOverride || electron).launch({
    args: [main],
    env: {
      CI: 'true',
      SECURITY_TEST_MODE: 'true',
      E2E_AUTO_START: '1',
      VITE_E2E_SMOKE: 'true', // 运行时环境变量
    },
    cwd: process.cwd(),
    timeout: 45000,
  });
  const page = await app.firstWindow();

  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  if (page.url().startsWith('chrome-error://')) {
    console.warn('[launch] chrome-error detected, attempting reload...');
    await page
      .reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
      .catch(() => {});
  }
  if (page.url().startsWith('chrome-error://')) {
    console.warn('[launch] chrome-error persists, trying fallback URL...');
    const fallback = pathToFileURL(
      join(process.cwd(), 'dist', 'index.html')
    ).toString();
    await page
      .goto(fallback, { waitUntil: 'domcontentloaded', timeout: 15000 })
      .catch(() => {});
  }
  if (page.url().startsWith('chrome-error://')) {
    throw new Error(
      'Initial load failed: chrome-error:// persists after all recovery attempts'
    );
  }
  return { app, page };
}

export async function prepareWindowForInteraction(page: Page): Promise<Page> {
  // ✅ 按照ciinfo.md规则：使用document.readyState而不是domcontentloaded
  await page.waitForFunction(() => document.readyState === 'complete', {
    timeout: 15000,
  });

  // ✅ 额外等待React app-root元素渲染完成
  await page.waitForFunction(
    () => {
      const appRoot = document.querySelector('[data-testid="app-root"]');
      return appRoot !== null && appRoot.children.length > 0;
    },
    { timeout: 10000 }
  );

  if (process.env.CI === 'true' || process.env.NODE_ENV === 'test') {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).electronAPI?.bringToFront?.();
    });
    await page.evaluate(
      () =>
        new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    );
    await page.waitForTimeout(150);
    console.log(
      '[CI] window prepared for interaction (using document.readyState)'
    );
  }
  return page;
}

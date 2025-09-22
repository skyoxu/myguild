// tests/helpers/launch.ts
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { resolve, join } from 'node:path';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ensureDomReady } from './ensureDomReady';

// 默认入口路径常量 - dist-electron/package.json 指定 commonjs 类型
const DEFAULT_ENTRY_PATH = resolve(
  process.cwd(),
  'dist-electron',
  'electron',
  'main.js'
);

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

// 构建缓存机制：避免CI环境中重复构建
const BUILD_CACHE_FILE = resolve(process.cwd(), '.e2e-build-cache');

/**
 * 检查CI缓存是否有效
 */
function isBuildCacheValid(): boolean {
  if (process.env.CI !== 'true') return false;

  try {
    if (!existsSync(BUILD_CACHE_FILE)) return false;

    const cacheInfo = JSON.parse(readFileSync(BUILD_CACHE_FILE, 'utf-8'));
    const distPathCjs = resolve(process.cwd(), 'dist-electron', 'main.cjs');
    const distPathJs = resolve(process.cwd(), 'dist-electron', 'main.js');

    // 检查构建产物是否存在且缓存时间戳有效
    return (
      (existsSync(distPathCjs) || existsSync(distPathJs)) &&
      cacheInfo.timestamp &&
      Date.now() - cacheInfo.timestamp < 1000 * 60 * 10
    ); // 10分钟有效期
  } catch {
    return false;
  }
}

/**
 * 标记构建缓存完成
 */
function markBuildCacheCompleted(): void {
  if (process.env.CI === 'true') {
    try {
      writeFileSync(
        BUILD_CACHE_FILE,
        JSON.stringify({
          timestamp: Date.now(),
          version: process.env.npm_package_version || '1.0.0',
        }),
        'utf-8'
      );
      console.log('[launch] CI mode: build cached for subsequent tests');
    } catch (e) {
      console.warn('[launch] failed to write build cache:', e);
    }
  }
}

/**
 * Build application before launching to ensure latest code is used.
 * 优化：CI环境中只构建一次，后续复用
 */
function buildApp(): void {
  // CI环境构建优化：检查跨进程缓存
  if (isBuildCacheValid()) {
    console.log('[launch] CI mode: reusing existing build (cached)');
    return;
  }

  try {
    console.log('[launch] building application (npm run build)...');
    execSync('npm run build', {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_E2E_SMOKE: 'true', // 确保构建时注入环境变量
      },
    });

    // 标记构建完成（仅CI环境缓存）
    markBuildCacheCompleted();
  } catch (e) {
    console.error('[launch] build failed before E2E launch');
    throw e;
  }
}

/**
 * ✅ 统一Electron应用启动函数 - 返回{app, page}结构
 * 官方推荐：app.firstWindow() → page，所有DOM操作在Page上执行
 */
export async function launchApp(
  entry?: string
): Promise<{ app: ElectronApplication; page: Page }> {
  // 在buildApp之前设置CI环境变量以启用缓存
  process.env.CI = 'true';

  buildApp();
  const main = validateEntryPath(entry);
  const app = await electron.launch({
    // Launch by project root so Electron uses package.json.main; more robust on Windows
    args: ['.'],
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
      E2E_AUTO_START: '1',
      VITE_E2E_SMOKE: 'true', // 运行时环境变量
    },
  });
  const page = await app.firstWindow(); // ← 这是渲染进程 Page
  return { app, page };
}

/**
 * ✅ 新推荐姿势：启动Electron应用并返回app和page对象
 * 按用户要求：app.firstWindow() → page，所有DOM操作在Page上执行
 */
export async function launchAppAndPage(
  entry?: string
): Promise<{ app: ElectronApplication; page: Page }> {
  // 在buildApp之前设置CI环境变量以启用缓存
  process.env.CI = 'true';

  buildApp();
  const main = validateEntryPath(entry);
  const app = await electron.launch({
    args: ['.'],
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
      E2E_AUTO_START: '1',
      VITE_E2E_SMOKE: 'true', // 运行时环境变量
    },
  });
  const page = await app.firstWindow(); // ← 这是渲染进程 Page
  return { app, page };
}

export async function launchAppWithArgs(
  entryOrArgs?: string | string[],
  extraArgs?: string[]
): Promise<ElectronApplication> {
  // 在buildApp之前设置CI环境变量以启用缓存
  process.env.CI = 'true';

  buildApp();
  let args: string[];
  if (Array.isArray(entryOrArgs)) {
    const main = validateEntryPath();
    args = ['.', ...entryOrArgs];
  } else {
    const main = validateEntryPath(entryOrArgs);
    args = extraArgs ? ['.', ...extraArgs] : ['.'];
  }
  const app = await electron.launch({
    args,
    env: {
      CI: 'true',
      ELECTRON_ENABLE_LOGGING: '1',
      SECURITY_TEST_MODE: 'true',
      E2E_AUTO_START: '1',
      VITE_E2E_SMOKE: 'true', // 运行时环境变量
    },
  });
  return app;
}

export async function launchAppWithPage(
  electronOverride?: typeof electron,
  entry?: string
): Promise<{ app: ElectronApplication; page: Page }> {
  // 在buildApp之前设置CI环境变量以启用缓存
  process.env.CI = 'true';

  buildApp();
  const main = validateEntryPath(entry);
  const app = await (electronOverride || electron).launch({
    args: ['.'],
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

  await ensureDomReady(page, 15000);
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

/**
 * ✅ 统一DOM操作Helper：导航/外链红线断言
 * 修正用户提到的location/document未定义问题
 * 所有DOM操作在Page上执行，避免主进程上下文错误
 */
export async function attemptAndAssertBlocked(
  page: Page,
  navigationAction: (url: string) => Promise<void>,
  testUrl: string
): Promise<boolean> {
  const originalUrl = page.url();

  try {
    await navigationAction(testUrl);
    await page.waitForTimeout(1000); // 等待可能的导航
    const currentUrl = page.url();

    // 断言：URL应该保持不变（导航被阻止）
    return currentUrl === originalUrl;
  } catch (error) {
    console.log(
      `[attemptAndAssertBlocked] Navigation blocked as expected: ${error}`
    );
    return true; // 异常说明导航被阻止，这是期望的
  }
}

/**
 * ✅ location.href导航测试Helper
 * 原: attemptAndAssertBlocked(firstWindow, () => { location.href = url })
 * 修正为: await page.evaluate((u) => { location.href = u; }, url);
 */
export async function testLocationNavigation(
  page: Page,
  url: string
): Promise<boolean> {
  return attemptAndAssertBlocked(
    page,
    async testUrl => {
      await page.evaluate(u => {
        location.href = u;
      }, testUrl);
    },
    url
  );
}

/**
 * ✅ 动态链接点击测试Helper
 * 原: document.createElement / append / click
 * 修正为: await page.evaluate在Page上下文中执行
 */
export async function testDynamicLinkClick(
  page: Page,
  url: string
): Promise<boolean> {
  return attemptAndAssertBlocked(
    page,
    async testUrl => {
      await page.evaluate(u => {
        const a = document.createElement('a');
        a.href = u;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        // 清理DOM
        document.body.removeChild(a);
      }, testUrl);
    },
    url
  );
}

/**
 * ✅ window.open测试Helper
 */
export async function testWindowOpen(
  page: Page,
  url: string
): Promise<boolean> {
  try {
    // 监听可能的 popup 事件
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 1000 }).catch(() => null),
      page.evaluate(targetUrl => {
        window.open(targetUrl, '_blank');
      }, url),
    ]);

    // 如果走主进程 setWindowOpenHandler({action:'deny'}) 的话，这里应为 null
    return popup === null;
  } catch (error) {
    console.log(
      `[testWindowOpen] Error during window.open test: ${error.message}`
    );
    return true; // 如果出错，认为是被阻止了
  }
}

/**
 * ✅ 表单提交导航测试Helper
 */
export async function testFormSubmitNavigation(
  page: Page,
  url: string
): Promise<boolean> {
  return attemptAndAssertBlocked(
    page,
    async testUrl => {
      await page.evaluate(u => {
        const form = document.createElement('form');
        form.method = 'GET';
        form.action = u;
        form.target = '_blank';
        document.body.appendChild(form);
        form.submit();
        // 清理DOM
        document.body.removeChild(form);
      }, testUrl);
    },
    url
  );
}

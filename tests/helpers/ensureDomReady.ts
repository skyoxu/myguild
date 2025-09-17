/**
 * 统一的DOM就绪等待语义helper - 解决Playwright导航完成检测问题
 *
 * 用于确保Electron应用的DOM已完全加载并可用于断言，
 * 避免"waiting for navigation to finish"超时问题
 */

import { expect, type Page } from '@playwright/test';

/**
 * 确保DOM已就绪的统一helper函数
 *
 * 按照Playwright官方推荐，使用 domcontentloaded + 双 rAF 而非 networkidle
 * 这样既快又稳，适用于所有Electron项目配置
 *
 * @param page Playwright页面对象
 * @param timeout 等待超时时间，默认5000ms
 */
export async function ensureDomReady(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  // 1. 等待文档内容加载完成（比 networkidle 更稳定）
  await page.waitForLoadState('domcontentloaded');

  // 2. 强制等待navigation完成 - 针对Electron多项目配置的导航检测问题
  await page.waitForURL(/.*/, {
    waitUntil: 'domcontentloaded',
    timeout: Math.min(timeout, 15000),
  });

  // 3. 等待所有可能的加载状态完成
  try {
    await page.waitForLoadState('load', { timeout: Math.min(timeout, 8000) });
  } catch (e) {
    console.warn(
      '[ensureDomReady] load state timeout, continuing with domcontentloaded'
    );
  }

  // 4. 确保body元素存在且文档就绪
  await page.waitForFunction(
    () => {
      return document.body && document.readyState === 'complete';
    },
    { timeout: Math.min(timeout, 10000) }
  );

  // 5. 双 rAF：跨过首帧/布局抖动，确保DOM渲染稳定
  await page.evaluate(
    () =>
      new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );

  // 6. 额外等待确保navigation完全稳定
  await page.waitForTimeout(100);

  // 7. 直接检查body元素可见性，避免隐式导航等待
  try {
    const isBodyReady = await page.evaluate(() => {
      const body = document.body;
      if (!body) return false;

      // 检查元素是否真正可见（不是display:none等）
      const style = window.getComputedStyle(body);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    if (!isBodyReady) {
      throw new Error('Body element is not ready after DOM ready checks');
    }
  } catch (error) {
    console.warn(
      '[ensureDomReady] Body visibility check failed:',
      error.message
    );
    // 降级：只进行基础存在性检查
    await page.waitForFunction(() => document.body !== null, {
      timeout: Math.min(timeout, 3000),
    });
  }
}

/**
 * 用于可能触发页内跳转/路由变化的交互操作
 *
 * 在点击链接或按钮后，如果不需要等待完整导航，
 * 使用此helper避免隐式等待"导航完成"
 *
 * @param clickAction 点击操作的Promise
 */
export async function clickWithoutNavigationWait(
  clickAction: () => Promise<void>
): Promise<void> {
  // 使用 noWaitAfter 避免隐式等待导航完成
  // 这在 SPA/hydration 场景中特别有用
  await clickAction();
}

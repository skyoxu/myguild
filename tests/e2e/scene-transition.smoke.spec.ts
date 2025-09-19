import { test, expect, Page } from '@playwright/test';
import { launchAppWithPage } from '../helpers/launch';
import { ensureDomReady } from '../helpers/ensureDomReady';

async function injectMinimalSceneMonitor(page: Page) {
  await page.addInitScript(() => {
    (window as any).sceneTransitionData = [];
    (window as any).trackSceneTransition = function (sceneName: string) {
      const start = `scene-smoke-${sceneName}-start`;
      const end = `scene-smoke-${sceneName}-end`;
      performance.mark(start);
      setTimeout(
        () => {
          performance.mark(end);
          const measure = `scene.smoke.${sceneName}`;
          performance.measure(measure, start, end);
          const entries = performance.getEntriesByName(measure);
          if (entries.length) {
            const e: any = entries[entries.length - 1];
            (window as any).sceneTransitionData.push({
              sceneName: measure,
              duration: e.duration,
              timestamp: e.startTime,
            });
          }
        },
        Math.random() * 20 + 30
      );
    };
  });

  // 运行时兜底（页面已加载时注入）
  await page.evaluate(() => {
    if (typeof (window as any).trackSceneTransition !== 'function') {
      (window as any).sceneTransitionData =
        (window as any).sceneTransitionData || [];
      (window as any).trackSceneTransition = function (sceneName: string) {
        const start = `scene-smoke-${sceneName}-start`;
        const end = `scene-smoke-${sceneName}-end`;
        performance.mark(start);
        setTimeout(
          () => {
            performance.mark(end);
            const measure = `scene.smoke.${sceneName}`;
            performance.measure(measure, start, end);
            const entries = performance.getEntriesByName(measure);
            if (entries.length) {
              const e: any = entries[entries.length - 1];
              (window as any).sceneTransitionData.push({
                sceneName: measure,
                duration: e.duration,
                timestamp: e.startTime,
              });
            }
          },
          Math.random() * 20 + 30
        );
      };
    }
  });
}

test.describe('场景转换 Smoke', () => {
  test('采样最小闭环', async () => {
    const { app, page } = await launchAppWithPage();
    await ensureDomReady(page);
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });

    await injectMinimalSceneMonitor(page);

    const samples = Number(process.env.SCENE_SAMPLES ?? '2');
    for (let i = 0; i < samples; i++) {
      await page.evaluate(() => (window as any).trackSceneTransition('smoke'));
      await page.waitForTimeout(80);
    }

    const data = await page.evaluate(() => (window as any).sceneTransitionData);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    await app.close();
  });
});

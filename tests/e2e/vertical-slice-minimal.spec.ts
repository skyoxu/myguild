import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 竖切测试 - 最小可行版本
 * 专注于验证核心端到端流程，避免类型错误干扰测试执行
 */

test.describe('竖切测试 - 最小版本', () => {
  test('基础应用启动和UI导航', async () => {
    console.log('🚀 启动最小竖切测试...');

    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist-electron/main.js')],
      timeout: 60000,
    });

    const firstWindow = await electronApp.firstWindow({
      timeout: 20000,
    });

    await firstWindow.waitForLoadState('domcontentloaded');

    // 截图记录应用启动状态
    await firstWindow.screenshot({
      path: 'test-results/artifacts/app-startup.png',
      fullPage: true,
    });

    // 验证基础应用标题
    const hasValidTitle = await firstWindow.evaluate(() => {
      return (
        document.title.includes('Phaser') ||
        document.title.includes('React') ||
        document.title.includes('TypeScript') ||
        document.body.textContent?.includes('游戏') ||
        document.body.textContent?.includes('竖切')
      );
    });

    expect(hasValidTitle).toBe(true);
    console.log('✅ 应用启动验证通过');

    // 查找竖切相关UI元素（使用宽泛的选择器）
    const hasVerticalSliceUI = await firstWindow.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(
        btn =>
          btn.textContent?.includes('竖切') ||
          btn.textContent?.includes('测试') ||
          btn.textContent?.includes('🚀')
      );
    });

    if (hasVerticalSliceUI) {
      console.log('✅ 发现竖切UI元素');

      // 尝试点击竖切相关按钮
      const clicked = await firstWindow.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const verticalSliceButton = buttons.find(
          btn =>
            btn.textContent?.includes('竖切') || btn.textContent?.includes('🚀')
        );

        if (verticalSliceButton) {
          verticalSliceButton.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        console.log('✅ 成功点击竖切按钮');
        await firstWindow.waitForTimeout(2000);

        // 截图记录竖切模式
        await firstWindow.screenshot({
          path: 'test-results/artifacts/vertical-slice-mode.png',
          fullPage: true,
        });
      }
    } else {
      console.log('ℹ️ 未找到竖切UI，可能需要手动导航');
    }

    await electronApp.close();
  });

  test('基础存储和数据功能验证', async () => {
    console.log('💾 测试基础存储功能...');

    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist-electron/main.js')],
      timeout: 60000,
    });

    const firstWindow = await electronApp.firstWindow({
      timeout: 20000,
    });

    await firstWindow.waitForLoadState('domcontentloaded');

    // 测试 localStorage 基础功能
    const storageTest = await firstWindow.evaluate(() => {
      try {
        // 写入测试数据
        const testData = {
          testId: Date.now(),
          timestamp: new Date().toISOString(),
          type: 'vertical-slice-test',
        };

        localStorage.setItem('test_vertical_slice', JSON.stringify(testData));

        // 读取验证
        const stored = localStorage.getItem('test_vertical_slice');
        const parsed = stored ? JSON.parse(stored) : null;

        return {
          success: parsed && parsed.type === 'vertical-slice-test',
          data: parsed,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(storageTest.success).toBe(true);
    console.log('✅ localStorage 功能验证通过', storageTest.data);

    await electronApp.close();
  });

  test('性能和内存基础检查', async () => {
    console.log('⏱️ 执行性能基础检查...');

    const startTime = Date.now();

    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist-electron/main.js')],
      timeout: 60000,
    });

    const firstWindow = await electronApp.firstWindow({
      timeout: 20000,
    });

    const launchTime = Date.now() - startTime;

    // 应用启动时间检查
    expect(launchTime).toBeLessThan(15000); // 15秒内启动
    console.log(`应用启动时间: ${launchTime}ms`);

    await firstWindow.waitForLoadState('domcontentloaded');

    // 基础性能指标检查
    const performanceInfo = await firstWindow.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as any;
      return {
        domContentLoaded:
          nav?.domContentLoadedEventEnd - nav?.domContentLoadedEventStart,
        loadComplete: nav?.loadEventEnd - nav?.loadEventStart,
        hasPerformanceAPI: typeof performance !== 'undefined',
        hasMemoryAPI: !!(performance as any).memory,
      };
    });

    expect(performanceInfo.hasPerformanceAPI).toBe(true);
    console.log('✅ 性能API可用', performanceInfo);

    await electronApp.close();
  });
});

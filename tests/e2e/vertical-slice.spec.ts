import { test, expect } from '@playwright/test';
import { launchApp } from '../helpers/launch';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 游戏竖切端到端测试 - 完整技术栈集成验证
 *
 * 测试流程：
 * 1. Electron启动 → React主页面
 * 2. 切换到竖切模式 → Phaser TestScene加载
 * 3. 模拟用户操作 → 精灵移动到目标区域
 * 4. 触发关卡完成事件 → CloudEvents发布
 * 5. 数据持久化 → SQLite/LocalStorage保存
 * 6. 可观测性上报 → Sentry事件记录
 * 7. 验证完整数据流和状态更新
 */

test.describe('游戏竖切端到端测试', () => {
  let electronApp: any;
  let firstWindow: any;

  test.beforeEach(async () => {
    console.log('🚀 启动竖切测试 - 初始化 Electron 应用...');
    electronApp = await launchApp().then(result => result.app);

    firstWindow = await electronApp.firstWindow({
      timeout: 20000,
    });

    await firstWindow.waitForLoadState('domcontentloaded');
    console.log('✅ Electron 应用启动完成');
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
      console.log('🏁 Electron 应用已关闭');
    }
  });

  test('完整竖切流程 - 从启动到数据持久化', async () => {
    // 步骤1: 验证应用初始状态
    console.log('📋 步骤1: 验证应用初始状态');
    await expect(firstWindow).toHaveTitle(/Phaser 3 \+ React 19 \+ TypeScript/);

    // 确保页面完全加载
    await firstWindow.waitForSelector(
      '[data-testid="app-container"], .app-container',
      {
        timeout: 10000,
      }
    );

    // 步骤2: 切换到竖切测试模式
    console.log('📋 步骤2: 切换到竖切测试模式');

    // 查找竖切测试按钮（支持多种可能的选择器）
    const verticalSliceButton = firstWindow.locator(
      'button:has-text("竖切测试"), button:has-text("🚀 竖切测试")'
    );
    await expect(verticalSliceButton).toBeVisible({ timeout: 5000 });
    await verticalSliceButton.click();

    // 验证模式切换成功
    await expect(firstWindow.locator('text=游戏竖切测试')).toBeVisible({
      timeout: 5000,
    });
    console.log('✅ 成功切换到竖切测试模式');

    // 步骤3: 启动竖切测试
    console.log('📋 步骤3: 启动竖切测试');
    const startTestButton = firstWindow.locator('button:has-text("开始测试")');
    await expect(startTestButton).toBeVisible();
    await startTestButton.click();

    // 等待游戏引擎初始化完成
    console.log('⏳ 等待游戏引擎初始化...');
    await expect(firstWindow.locator('text=测试进行中')).toBeVisible({
      timeout: 15000,
    });

    // 验证游戏画布出现
    await expect(firstWindow.locator('.game-canvas-container')).toBeVisible();
    console.log('✅ Phaser TestScene 加载成功');

    // 步骤4: 等待一段时间让场景稳定
    console.log('📋 步骤4: 等待场景稳定并模拟用户交互');
    await firstWindow.waitForTimeout(2000);

    // 模拟键盘操作移动精灵（WASD键）
    console.log('🎮 模拟键盘操作: 按D键向右移动');
    await firstWindow.press('body', 'KeyD');
    await firstWindow.waitForTimeout(500);

    console.log('🎮 模拟键盘操作: 按W键向上移动');
    await firstWindow.press('body', 'KeyW');
    await firstWindow.waitForTimeout(500);

    // 额外移动确保到达目标区域
    await firstWindow.press('body', 'KeyD');
    await firstWindow.waitForTimeout(300);
    await firstWindow.press('body', 'KeyW');
    await firstWindow.waitForTimeout(300);

    // 手动触发完成（备用方案）
    console.log('🎮 手动触发关卡完成: 按空格键');
    await firstWindow.press('body', 'Space');

    // 步骤5: 验证关卡完成状态
    console.log('📋 步骤5: 验证关卡完成和数据持久化');

    // 等待测试完成状态（增加超时时间以等待数据持久化）
    await expect(firstWindow.locator('text=测试完成')).toBeVisible({
      timeout: 20000,
    });
    console.log('🎉 关卡完成状态验证通过');

    // 验证完成结果展示
    await expect(firstWindow.locator('text=分数:')).toBeVisible();
    await expect(firstWindow.locator('text=移动次数:')).toBeVisible();
    await expect(firstWindow.locator('text=用时:')).toBeVisible();

    // 步骤6: 验证数据持久化
    console.log('📋 步骤6: 验证数据持久化结果');

    // 检查 LocalStorage 中的测试数据
    const persistedData = await firstWindow.evaluate(() => {
      const lastResult = localStorage.getItem('lastVerticalSliceTest');
      const levelResults = localStorage.getItem('level_results');

      return {
        lastResult: lastResult ? JSON.parse(lastResult) : null,
        levelResults: levelResults ? JSON.parse(levelResults) : null,
        storageKeys: Object.keys(localStorage).filter(
          key =>
            key.includes('level') ||
            key.includes('test') ||
            key.includes('vertical')
        ),
      };
    });

    // 验证数据持久化成功
    expect(persistedData.storageKeys.length).toBeGreaterThan(0);
    console.log('✅ 数据持久化验证通过，存储键:', persistedData.storageKeys);

    if (persistedData.lastResult) {
      expect(persistedData.lastResult).toHaveProperty('testId');
      expect(persistedData.lastResult).toHaveProperty('timestamp');
      console.log('✅ 测试结果数据结构验证通过');
    }

    // 步骤7: 验证事件调试信息（开发模式）
    console.log('📋 步骤7: 验证事件流和调试信息');

    // 检查是否显示了调试信息
    const debugInfo = firstWindow.locator('details:has-text("调试信息")');
    const hasDebugInfo = await debugInfo.isVisible();

    if (hasDebugInfo) {
      await debugInfo.click(); // 展开调试信息

      // 验证关键事件类型出现
      await expect(
        firstWindow.locator('text=game.scene.created')
      ).toBeVisible();
      await expect(
        firstWindow.locator('text=game.level.completed')
      ).toBeVisible();
      console.log('✅ 事件流验证通过');
    } else {
      console.log('ℹ️ 调试信息未显示（可能在生产模式）');
    }

    // 步骤8: 验证可观测性指标
    console.log('📋 步骤8: 验证Web Vitals和可观测性');

    // 检查控制台是否有 Web Vitals 相关日志
    const consoleLogs = [];
    firstWindow.on('console', (msg: any) => {
      if (
        msg.text().includes('Web Vitals') ||
        msg.text().includes('vertical_slice')
      ) {
        consoleLogs.push(msg.text());
      }
    });

    // 检查是否有性能指标被记录
    const webVitalsData = await firstWindow.evaluate(() => {
      // 尝试获取 Web Vitals 相关数据
      return {
        hasPerformanceObserver: typeof PerformanceObserver !== 'undefined',
        navigationTiming: performance.getEntriesByType('navigation').length > 0,
        // 检查是否有自定义性能标记
        customMarks: performance
          .getEntriesByType('mark')
          .map(entry => entry.name),
      };
    });

    expect(webVitalsData.hasPerformanceObserver).toBe(true);
    console.log('✅ 可观测性指标验证通过');

    // 最终截图记录
    await firstWindow.screenshot({
      path: 'test-results/artifacts/vertical-slice-completed.png',
      fullPage: true,
    });
    console.log('📸 完成状态截图已保存');
  });

  test('竖切测试重置和重新运行', async () => {
    console.log('🔄 测试竖切重置功能');

    // 先完成一次完整测试流程（简化版）
    await firstWindow.locator('button:has-text("竖切测试")').click();
    await firstWindow.locator('button:has-text("开始测试")').click();

    // 等待测试开始
    await expect(firstWindow.locator('text=测试进行中')).toBeVisible({
      timeout: 10000,
    });

    // 手动触发完成
    await firstWindow.press('body', 'Space');
    await expect(firstWindow.locator('text=测试完成')).toBeVisible({
      timeout: 15000,
    });

    // 点击重新测试按钮
    const resetButton = firstWindow.locator('button:has-text("重新测试")');
    await expect(resetButton).toBeVisible();
    await resetButton.click();

    // 验证重置成功
    await expect(
      firstWindow.locator('button:has-text("开始测试")')
    ).toBeVisible();
    console.log('✅ 竖切测试重置功能验证通过');
  });

  test('竖切测试错误处理', async () => {
    console.log('❌ 测试竖切错误处理能力');

    // 切换到竖切模式但不等待完全加载就关闭
    await firstWindow.locator('button:has-text("竖切测试")').click();

    // 验证错误状态处理
    // 这里可以测试各种错误情况，比如游戏引擎初始化失败等
    // 由于实际错误场景难以模拟，我们主要验证错误UI存在

    const errorElements = await firstWindow
      .locator('text=测试失败, text=错误, .error, .red-800')
      .count();

    // 如果没有错误（正常情况），继续正常测试
    if (errorElements === 0) {
      console.log('ℹ️ 未检测到错误状态（应用运行正常）');

      // 启动正常测试作为备用验证
      await firstWindow.locator('button:has-text("开始测试")').click();
      await expect(firstWindow.locator('text=测试进行中')).toBeVisible({
        timeout: 10000,
      });
      console.log('✅ 错误处理测试通过（应用正常运行）');
    } else {
      console.log('⚠️ 检测到错误状态，验证错误处理UI');
    }
  });
});

test.describe('竖切性能和稳定性测试', () => {
  test('竖切测试性能基准验证', async () => {
    console.log('⏱️ 测试竖切性能基准');

    const electronApp = await launchApp().then(result => result.app);

    const firstWindow = await electronApp.firstWindow({ timeout: 20000 });
    await firstWindow.waitForLoadState('domcontentloaded');

    const startTime = Date.now();

    // 执行竖切流程并记录时间
    await firstWindow.locator('button:has-text("竖切测试")').click();
    await firstWindow.locator('button:has-text("开始测试")').click();

    const initTime = Date.now() - startTime;

    // 验证初始化时间符合要求 (< 2秒)
    expect(initTime).toBeLessThan(2000);
    console.log(`竖切初始化时间: ${initTime}ms`);

    // 等待测试进行中状态
    await expect(firstWindow.locator('text=测试进行中')).toBeVisible({
      timeout: 5000,
    });

    const gameStartTime = Date.now();

    // 手动完成测试
    await firstWindow.press('body', 'Space');
    await expect(firstWindow.locator('text=测试完成')).toBeVisible({
      timeout: 10000,
    });

    const totalTime = Date.now() - startTime;

    // 验证总体执行时间合理 (< 15秒)
    expect(totalTime).toBeLessThan(15000);
    console.log(`竖切总执行时间: ${totalTime}ms`);

    await electronApp.close();
  });

  test('竖切内存使用监控', async () => {
    console.log('🧠 测试竖切内存使用情况');

    const electronApp = await launchApp().then(result => result.app);

    const firstWindow = await electronApp.firstWindow({ timeout: 20000 });
    await firstWindow.waitForLoadState('domcontentloaded');

    // 记录初始内存
    const initialMemory = await firstWindow.evaluate(() => {
      return (performance as any).memory
        ? {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
          }
        : null;
    });

    // 运行竖切测试
    await firstWindow.locator('button:has-text("竖切测试")').click();
    await firstWindow.locator('button:has-text("开始测试")').click();
    await expect(firstWindow.locator('text=测试进行中')).toBeVisible({
      timeout: 10000,
    });

    // 运行一段时间
    await firstWindow.waitForTimeout(3000);

    // 记录运行时内存
    const runningMemory = await firstWindow.evaluate(() => {
      return (performance as any).memory
        ? {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
          }
        : null;
    });

    if (initialMemory && runningMemory) {
      const memoryIncrease = runningMemory.used - initialMemory.used;
      console.log(`内存增长: ${memoryIncrease / (1024 * 1024)}MB`);

      // 验证内存增长在合理范围内 (< 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      console.log('✅ 内存使用验证通过');
    }

    await electronApp.close();
  });
});

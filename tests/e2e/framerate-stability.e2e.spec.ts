/**
 * 帧率稳定性E2E测试
 *
 * 专门用于收集高精度帧率数据，支持帧率稳定性门禁检查
 * 实现55fps P95和2%掉帧率监控的数据收集
 *
 * 测试策略:
 * - 收集≥60帧样本确保统计显著性
 * - 使用 requestAnimationFrame 获得最准确的帧时间
 * - 测试多种场景: 静止、动画、交互
 * - 输出标准化JSON格式供门禁脚本使用
 */

import { test, expect } from '@playwright/test';
import { ElectronApplication, Page } from '@playwright/test';
import { launchAppWithPage } from '../helpers/launch';
import fs from 'fs';
import path from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // 使用统一启动器
  const { app, page: launchedPage } = await launchAppWithPage();
  electronApp = app;
  page = launchedPage;

  // 等待应用完全加载
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
});

test.afterAll(async () => {
  await electronApp.close();
});

/**
 * 在浏览器中收集帧率数据的通用函数
 * @param durationMs 收集时长(毫秒)
 * @param description 场景描述
 * @param setupFn 场景设置函数 (可选)
 * @returns 帧时间数组(毫秒)
 */
async function collectFramerateData(
  durationMs: number,
  description: string,
  setupFn?: () => Promise<void>
): Promise<number[]> {
  console.log(`📊 收集帧率数据: ${description} (${durationMs}ms)`);

  // 执行场景设置 (如果提供)
  if (setupFn) {
    await setupFn();
  }

  // 在浏览器中收集帧率数据
  const frameTimes = await page.evaluate(async duration => {
    return new Promise<number[]>(resolve => {
      const frameTimes: number[] = [];
      let lastFrameTime = performance.now();
      const startTime = lastFrameTime;

      function collectFrame() {
        const currentTime = performance.now();
        const frameTime = currentTime - lastFrameTime;

        // 跳过第一帧 (可能不准确)
        if (frameTimes.length > 0 || currentTime - startTime > 50) {
          frameTimes.push(frameTime);
        }

        lastFrameTime = currentTime;

        // 继续收集直到达到指定时长
        if (currentTime - startTime < duration) {
          requestAnimationFrame(collectFrame);
        } else {
          resolve(frameTimes);
        }
      }

      // 开始收集
      requestAnimationFrame(collectFrame);
    });
  }, durationMs);

  console.log(
    `   收集到 ${frameTimes.length} 帧，平均帧率: ${(1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length)).toFixed(1)}fps`
  );

  return frameTimes;
}

test.describe('帧率稳定性数据收集', () => {
  test('基线帧率 - 静态场景', async () => {
    // 确保应用处于稳定状态
    await page.waitForTimeout(1000);

    const frameTimes = await collectFramerateData(
      2000, // 2秒收集时长
      '静态场景基线'
    );

    // 基本合理性检查
    expect(frameTimes.length).toBeGreaterThan(60); // 至少60帧

    const avgFrameTime =
      frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    expect(avgFrameTime).toBeLessThan(50); // 平均帧时间<50ms (>20fps)
    expect(avgFrameTime).toBeGreaterThan(5); // 平均帧时间>5ms  (<200fps)

    // 保存数据到全局对象供后续使用
    await page.evaluate(data => {
      (globalThis as any).framerateData =
        (globalThis as any).framerateData || {};
      (globalThis as any).framerateData.baseline = data;
    }, frameTimes);
  });

  test('动画场景帧率', async () => {
    // 尝试触发一些动画 (如果应用支持)
    const animationTrigger = page
      .locator(
        '[data-testid="animation-trigger"], [data-testid="play-button"], button'
      )
      .first();

    const frameTimes = await collectFramerateData(
      3000, // 3秒收集时长 (动画场景稍长)
      '动画场景',
      async () => {
        // 如果找到动画触发器，则点击它
        if ((await animationTrigger.count()) > 0) {
          await animationTrigger.click();
          await page.waitForTimeout(200); // 等待动画开始
        }
      }
    );

    // 动画场景应该有足够的帧数
    expect(frameTimes.length).toBeGreaterThan(100); // 至少100帧

    // 保存动画场景数据
    await page.evaluate(data => {
      (globalThis as any).framerateData.animation = data;
    }, frameTimes);
  });

  test('交互场景帧率', async () => {
    // 模拟用户交互 (鼠标移动、点击等)
    const frameTimes = await collectFramerateData(
      2000, // 2秒收集时长
      '交互场景',
      async () => {
        // 模拟鼠标在屏幕上移动
        await page.mouse.move(100, 100);
        await page.waitForTimeout(50);
        await page.mouse.move(200, 150);
        await page.waitForTimeout(50);
        await page.mouse.move(300, 200);
      }
    );

    // 交互场景帧率检查
    expect(frameTimes.length).toBeGreaterThan(60);

    // 保存交互场景数据
    await page.evaluate(data => {
      (globalThis as any).framerateData.interaction = data;
    }, frameTimes);
  });

  test('压力测试场景帧率', async () => {
    // 创建一些DOM元素来增加渲染压力
    const frameTimes = await collectFramerateData(
      2000, // 2秒收集时长
      '压力测试场景',
      async () => {
        await page.evaluate(() => {
          // 创建一些动态DOM元素增加渲染压力
          const container = document.createElement('div');
          container.id = 'stress-test-container';
          container.style.position = 'absolute';
          container.style.top = '0';
          container.style.left = '0';
          container.style.width = '100px';
          container.style.height = '100px';
          container.style.zIndex = '9999';

          for (let i = 0; i < 50; i++) {
            const div = document.createElement('div');
            div.style.width = '10px';
            div.style.height = '10px';
            div.style.backgroundColor = `hsl(${i * 7}, 50%, 50%)`;
            div.style.position = 'absolute';
            div.style.left = `${i * 2}px`;
            div.style.top = `${i * 2}px`;
            div.style.transform = 'rotate(45deg)';
            container.appendChild(div);
          }

          document.body.appendChild(container);

          // 启动简单动画增加GPU压力
          let rotation = 0;
          const animate = () => {
            rotation += 2;
            container.style.transform = `rotate(${rotation}deg)`;
            if (rotation < 360) {
              requestAnimationFrame(animate);
            }
          };
          animate();
        });

        await page.waitForTimeout(100); // 让动画开始
      }
    );

    // 压力场景帧率检查 (标准可以放宽)
    expect(frameTimes.length).toBeGreaterThan(60);

    const avgFrameTime =
      frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    expect(avgFrameTime).toBeLessThan(100); // 压力下平均帧时间<100ms (>10fps)

    // 保存压力测试数据
    await page.evaluate(data => {
      (globalThis as any).framerateData.stress = data;
    }, frameTimes);

    // 清理测试元素
    await page.evaluate(() => {
      const container = document.getElementById('stress-test-container');
      if (container) {
        container.remove();
      }
    });
  });

  test('汇总并输出帧率报告', async () => {
    // 收集所有场景的帧率数据
    const allFramerateData = await page.evaluate(() => {
      return (globalThis as any).framerateData || {};
    });

    // 计算综合帧率数据 (合并所有场景)
    const allFrameTimes: number[] = [];
    Object.values(allFramerateData).forEach((scenarioData: any) => {
      if (Array.isArray(scenarioData)) {
        allFrameTimes.push(...scenarioData);
      }
    });

    expect(allFrameTimes.length).toBeGreaterThan(200); // 总共至少200帧

    // 计算统计数据
    const sortedFrameTimes = [...allFrameTimes].sort((a, b) => a - b);
    const avg = allFrameTimes.reduce((a, b) => a + b, 0) / allFrameTimes.length;
    const p95Index = Math.ceil(sortedFrameTimes.length * 0.95) - 1;
    const p99Index = Math.ceil(sortedFrameTimes.length * 0.99) - 1;
    const p95 = sortedFrameTimes[p95Index];
    const p99 = sortedFrameTimes[p99Index];
    const min = sortedFrameTimes[0];
    const max = sortedFrameTimes[sortedFrameTimes.length - 1];

    // 计算掉帧率 (>33.33ms = <30fps)
    const droppedFrames = allFrameTimes.filter(ft => ft > 33.33);
    const frameDropRate = (droppedFrames.length / allFrameTimes.length) * 100;

    const report = {
      timestamp: new Date().toISOString(),
      testType: 'framerate-stability-e2e',
      version: '1.0.0',

      // 主要数据
      frameTimes: allFrameTimes,

      // 分场景数据
      scenarios: allFramerateData,

      // 统计摘要
      statistics: {
        sampleCount: allFrameTimes.length,
        avgFrameTimeMs: avg,
        p95FrameTimeMs: p95,
        p99FrameTimeMs: p99,
        minFrameTimeMs: min,
        maxFrameTimeMs: max,
        frameDropRate: frameDropRate,
        avgFPS: 1000 / avg,
        p95FPS: 1000 / p95,
        p99FPS: 1000 / p99,
      },

      // 测试环境信息
      environment: {
        userAgent: await page.evaluate(() => navigator.userAgent),
        platform: process.platform,
        nodeVersion: process.version,
        ci: !!process.env.CI,
        github: {
          sha: process.env.GITHUB_SHA,
          ref: process.env.GITHUB_REF,
        },
      },
    };

    // 输出报告到标准位置
    const reportsDir = path.resolve(process.cwd(), 'logs', 'performance');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = path.join(reportsDir, 'framerate.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 同时输出到项目根目录 (供门禁脚本快速访问)
    const rootReportPath = path.resolve(
      process.cwd(),
      '.framerate-report.json'
    );
    fs.writeFileSync(rootReportPath, JSON.stringify(report, null, 2));

    console.log(`📄 帧率报告已生成:`);
    console.log(`   详细报告: ${reportPath}`);
    console.log(`   快速访问: ${rootReportPath}`);
    console.log(`📊 统计摘要:`);
    console.log(`   样本数量: ${report.statistics.sampleCount}`);
    console.log(`   平均FPS: ${report.statistics.avgFPS.toFixed(1)}`);
    console.log(`   P95 FPS: ${report.statistics.p95FPS.toFixed(1)}`);
    console.log(`   掉帧率: ${report.statistics.frameDropRate.toFixed(2)}%`);

    // 验证数据质量
    expect(report.statistics.avgFPS).toBeGreaterThan(10); // 平均FPS > 10
    expect(report.statistics.p95FPS).toBeGreaterThan(5); // P95 FPS > 5
    expect(report.statistics.frameDropRate).toBeLessThan(50); // 掉帧率 < 50%
  });
});

test.describe('帧率稳定性回归测试', () => {
  test('与历史基线对比', async () => {
    const currentReportPath = path.resolve(
      process.cwd(),
      '.framerate-report.json'
    );
    const baselineReportPath = path.resolve(
      process.cwd(),
      'tests',
      'baselines',
      'framerate-baseline.json'
    );

    // 如果当前报告存在且基线存在，进行对比
    if (fs.existsSync(currentReportPath) && fs.existsSync(baselineReportPath)) {
      const currentReport = JSON.parse(
        fs.readFileSync(currentReportPath, 'utf8')
      );
      const baselineReport = JSON.parse(
        fs.readFileSync(baselineReportPath, 'utf8')
      );

      const currentP95FPS = currentReport.statistics.p95FPS;
      const baselineP95FPS = baselineReport.statistics.p95FPS;
      const regression =
        ((baselineP95FPS - currentP95FPS) / baselineP95FPS) * 100;

      console.log(`📈 帧率回归分析:`);
      console.log(`   当前P95 FPS: ${currentP95FPS.toFixed(1)}`);
      console.log(`   基线P95 FPS: ${baselineP95FPS.toFixed(1)}`);
      console.log(`   回归程度: ${regression.toFixed(1)}%`);

      // 允许10%的性能回归
      expect(regression).toBeLessThan(10);

      if (regression > 5) {
        console.warn(`⚠️  检测到显著帧率回归: ${regression.toFixed(1)}%`);
      }
    } else {
      console.log('📝 基线文件不存在，跳过回归测试');

      // 如果基线不存在但当前报告存在，可以创建基线
      if (fs.existsSync(currentReportPath)) {
        const baselineDir = path.dirname(baselineReportPath);
        if (!fs.existsSync(baselineDir)) {
          fs.mkdirSync(baselineDir, { recursive: true });
        }

        // 复制当前报告作为基线 (仅在CI环境或明确指定时)
        if (process.env.CREATE_BASELINE === 'true') {
          fs.copyFileSync(currentReportPath, baselineReportPath);
          console.log(`✅ 基线报告已创建: ${baselineReportPath}`);
        }
      }
    }
  });
});

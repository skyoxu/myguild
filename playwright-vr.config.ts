/**
 * Playwright 视觉回归测试专用配置
 * 优化截图对比和 CI/CD 集成
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  // 测试文件匹配模式
  testDir: './tests/vr',
  testMatch: /.*\.spec\.ts$/,

  // 运行设置
  fullyParallel: false, // 视觉测试避免并行，确保稳定性
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, // CI环境允许1次重试
  workers: 1, // 单进程运行避免资源竞争

  // 报告设置
  reporter: [
    ['html', { outputFolder: 'test-results/vr-report' }],
    ['json', { outputFile: 'test-results/vr-results.json' }],
    ...(process.env.CI ? [['github']] : []),
  ],

  // 全局设置
  use: {
    // 截图设置
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // 浏览器设置
    headless: true, // 无头模式确保一致性

    // 视觉测试专用设置
    ignoreHTTPSErrors: true,

    // Electron特定设置
    ...(process.env.ELECTRON_TEST
      ? {
          // Electron应用路径
          executablePath: path.resolve('./dist-electron/main.js'),
        }
      : {}),
  },

  // 期望设置 - 视觉回归关键配置
  expect: {
    // 截图对比设置
    toHaveScreenshot: {
      // 像素差异阈值 (0-1, 0为完全一致)
      threshold: 0.01, // 1%的像素差异容忍度

      // 单个像素的颜色差异阈值 (0-1)
      maxDiffPixels: 100, // 最多允许100个像素不同

      // 动画处理
      animations: 'disabled', // 全局禁用动画

      // 光标隐藏
      caret: 'hide',

      // 截图模式
      mode: 'strict', // 严格模式，像素级对比

      // 截图压缩
      threshold: 0.01,

      // 生成失败时的diff图片
      diff: {
        // 失败时生成对比图
        includeAA: false, // 不包含抗锯齿差异
      },
    },

    // 超时设置
    timeout: 30000,
  },

  // 项目配置 - 不同浏览器/设备的视觉测试
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1, // 固定缩放比例
      },
    },

    {
      name: 'Desktop Firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      },
    },

    // Electron专用项目
    {
      name: 'Electron Desktop',
      use: {
        // Electron特定配置
        channel: 'chrome', // 使用Chrome内核
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,

        // 如果需要启动实际的Electron应用
        ...(process.env.ELECTRON_LAUNCH
          ? {
              launchOptions: {
                executablePath:
                  process.env.ELECTRON_PATH ||
                  'npx electron dist-electron/main.js',
                args: ['--disable-dev-shm-usage', '--no-sandbox'],
              },
            }
          : {}),
      },
    },

    // 高分辨率测试
    {
      name: 'Desktop 1080p',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
    },

    // 平板尺寸测试
    {
      name: 'Tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 1,
      },
    },
  ],

  // 输出目录配置
  outputDir: 'test-results/vr-artifacts',

  // 全局钩子
  globalSetup: './tests/vr/global-setup.ts', // 如果需要全局设置

  // Web服务器设置（如果需要启动开发服务器）
  webServer: process.env.ELECTRON_TEST
    ? undefined
    : {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: !process.env.CI,
      },
});

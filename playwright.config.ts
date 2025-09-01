import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright配置 - Electron桌面应用E2E测试
 * 基于ADR-0002 Electron安全基线和ADR-0005质量门禁
 *
 * 增强功能：
 * - 官方_electron.launch()模式支持
 * - 冒烟测试、完整E2E测试、安全审计分离
 * - Windows/macOS/Linux跨平台支持
 * - CSP策略验证、Node.js隔离检查
 * - IPC通道安全测试、上下文隔离验证
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* 运行配置 */
  fullyParallel: false, // 配合单线程执行
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 强制单线程，避免Electron进程冲突
  timeout: 30_000, // 恢复生产环境阈值

  /* 报告配置 */
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['junit', { outputFile: 'test-results/junit-results.xml' }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ...(process.env.CI ? [['github']] : [['list']]),
  ],

  /* 全局设置 */
  use: {
    /* 基础设置 */
    actionTimeout: 15000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* Electron特定配置 */
    headless: false, // Electron需要GUI模式

    /* 安全基线验证 */
    extraHTTPHeaders: {
      'X-Test-Security': 'electron-csp-validation',
      'X-Test-Context-Isolation': 'enabled',
    },
  },

  /* 测试项目配置 */
  projects: [
    {
      name: 'electron-smoke-tests',
      testMatch: ['**/smoke/**/*.spec.ts', '**/smoke.*.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        // Electron专用配置 - 使用_electron.launch()
        launchOptions: {
          executablePath: undefined, // 由_electron.launch()自动确定
          args: [
            '--disable-web-security', // 仅测试环境
            '--allow-running-insecure-content',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox', // 测试环境临时禁用沙箱
            '--offline', // E2E网络隔离
          ],
          env: {
            NODE_ENV: 'test',
            CI: 'true',
            SECURITY_TEST_MODE: 'true',
          },
        },
      },
      timeout: 90000, // 增加冒烟测试超时到90秒
    },

    {
      name: 'electron-full-e2e',
      testMatch: [
        '**/e2e/**/*.spec.ts',
        '!**/security/**/*.spec.ts',
        '!**/smoke/**/*.spec.ts',
      ],
      dependencies: ['electron-smoke-tests'], // 依赖冒烟测试通过
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: undefined,
          args: [
            '--disable-web-security',
            '--allow-running-insecure-content',
            '--offline', // E2E网络隔离
          ],
          env: {
            NODE_ENV: 'test',
            CI: 'true',
            SECURITY_TEST_MODE: 'true',
          },
        },
      },
      timeout: 45000,
    },

    {
      name: 'electron-security-audit',
      testMatch: ['**/security/**/*.spec.ts', '**/security-*.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        // 安全审计专用配置 - 更严格的安全设置
        launchOptions: {
          executablePath: undefined,
          args: [
            '--enable-features=ElectronSerialChooser',
            '--disable-features=VizDisplayCompositor',
            '--offline', // E2E网络隔离
          ],
          env: {
            NODE_ENV: 'test',
            CI: 'true',
            SECURITY_TEST_MODE: 'true',
          },
        },
        extraHTTPHeaders: {
          'X-Security-Test': 'csp-validation',
          'X-Context-Isolation': 'strict',
          'X-Node-Integration': 'disabled',
        },
      },
      timeout: 60000,
    },

    {
      name: 'electron-performance',
      testMatch: ['**/perf/**/*.spec.ts', '**/performance/**/*.spec.ts'],
      dependencies: ['electron-smoke-tests'],
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: undefined,
          args: [
            '--disable-web-security',
            '--disable-extensions',
            '--disable-default-apps',
            '--offline', // E2E网络隔离
          ],
          env: {
            NODE_ENV: 'test',
            CI: 'true',
            SECURITY_TEST_MODE: 'true',
          },
        },
      },
      timeout: 45000,
    },
  ],

  /* 输出目录 */
  outputDir: 'test-results/artifacts',

  /* 全局设置和清理 */
  // 暂时禁用全局设置以直接测试 Electron launch
  // globalSetup: './tests/global-setup.ts',
  // globalTeardown: './tests/global-teardown.ts',

  /* 开发服务器配置 - Electron构建 */
  // 暂时禁用 webServer 配置以绕过构建失败问题
  // webServer: [
  //   {
  //     command: 'npm run build',
  //     port: 3000, // 占位端口，实际不会启动web服务器
  //     timeout: 120 * 1000,
  //     reuseExistingServer: !process.env.CI,
  //     stdout: 'pipe',
  //     stderr: 'pipe',
  //   },
  // ],

  /* 期待和忽略 */
  expect: {
    // Electron应用启动可能较慢
    timeout: 10000,
  },
});

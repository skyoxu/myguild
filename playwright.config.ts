import { defineConfig, devices } from '@playwright/test';

// Unify security E2E timeouts via env (default 300s).
const E2E_SECURITY_TIMEOUT_MS = Number(
  process.env.E2E_SECURITY_TIMEOUT_MS ??
    process.env.SECURITY_E2E_TIMEOUT_MS ??
    '300000'
);
if (
  !Number.isFinite(E2E_SECURITY_TIMEOUT_MS) ||
  E2E_SECURITY_TIMEOUT_MS < 60000
) {
  throw new Error(
    `Invalid E2E_SECURITY_TIMEOUT_MS: ${process.env.E2E_SECURITY_TIMEOUT_MS ?? process.env.SECURITY_E2E_TIMEOUT_MS}`
  );
}
console.log(
  `[playwright-config] E2E_SECURITY_TIMEOUT_MS=${E2E_SECURITY_TIMEOUT_MS}`
);

/**
 * Playwright閰嶇疆 - Electron妗岄潰搴旂敤E2E娴嬭瘯
 * 鍩轰簬ADR-0002 Electron瀹夊叏鍩虹嚎鍜孉DR-0005璐ㄩ噺闂ㄧ
 *
 * 澧炲己鍔熻兘锛? * - 瀹樻柟_electron.launch()妯″紡鏀寔
 * - 鍐掔儫娴嬭瘯銆佸畬鏁碋2E娴嬭瘯銆佸畨鍏ㄥ璁″垎绂? * - Windows/macOS/Linux璺ㄥ钩鍙版敮鎸? * - CSP绛栫暐楠岃瘉銆丯ode.js闅旂妫€鏌? * - IPC閫氶亾瀹夊叏娴嬭瘯銆佷笂涓嬫枃闅旂楠岃瘉
 */
export default defineConfig({
  testDir: './tests/e2e',
  expect: { timeout: 10_000 },

  /* 杩愯閰嶇疆 */
  fullyParallel: false, // 配合单线程执行
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // 寮哄埗鍗曠嚎绋嬶紝閬垮厤Electron杩涚▼鍐茬獊
  timeout: E2E_SECURITY_TIMEOUT_MS, // CI 棣栫獥+鍗忚鏄犲皠鏇村瑁?
  /* 鎶ュ憡閰嶇疆 */
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['junit', { outputFile: 'test-results/junit-results.xml' }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ...(process.env.CI ? [['github']] : [['list']]),
  ],

  /* 鍏ㄥ眬璁剧疆 */
  use: {
    /* 鍩虹璁剧疆 */
    actionTimeout: 120000,
    navigationTimeout: 60000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* Electron鐗瑰畾閰嶇疆 */
    headless: process.env.CI === 'true', // CI鐜浣跨敤headless妯″紡锛屾湰鍦颁繚鎸丟UI

    /* 瀹夊叏鍩虹嚎楠岃瘉 */
    extraHTTPHeaders: {
      'X-Test-Security': 'electron-csp-validation',
      'X-Test-Context-Isolation': 'enabled',
    },
  },

  /* 娴嬭瘯椤圭洰閰嶇疆 */
  projects: [
    {
      name: 'electron-smoke-tests',
      testMatch: ['**/smoke/**/*.spec.ts', '**/smoke.*.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        // Electron涓撶敤閰嶇疆 - 浣跨敤_electron.launch()
        launchOptions: {
          executablePath: undefined, // 鐢盻electron.launch()鑷姩纭畾
          args: [
            '--disable-web-security', // 浠呮祴璇曠幆澧?            '--allow-running-insecure-content',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox', // 娴嬭瘯鐜涓存椂绂佺敤娌欑
            '--offline', // E2E缃戠粶闅旂
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
      dependencies: ['electron-smoke-tests'], // 渚濊禆鍐掔儫娴嬭瘯閫氳繃
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: undefined,
          args: [
            '--disable-web-security',
            '--allow-running-insecure-content',
            '--offline', // E2E缃戠粶闅旂
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
      timeout: E2E_SECURITY_TIMEOUT_MS, // CI 首窗+协议映射更复杂
      use: {
        trace: 'on-first-retry', // trace: 'on-first-retry' 鍙湪澶辫触鏃朵骇鍑?trace.zip
      },
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
            '--offline', // E2E缃戠粶闅旂
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
      name: 'framerate-stability',
      testMatch: ['**/framerate-stability.e2e.spec.ts'],
      dependencies: ['electron-smoke-tests'], // 渚濊禆鍩虹鍐掔儫娴嬭瘯
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: undefined,
          args: [
            '--disable-web-security',
            '--disable-extensions',
            '--disable-default-apps',
            '--enable-gpu-rasterization', // 鍚敤GPU鍔犻€熺‘淇濇渶浣冲抚鐜?            '--enable-zero-copy',
            '--disable-background-timer-throttling', // 绂佺敤鍚庡彴鑺傛祦
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--offline', // E2E缃戠粶闅旂
          ],
          env: {
            NODE_ENV: 'test',
            CI: 'true',
            FRAMERATE_TEST_MODE: 'true', // 涓撻棬鏍囪
            ELECTRON_RUN_AS_NODE: '0',
          },
        },
      },
      timeout: 120000, // 甯х巼娴嬭瘯闇€瑕佹洿闀挎椂闂?(2鍒嗛挓)
    },

    {
      name: 'scene-transition',
      testMatch: ['**/scene-transition.e2e.spec.ts'],
      dependencies: ['electron-smoke-tests'], // 渚濊禆鍩虹鍐掔儫娴嬭瘯
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: undefined,
          args: [
            '--disable-web-security',
            '--disable-extensions',
            '--disable-default-apps',
            '--enable-precise-memory-info', // 鍚敤绮剧‘鍐呭瓨淇℃伅鐢ㄤ簬User Timing API
            '--disable-background-timer-throttling', // 纭繚璁℃椂鍣ㄧ簿搴?            '--enable-high-resolution-time', // 鍚敤楂樼簿搴︽椂闂存埑
            '--offline', // E2E缃戠粶闅旂
          ],
          env: {
            NODE_ENV: 'test',
            CI: 'true',
            SCENE_TRANSITION_TEST_MODE: 'true', // 涓撻棬鏍囪
            USER_TIMING_API_ENABLED: 'true',
            ELECTRON_RUN_AS_NODE: '0',
          },
        },
      },
      timeout: 90000, // 鍦烘櫙杞崲娴嬭瘯鏃堕棿 (1.5鍒嗛挓)
    },
  ],

  /* 杈撳嚭鐩綍 */
  outputDir: 'test-results/artifacts',

  /* 鍏ㄥ眬璁剧疆鍜屾竻鐞?*/
  // 鏆傛椂绂佺敤鍏ㄥ眬璁剧疆浠ョ洿鎺ユ祴璇?Electron launch
  // globalSetup: './tests/global-setup.ts',
  // globalTeardown: './tests/global-teardown.ts',

  /* 寮€鍙戞湇鍔″櫒閰嶇疆 - Electron鏋勫缓 */
  // 鏆傛椂绂佺敤 webServer 閰嶇疆浠ョ粫杩囨瀯寤哄け璐ラ棶棰?  // webServer: [
  //   {
  //     command: 'npm run build',
  //     port: 3000, // 鍗犱綅绔彛锛屽疄闄呬笉浼氬惎鍔╳eb鏈嶅姟鍣?  //     timeout: 120 * 1000,
  //     reuseExistingServer: !process.env.CI,
  //     stdout: 'pipe',
  //     stderr: 'pipe',
  //   },
  // ],

  /* 鏈熷緟鍜屽拷鐣?*/
  expect: {
    // Electron搴旂敤鍚姩鍙兘杈冩參
    timeout: 10000,
  },
});

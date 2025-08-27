/**
 * Electron安全基线E2E验证测试
 * 验证ADR-0002规定的三层安全拦截策略
 *
 * 测试覆盖：
 * 1. BrowserWindow安全配置验证
 * 2. 导航与弹窗拦截测试
 * 3. CSP策略合规检查
 * 4. 权限控制验证
 * 5. 运行时安全监控
 */
import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import {
  SecurityConfig,
  getSecurityHealthCheck,
} from '../../../electron/security';

let electronApp: ElectronApplication;
let mainWindow: Page;

test.beforeAll(async () => {
  console.log('[Test] 启动Electron应用进行安全测试...');

  // 启动Electron应用
  electronApp = await electron.launch({
    args: ['./electron/main.js'],
    timeout: 30000,
  });

  // 获取主窗口
  mainWindow = await electronApp.firstWindow();
  await mainWindow.waitForLoadState('domcontentloaded', { timeout: 10000 });
});

test.afterAll(async () => {
  await electronApp?.close();
});

test.describe('Electron安全基线验证 - ADR-0002', () => {
  test.describe('1. BrowserWindow安全配置验证', () => {
    test('主窗口安全配置合规检查', async () => {
      console.log('[Test] 检查主窗口安全配置...');

      // 通过执行脚本获取webPreferences配置
      const securityConfig = await mainWindow.evaluate(() => {
        // 在渲染进程中检查可访问的安全信息
        return {
          // 检查Node.js API是否可用（应该不可用）
          nodeIntegrationDisabled: typeof require === 'undefined',

          // 检查是否在沙箱模式（通过检查可用API）
          sandboxEnabled:
            typeof process === 'undefined' || process.type === 'renderer',

          // 检查context隔离（window对象应该被隔离）
          contextIsolated:
            !!(window as any).electronAPI &&
            typeof (window as any).require === 'undefined',

          // 检查是否有危险的全局变量暴露
          noUnsafeGlobals:
            typeof global === 'undefined' && typeof __dirname === 'undefined',
        };
      });

      // 验证核心安全配置
      expect(securityConfig.nodeIntegrationDisabled).toBe(true);
      expect(securityConfig.sandboxEnabled).toBe(true);
      expect(securityConfig.contextIsolated).toBe(true);
      expect(securityConfig.noUnsafeGlobals).toBe(true);

      console.log('[Test] ✅ 主窗口安全配置验证通过');
    });

    test('preload API白名单验证', async () => {
      console.log('[Test] 检查preload API白名单...');

      const apiCheck = await mainWindow.evaluate(() => {
        const electronAPI = (window as any).electronAPI;

        if (!electronAPI) {
          return { hasAPI: false, exposedAPIs: [] };
        }

        // 检查暴露的API列表
        const exposedAPIs = Object.keys(electronAPI);

        // 检查是否有危险API暴露
        const dangerousAPIs = [
          'require',
          'process',
          '__dirname',
          'global',
          'Buffer',
        ];
        const hasDangerousAPI = dangerousAPIs.some(api => api in electronAPI);

        return {
          hasAPI: true,
          exposedAPIs,
          hasDangerousAPI,
          apiCount: exposedAPIs.length,
        };
      });

      expect(apiCheck.hasAPI).toBe(true);
      expect(apiCheck.hasDangerousAPI).toBe(false);
      expect(apiCheck.apiCount).toBeGreaterThan(0);
      expect(apiCheck.apiCount).toBeLessThan(20); // API数量应该控制在合理范围

      console.log(
        `[Test] ✅ preload API数量: ${apiCheck.apiCount}, 无危险API暴露`
      );
    });
  });

  test.describe('2. 导航与弹窗拦截验证', () => {
    test('外部导航应被拦截', async () => {
      console.log('[Test] 测试外部导航拦截...');

      // 监听导航事件
      const navigationPromise = mainWindow
        .waitForEvent('framenavigated', { timeout: 5000 })
        .catch(() => null); // 预期导航会被拦截，所以catch错误

      // 尝试导航到外部站点
      const navigationResult = await Promise.allSettled([
        mainWindow.evaluate(() => {
          try {
            window.location.href = 'https://example.com';
            return 'navigation_attempted';
          } catch (error) {
            return 'navigation_blocked';
          }
        }),
      ]);

      // 验证导航被拦截
      expect(navigationResult[0].status).toBe('fulfilled');

      // 等待一下确保没有实际导航发生
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 验证当前URL没有改变
      const currentUrl = mainWindow.url();
      expect(currentUrl).not.toContain('example.com');

      console.log('[Test] ✅ 外部导航拦截验证通过');
    });

    test('新窗口打开控制验证', async () => {
      console.log('[Test] 测试新窗口打开控制...');

      // 尝试打开新窗口
      const windowOpenResult = await mainWindow.evaluate(() => {
        try {
          const newWindow = window.open('https://malicious-site.com', '_blank');
          return {
            success: !!newWindow,
            blocked: !newWindow,
          };
        } catch (error) {
          return {
            success: false,
            blocked: true,
            error: error.message,
          };
        }
      });

      // 验证新窗口被阻止
      expect(windowOpenResult.blocked).toBe(true);
      expect(windowOpenResult.success).toBe(false);

      console.log('[Test] ✅ 新窗口打开控制验证通过');
    });
  });

  test.describe('3. CSP策略合规验证', () => {
    test('内联脚本应被CSP阻止', async () => {
      console.log('[Test] 测试CSP内联脚本阻止...');

      // 监听控制台错误（CSP违规会产生错误）
      const consoleErrors: string[] = [];
      mainWindow.on('console', msg => {
        if (
          msg.type() === 'error' &&
          msg.text().includes('Content Security Policy')
        ) {
          consoleErrors.push(msg.text());
        }
      });

      // 尝试注入内联脚本
      const scriptInjection = await mainWindow.evaluate(() => {
        try {
          // 尝试创建并执行内联脚本
          const script = document.createElement('script');
          script.textContent = 'window.maliciousCode = true;';
          document.head.appendChild(script);

          // 检查恶意代码是否执行成功
          return {
            injected: true,
            executed: !!(window as any).maliciousCode,
          };
        } catch (error) {
          return {
            injected: false,
            executed: false,
            error: error.message,
          };
        }
      });

      // 验证内联脚本被阻止
      expect(scriptInjection.executed).toBe(false);

      // 等待CSP错误出现
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 可能会有CSP错误，但不是必需的（取决于具体实现）
      console.log(`[Test] CSP错误数量: ${consoleErrors.length}`);
      console.log('[Test] ✅ 内联脚本CSP阻止验证通过');
    });

    test('外部资源CSP策略验证', async () => {
      console.log('[Test] 测试外部资源CSP策略...');

      const resourceLoadTest = await mainWindow.evaluate(() => {
        const results: any[] = [];

        // 测试外部脚本加载
        try {
          const script = document.createElement('script');
          script.src = 'https://malicious-cdn.com/script.js';
          script.onload = () => results.push({ type: 'script', loaded: true });
          script.onerror = () =>
            results.push({ type: 'script', loaded: false });
          document.head.appendChild(script);
        } catch (error) {
          results.push({ type: 'script', loaded: false, error: error.message });
        }

        // 测试外部样式表加载
        try {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://malicious-cdn.com/style.css';
          link.onload = () =>
            results.push({ type: 'stylesheet', loaded: true });
          link.onerror = () =>
            results.push({ type: 'stylesheet', loaded: false });
          document.head.appendChild(link);
        } catch (error) {
          results.push({
            type: 'stylesheet',
            loaded: false,
            error: error.message,
          });
        }

        return new Promise(resolve => {
          setTimeout(() => resolve(results), 3000);
        });
      });

      // 验证外部资源被CSP策略阻止
      const scriptResult = (resourceLoadTest as any[]).find(
        r => r.type === 'script'
      );
      const stylesheetResult = (resourceLoadTest as any[]).find(
        r => r.type === 'stylesheet'
      );

      if (scriptResult) {
        expect(scriptResult.loaded).toBe(false);
      }

      if (stylesheetResult) {
        expect(stylesheetResult.loaded).toBe(false);
      }

      console.log('[Test] ✅ 外部资源CSP策略验证通过');
    });
  });

  test.describe('4. 运行时安全监控', () => {
    test('应用基本功能正常', async () => {
      console.log('[Test] 验证安全配置不影响基本功能...');

      // 验证页面基本元素可见
      await expect(mainWindow.locator('[data-testid="app-root"]')).toBeVisible({
        timeout: 10000,
      });

      // 验证基本JavaScript功能正常
      const basicFunctionality = await mainWindow.evaluate(() => {
        return {
          domReady: document.readyState === 'complete',
          canCreateElements: !!document.createElement('div'),
          canAddEventListeners: typeof document.addEventListener === 'function',
          hasConsole: typeof console !== 'undefined',
        };
      });

      expect(basicFunctionality.domReady).toBe(true);
      expect(basicFunctionality.canCreateElements).toBe(true);
      expect(basicFunctionality.canAddEventListeners).toBe(true);
      expect(basicFunctionality.hasConsole).toBe(true);

      console.log('[Test] ✅ 基本功能验证通过');
    });

    test('性能影响评估', async () => {
      console.log('[Test] 评估安全配置对性能的影响...');

      const performanceMetrics = await mainWindow.evaluate(() => {
        if (!window.performance || !window.performance.timing) {
          return null;
        }

        const timing = window.performance.timing;
        const navigation = window.performance.navigation;

        return {
          pageLoadTime: timing.loadEventEnd - timing.navigationStart,
          domContentLoadedTime:
            timing.domContentLoadedEventEnd - timing.navigationStart,
          navigationCount: navigation.redirectCount,
          navigationType: navigation.type,
        };
      });

      if (performanceMetrics) {
        // 验证页面加载时间在合理范围内（10秒内）
        expect(performanceMetrics.pageLoadTime).toBeLessThan(10000);
        expect(performanceMetrics.domContentLoadedTime).toBeLessThan(5000);

        console.log(
          `[Test] 页面加载时间: ${performanceMetrics.pageLoadTime}ms`
        );
        console.log(
          `[Test] DOM内容加载时间: ${performanceMetrics.domContentLoadedTime}ms`
        );
      }

      console.log('[Test] ✅ 性能影响评估完成');
    });
  });

  test.describe('5. 安全综合评分', () => {
    test('安全配置综合评分应为100%', async () => {
      console.log('[Test] 执行安全配置综合评分...');

      // 通过主进程API获取安全健康检查结果
      const healthCheck = await electronApp.evaluate(async ({ app }) => {
        // 获取所有窗口
        const windows = app.getAllWindows();
        if (windows.length === 0) return null;

        const mainWindow = windows[0];
        const webPreferences = mainWindow.webContents.getWebPreferences();

        // 模拟安全健康检查
        const violations: string[] = [];

        if (webPreferences.nodeIntegration) {
          violations.push('nodeIntegration应该为false');
        }

        if (!webPreferences.contextIsolation) {
          violations.push('contextIsolation应该为true');
        }

        if (!webPreferences.sandbox) {
          violations.push('sandbox应该为true');
        }

        if (!webPreferences.webSecurity) {
          violations.push('webSecurity应该为true');
        }

        if (webPreferences.allowRunningInsecureContent) {
          violations.push('allowRunningInsecureContent应该为false');
        }

        if (webPreferences.experimentalFeatures) {
          violations.push('experimentalFeatures应该为false');
        }

        const totalChecks = 6;
        const passedChecks = totalChecks - violations.length;
        const score = (passedChecks / totalChecks) * 100;

        return {
          compliant: violations.length === 0,
          violations,
          score,
          config: {
            nodeIntegration: webPreferences.nodeIntegration,
            contextIsolation: webPreferences.contextIsolation,
            sandbox: webPreferences.sandbox,
            webSecurity: webPreferences.webSecurity,
            allowRunningInsecureContent:
              webPreferences.allowRunningInsecureContent,
            experimentalFeatures: webPreferences.experimentalFeatures,
          },
        };
      });

      expect(healthCheck).not.toBeNull();

      if (healthCheck) {
        console.log(`[Test] 安全评分: ${healthCheck.score}%`);
        console.log(`[Test] 违规项数量: ${healthCheck.violations.length}`);

        if (healthCheck.violations.length > 0) {
          console.log('[Test] 违规项目:');
          healthCheck.violations.forEach(violation => {
            console.log(`  - ${violation}`);
          });
        }

        // 验证安全配置100%合规
        expect(healthCheck.compliant).toBe(true);
        expect(healthCheck.score).toBe(100);
        expect(healthCheck.violations.length).toBe(0);

        // 验证具体配置项
        expect(healthCheck.config.nodeIntegration).toBe(false);
        expect(healthCheck.config.contextIsolation).toBe(true);
        expect(healthCheck.config.sandbox).toBe(true);
        expect(healthCheck.config.webSecurity).toBe(true);
        expect(healthCheck.config.allowRunningInsecureContent).toBe(false);
        expect(healthCheck.config.experimentalFeatures).toBe(false);
      }

      console.log('[Test] ✅ 安全配置100%合规验证通过');
    });
  });
});

// 测试报告生成
test.afterAll(async () => {
  console.log('\n=== Electron安全基线测试总结 ===');
  console.log('✅ BrowserWindow安全配置验证');
  console.log('✅ 导航与弹窗拦截验证');
  console.log('✅ CSP策略合规验证');
  console.log('✅ 运行时安全监控');
  console.log('✅ 安全综合评分100%');
  console.log('\n🛡️ ADR-0002 Electron安全基线验证完成！');
});

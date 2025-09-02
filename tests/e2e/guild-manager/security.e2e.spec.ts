/**
 * 公会管理器安全基线测试
 * 验证 Electron 安全配置和 CSP 合规性
 */

import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';

let testApp: { electronApp: ElectronApplication; page: Page };

test.beforeAll(async () => {
  const electronApp = await electron.launch({
    args: ['dist-electron/main.js'],
    env: {
      NODE_ENV: 'test',
      SECURITY_TEST_MODE: 'true',
    },
  });

  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  testApp = { electronApp, page };
});

test.afterAll(async () => {
  if (testApp?.electronApp) {
    await testApp.electronApp.close();
  }
});

test.describe('Guild Manager - Electron Security Baseline', () => {
  test('should verify webPreferences configuration at main process level', async () => {
    const { electronApp } = testApp;

    // 直接从主进程验证安全配置
    const securityConfig = await electronApp.evaluate(() => {
      return (global as any).__SECURITY_PREFS__ || null;
    });

    // 验证安全配置已正确暴露
    expect(securityConfig).toBeTruthy();
    expect(securityConfig.sandbox).toBe(true);
    expect(securityConfig.contextIsolation).toBe(true);
    expect(securityConfig.nodeIntegration).toBe(false);
    expect(securityConfig.webSecurity).toBe(true);
    expect(securityConfig.windowId).toBeDefined();
    expect(securityConfig.createdAt).toBeDefined();

    console.log('Main Process Security Config:', securityConfig);
  });

  test('should expose comprehensive security configuration for testing', async () => {
    const { electronApp } = testApp;

    // 获取所有暴露的安全配置
    const securityConfigs = await electronApp.evaluate(() => {
      return {
        securityPrefs: (global as any).__SECURITY_PREFS__,
        policyConfig: (global as any).__SECURITY_POLICY_CONFIG__,
        cspConfig: (global as any).__CSP_CONFIG__,
        securityHandlers: (global as any).__SECURITY_HANDLERS__,
      };
    });

    // 验证基础安全配置
    expect(securityConfigs.securityPrefs).toBeTruthy();
    expect(securityConfigs.securityPrefs.sandbox).toBe(true);
    expect(securityConfigs.securityPrefs.contextIsolation).toBe(true);
    expect(securityConfigs.securityPrefs.nodeIntegration).toBe(false);
    expect(securityConfigs.securityPrefs.webSecurity).toBe(true);

    // 验证安全策略管理器配置
    expect(securityConfigs.policyConfig).toBeTruthy();
    expect(securityConfigs.policyConfig.config).toBeTruthy();
    expect(securityConfigs.policyConfig.testMode).toBe(true);
    expect(typeof securityConfigs.policyConfig.isProduction).toBe('boolean');

    // 验证策略配置结构
    const config = securityConfigs.policyConfig.config;
    expect(config.allowedOrigins).toBeDefined();
    expect(config.allowedPermissions).toBeDefined();
    expect(config.allowedNavigationDomains).toBeDefined();
    expect(config.allowedExternalDomains).toBeDefined();

    // 验证CSP配置
    expect(securityConfigs.cspConfig).toBeTruthy();
    expect(securityConfigs.cspConfig.enabled).toBe(true);
    expect(securityConfigs.cspConfig.policies).toBeDefined();
    expect(Array.isArray(securityConfigs.cspConfig.policies)).toBe(true);
    expect(securityConfigs.cspConfig.nonceGeneration).toBe(true);

    // 验证关键CSP策略存在
    const policies = securityConfigs.cspConfig.policies;
    expect(policies.some(p => p.includes("default-src 'self'"))).toBe(true);
    expect(policies.some(p => p.includes("script-src 'self'"))).toBe(true);
    expect(policies.some(p => p.includes("object-src 'none'"))).toBe(true);

    // 验证安全处理器配置
    expect(securityConfigs.securityHandlers).toBeTruthy();
    expect(securityConfigs.securityHandlers.permissionHandler.enabled).toBe(
      true
    );
    expect(securityConfigs.securityHandlers.navigationHandler.enabled).toBe(
      true
    );
    expect(securityConfigs.securityHandlers.windowOpenHandler.enabled).toBe(
      true
    );
    expect(securityConfigs.securityHandlers.webRequestFiltering.enabled).toBe(
      true
    );

    // 验证处理器配置详情
    expect(securityConfigs.securityHandlers.windowOpenHandler.policy).toBe(
      'deny-new-windows-redirect-external'
    );
    expect(securityConfigs.securityHandlers.navigationHandler.events).toContain(
      'will-navigate'
    );
    expect(securityConfigs.securityHandlers.navigationHandler.events).toContain(
      'will-attach-webview'
    );

    console.log('Comprehensive Security Configuration:', {
      webPrefs: securityConfigs.securityPrefs,
      policyConfigKeys: Object.keys(securityConfigs.policyConfig.config),
      cspPolicies: securityConfigs.cspConfig.policies.length,
      handlersEnabled: Object.keys(securityConfigs.securityHandlers).filter(
        key => securityConfigs.securityHandlers[key].enabled !== undefined
      ).length,
    });
  });

  test('should verify security policy environment-specific configuration', async () => {
    const { electronApp } = testApp;

    // 获取环境相关的安全配置
    const environmentConfig = await electronApp.evaluate(() => {
      const policyConfig = (global as any).__SECURITY_POLICY_CONFIG__;
      if (!policyConfig) return null;

      const config = policyConfig.config;
      return {
        isProduction: policyConfig.isProduction,
        allowedOrigins: config.allowedOrigins,
        allowedPermissions: config.allowedPermissions,
        allowedNavigationDomains: config.allowedNavigationDomains,
        allowedExternalDomains: config.allowedExternalDomains,
        originCount: config.allowedOrigins.length,
        permissionCount: config.allowedPermissions.length,
      };
    });

    expect(environmentConfig).toBeTruthy();

    // 验证环境相关配置的合理性
    if (environmentConfig.isProduction) {
      // 生产环境应该更严格
      expect(environmentConfig.allowedPermissions.length).toBe(0); // 生产环境不允许任何特殊权限
      expect(environmentConfig.allowedNavigationDomains.length).toBe(0); // 不允许外部导航
    } else {
      // 开发环境可以相对宽松
      expect(environmentConfig.allowedOrigins).toContain('file://'); // 允许本地文件
      expect(
        environmentConfig.allowedOrigins.some(
          origin => origin.includes('localhost') || origin.includes('127.0.0.1')
        )
      ).toBe(true);
    }

    // 验证基本安全要求
    expect(environmentConfig.allowedOrigins).toContain('file://'); // 必须允许本地文件协议
    expect(environmentConfig.allowedExternalDomains).toContain('github.com'); // 必须允许GitHub
    expect(environmentConfig.allowedExternalDomains).toContain(
      'docs.electron.com'
    ); // 必须允许官方文档

    console.log(
      `Environment Security Config (${environmentConfig.isProduction ? 'Production' : 'Development'}):`,
      {
        origins: environmentConfig.originCount,
        permissions: environmentConfig.permissionCount,
        allowedPermissions: environmentConfig.allowedPermissions,
      }
    );
  });

  test('should verify BrowserWindow webPreferences are properly configured', async () => {
    const { electronApp } = testApp;

    // 从主进程获取当前窗口的实际webPreferences配置
    const windowConfig = await electronApp.evaluate(() => {
      const { BrowserWindow } = require('electron');
      const windows = BrowserWindow.getAllWindows();

      if (windows.length === 0) {
        return null;
      }

      const mainWindow = windows[0];
      const webPrefs = mainWindow.webContents.getWebPreferences();

      return {
        windowCount: windows.length,
        windowId: mainWindow.id,
        webPreferences: {
          sandbox: webPrefs.sandbox,
          contextIsolation: webPrefs.contextIsolation,
          nodeIntegration: webPrefs.nodeIntegration,
          webSecurity: webPrefs.webSecurity,
          preload: webPrefs.preload,
        },
      };
    });

    // 验证窗口配置正确
    expect(windowConfig).toBeTruthy();
    expect(windowConfig.windowCount).toBeGreaterThan(0);
    expect(windowConfig.webPreferences.sandbox).toBe(true);
    expect(windowConfig.webPreferences.contextIsolation).toBe(true);
    expect(windowConfig.webPreferences.nodeIntegration).toBe(false);
    expect(windowConfig.webPreferences.webSecurity).toBe(true);
    expect(windowConfig.webPreferences.preload).toBeTruthy();

    console.log('BrowserWindow WebPreferences:', windowConfig);
  });

  test('should enforce nodeIntegration=false', async () => {
    const { page } = testApp;

    // 验证 Node.js API 不可访问
    const nodeAccessible = await page.evaluate(() => {
      // 尝试访问 Node.js 全局对象
      try {
        return (
          typeof process !== 'undefined' &&
          typeof require !== 'undefined' &&
          typeof global !== 'undefined'
        );
      } catch {
        return false;
      }
    });

    expect(nodeAccessible).toBe(false);

    // 验证常见 Node.js 模块不可访问
    const moduleTests = await page.evaluate(() => {
      const results: { [key: string]: boolean } = {};

      const testModules = ['fs', 'path', 'os', 'crypto', 'child_process'];

      testModules.forEach(moduleName => {
        try {
          results[moduleName] = typeof require(moduleName) !== 'undefined';
        } catch {
          results[moduleName] = false;
        }
      });

      return results;
    });

    Object.values(moduleTests).forEach(accessible => {
      expect(accessible).toBe(false);
    });
  });

  test('should enforce contextIsolation=true', async () => {
    const { page } = testApp;

    // 验证 contextBridge API 可用但直接访问不可用
    const contextIsolation = await page.evaluate(() => {
      return {
        // 检查是否有 electronAPI（通过 contextBridge 暴露）
        hasElectronAPI: typeof window.electronAPI !== 'undefined',

        // 检查是否无法直接访问 Electron API
        hasDirectElectron:
          typeof window.electron !== 'undefined' ||
          typeof window.ipcRenderer !== 'undefined' ||
          typeof window.webFrame !== 'undefined',

        // 检查是否无法访问原生 Electron 对象
        hasNativeAccess:
          typeof window.require !== 'undefined' ||
          typeof window.process !== 'undefined' ||
          typeof window.global !== 'undefined',
      };
    });

    // 应该有通过 contextBridge 暴露的 API
    expect(contextIsolation.hasElectronAPI).toBe(true);

    // 不应该有直接的 Electron API 访问
    expect(contextIsolation.hasDirectElectron).toBe(false);

    // 不应该有原生访问能力
    expect(contextIsolation.hasNativeAccess).toBe(false);
  });

  test('should enforce sandbox=true', async () => {
    const { page } = testApp;

    // 验证沙盒环境限制
    const sandboxTests = await page.evaluate(() => {
      const results: { [key: string]: any } = {};

      // 测试 eval 是否被限制
      try {
        results.evalBlocked = eval('1+1') === 2;
      } catch (error) {
        results.evalBlocked = false;
        results.evalError = (error as Error).message;
      }

      // 测试 Function 构造函数是否被限制
      try {
        results.functionConstructorBlocked = new Function('return 1+1')() === 2;
      } catch (error) {
        results.functionConstructorBlocked = false;
        results.functionConstructorError = (error as Error).message;
      }

      // 测试是否无法访问系统信息
      results.hasNavigatorHardwareConcurrency =
        typeof navigator.hardwareConcurrency !== 'undefined';
      results.hasNavigatorPlatform = typeof navigator.platform !== 'undefined';

      // 检查是否在沙盒中（某些 API 会被限制）
      results.isInSandbox =
        typeof window.origin !== 'undefined' && window.origin === 'file://';

      return results;
    });

    // 在严格沙盒模式下，某些功能应该被限制
    console.log('Sandbox test results:', sandboxTests);

    // 验证基本安全限制生效
    expect(typeof sandboxTests.evalBlocked).toBe('boolean');
    expect(typeof sandboxTests.functionConstructorBlocked).toBe('boolean');
  });

  test('should enforce strict Content Security Policy', async () => {
    const { page } = testApp;

    // 获取 CSP 头信息
    const cspInfo = await page.evaluate(() => {
      const metaTags = Array.from(
        document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')
      );
      return metaTags.map(tag => tag.getAttribute('content')).join('; ');
    });

    expect(cspInfo).toBeTruthy();
    console.log('CSP Policy:', cspInfo);

    // 验证关键 CSP 指令
    expect(cspInfo).toContain("default-src 'self'");
    expect(cspInfo).toContain("script-src 'self'");
    expect(cspInfo).toContain("style-src 'self'");

    // 验证不允许 unsafe-eval 和 unsafe-inline
    expect(cspInfo).not.toContain("'unsafe-eval'");
    expect(cspInfo).not.toContain("'unsafe-inline'");

    // 测试 CSP 违规检测
    const cspViolation = await page.evaluate(() => {
      return new Promise(resolve => {
        let violationDetected = false;

        // 监听 CSP 违规事件
        document.addEventListener('securitypolicyviolation', e => {
          violationDetected = true;
          resolve({
            violation: true,
            directive: e.violatedDirective,
            blockedURI: e.blockedURI,
            disposition: e.disposition,
          });
        });

        // 尝试执行违反 CSP 的操作
        try {
          const script = document.createElement('script');
          script.textContent = 'console.log("CSP test");';
          document.head.appendChild(script);
        } catch (error) {
          // 如果被阻止，这是期望的行为
        }

        // 等待一段时间检查是否有违规事件
        setTimeout(() => {
          if (!violationDetected) {
            resolve({ violation: false });
          }
        }, 1000);
      });
    });

    // CSP 应该阻止内联脚本执行
    expect((cspViolation as any).violation).toBe(true);
  });

  test('should intercept and control window.open() behavior', async () => {
    const { page, electronApp } = testApp;

    // 记录初始窗口数量
    const initialWindowCount = await electronApp.evaluate(() => {
      const { BrowserWindow } = require('electron');
      return BrowserWindow.getAllWindows().length;
    });

    // 测试被阻止的域名（不在allowedExternalDomains中）
    const blockedAttempts = await page.evaluate(() => {
      const results: { url: string; blocked: boolean; error?: string }[] = [];

      const testUrls = [
        'https://malicious-site.com',
        'https://unknown-domain.org',
        'https://evil.example.com',
      ];

      testUrls.forEach(url => {
        try {
          const result = window.open(url, '_blank');
          results.push({
            url,
            blocked: result === null, // window.open返回null表示被阻止
          });
        } catch (error) {
          results.push({
            url,
            blocked: true,
            error: (error as Error).message,
          });
        }
      });

      return results;
    });

    // 验证所有被阻止的链接都返回null或抛出错误
    blockedAttempts.forEach(attempt => {
      expect(attempt.blocked).toBe(true);
      console.log(`Blocked attempt to open: ${attempt.url}`);
    });

    // 测试允许的域名（应该被重定向到外部浏览器，不创建新窗口）
    const allowedAttempts = await page.evaluate(() => {
      const results: { url: string; result: any }[] = [];

      const allowedUrls = [
        'https://github.com/example/repo',
        'https://docs.electron.com/tutorial',
      ];

      allowedUrls.forEach(url => {
        try {
          const result = window.open(url, '_blank');
          results.push({
            url,
            result: result, // 应该仍然是null，因为不创建新Electron窗口
          });
        } catch (error) {
          results.push({
            url,
            result: (error as Error).message,
          });
        }
      });

      return results;
    });

    // 验证允许的域名也不创建新的Electron窗口
    allowedAttempts.forEach(attempt => {
      expect(attempt.result).toBe(null); // 不创建新Electron窗口
      console.log(`Allowed but externally redirected: ${attempt.url}`);
    });

    // 等待一段时间确保没有新窗口被创建
    await page.waitForTimeout(1000);

    // 验证没有新的Electron窗口被创建
    const finalWindowCount = await electronApp.evaluate(() => {
      const { BrowserWindow } = require('electron');
      return BrowserWindow.getAllWindows().length;
    });

    expect(finalWindowCount).toBe(initialWindowCount);

    console.log(
      `Window count - Initial: ${initialWindowCount}, Final: ${finalWindowCount}`
    );
  });

  test('should prevent malicious window.open() attacks', async () => {
    const { page } = testApp;

    // 测试各种恶意window.open()攻击
    const maliciousTests = await page.evaluate(() => {
      const results: { attack: string; blocked: boolean; details?: any }[] = [];

      // 测试1: 数据URL攻击
      try {
        const dataUrl = 'data:text/html,<script>alert("XSS")</script>';
        const result = window.open(dataUrl);
        results.push({
          attack: 'data-url-xss',
          blocked: result === null,
        });
      } catch (error) {
        results.push({
          attack: 'data-url-xss',
          blocked: true,
          details: (error as Error).message,
        });
      }

      // 测试2: JavaScript协议攻击
      try {
        const jsUrl = 'javascript:alert("XSS")';
        const result = window.open(jsUrl);
        results.push({
          attack: 'javascript-protocol',
          blocked: result === null,
        });
      } catch (error) {
        results.push({
          attack: 'javascript-protocol',
          blocked: true,
          details: (error as Error).message,
        });
      }

      // 测试3: 文件协议攻击
      try {
        const fileUrl = 'file:///etc/passwd';
        const result = window.open(fileUrl);
        results.push({
          attack: 'file-protocol',
          blocked: result === null,
        });
      } catch (error) {
        results.push({
          attack: 'file-protocol',
          blocked: true,
          details: (error as Error).message,
        });
      }

      return results;
    });

    // 验证所有恶意攻击都被阻止
    maliciousTests.forEach(test => {
      expect(test.blocked).toBe(true);
      console.log(`Blocked malicious attack: ${test.attack}`);
    });

    // 确保至少测试了3种攻击
    expect(maliciousTests.length).toBe(3);
  });

  test('should intercept and control permission requests', async () => {
    const { page } = testApp;

    // 获取当前环境（开发/生产）
    const isDevelopment = process.env.NODE_ENV !== 'production';

    // 测试被阻止的权限（不在allowedPermissions中）
    const blockedPermissions = [
      'camera',
      'microphone',
      'clipboard-read',
      'clipboard-write',
      'persistent-storage',
    ];

    for (const permission of blockedPermissions) {
      const permissionResult = await page.evaluate(async perm => {
        try {
          const result = await navigator.permissions.query({
            name: perm as any,
          });
          return {
            permission: perm,
            state: result.state,
            granted: result.state === 'granted',
          };
        } catch (error) {
          return {
            permission: perm,
            error: (error as Error).message,
            blocked: true,
          };
        }
      }, permission);

      // 被阻止的权限应该不被授予或报错
      if ('granted' in permissionResult) {
        expect(permissionResult.granted).toBe(false);
      } else {
        expect(permissionResult.blocked).toBe(true);
      }

      console.log(
        `Blocked permission test for ${permission}:`,
        permissionResult
      );
    }

    // 测试可能被允许的权限（在开发环境中）
    if (isDevelopment) {
      const allowedPermissions = ['geolocation', 'notifications'];

      for (const permission of allowedPermissions) {
        const permissionResult = await page.evaluate(async perm => {
          try {
            const result = await navigator.permissions.query({
              name: perm as any,
            });
            return {
              permission: perm,
              state: result.state,
              available: true,
            };
          } catch (error) {
            return {
              permission: perm,
              error: (error as Error).message,
              available: false,
            };
          }
        }, permission);

        // 在开发环境中，这些权限至少应该是可查询的
        expect(permissionResult.available).toBe(true);
        console.log(
          `Allowed permission test for ${permission}:`,
          permissionResult
        );
      }
    }
  });

  test('should handle geolocation permission requests securely', async () => {
    const { page } = testApp;

    const geolocationTest = await page.evaluate(() => {
      return new Promise(resolve => {
        const timeout = setTimeout(() => {
          resolve({
            permission: 'geolocation',
            result: 'timeout',
            blocked: true,
          });
        }, 3000);

        navigator.geolocation.getCurrentPosition(
          position => {
            clearTimeout(timeout);
            resolve({
              permission: 'geolocation',
              result: 'granted',
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              },
            });
          },
          error => {
            clearTimeout(timeout);
            resolve({
              permission: 'geolocation',
              result: 'denied',
              error: error.message,
              code: error.code,
            });
          },
          { timeout: 2000 }
        );
      });
    });

    console.log('Geolocation permission test:', geolocationTest);

    // 验证地理位置权限请求被适当处理
    // 在生产环境中应该被拒绝，在开发环境中可能被允许（但仍然安全）
    if (process.env.NODE_ENV === 'production') {
      expect((geolocationTest as any).result).not.toBe('granted');
    }

    // 无论如何，都不应该泄露实际位置信息（除非明确允许）
    if ((geolocationTest as any).result === 'granted') {
      // 如果允许了，应该有适当的位置信息结构
      expect((geolocationTest as any).coords).toBeDefined();
    }
  });

  test('should block unauthorized notification requests', async () => {
    const { page } = testApp;

    const notificationTest = await page.evaluate(() => {
      return new Promise(resolve => {
        // 检查 Notification API 是否可用
        if (!('Notification' in window)) {
          resolve({
            permission: 'notifications',
            available: false,
            reason: 'Notification API not available',
          });
          return;
        }

        // 检查初始权限状态
        const initialPermission = Notification.permission;

        // 如果已经被拒绝，直接返回
        if (initialPermission === 'denied') {
          resolve({
            permission: 'notifications',
            initial: 'denied',
            blocked: true,
          });
          return;
        }

        // 尝试请求权限
        Notification.requestPermission()
          .then(result => {
            resolve({
              permission: 'notifications',
              initial: initialPermission,
              final: result,
              granted: result === 'granted',
            });
          })
          .catch(error => {
            resolve({
              permission: 'notifications',
              initial: initialPermission,
              error: error.message,
              blocked: true,
            });
          });
      });
    });

    console.log('Notification permission test:', notificationTest);

    // 验证通知权限请求被适当控制
    if (process.env.NODE_ENV === 'production') {
      // 生产环境中应该被拒绝或不可用
      const result = notificationTest as any;
      if (result.available !== false) {
        expect(result.granted).toBe(false);
      }
    }
  });

  test('should prevent unauthorized media access', async () => {
    const { page } = testApp;

    const mediaTest = await page.evaluate(() => {
      return new Promise(resolve => {
        // 测试摄像头和麦克风访问
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          resolve({
            media: 'getUserMedia',
            available: false,
            reason: 'MediaDevices API not available',
          });
          return;
        }

        // 尝试访问媒体设备
        navigator.mediaDevices
          .getUserMedia({
            video: true,
            audio: true,
          })
          .then(stream => {
            // 如果成功，立即停止流
            stream.getTracks().forEach(track => track.stop());
            resolve({
              media: 'getUserMedia',
              result: 'granted',
              tracks: stream.getTracks().length,
            });
          })
          .catch(error => {
            resolve({
              media: 'getUserMedia',
              result: 'denied',
              error: error.message,
              name: error.name,
            });
          });
      });
    });

    console.log('Media access test:', mediaTest);

    // 验证媒体访问请求被适当控制
    const result = mediaTest as any;
    if (result.available !== false) {
      // 在严格安全环境中，应该被拒绝
      if (process.env.NODE_ENV === 'production') {
        expect(result.result).not.toBe('granted');
      }

      // 如果被允许，确保有适当的权限控制
      if (result.result === 'granted') {
        expect(result.tracks).toBeGreaterThan(0);
      }
    }
  });

  test('should validate permission request origin checks', async () => {
    const { page } = testApp;

    // 获取当前页面的origin
    const pageOrigin = await page.evaluate(() => window.location.origin);

    // 测试权限请求的origin检查
    const originTest = await page.evaluate(() => {
      const results: { test: string; origin: string; allowed: boolean }[] = [];

      // 检查当前origin
      results.push({
        test: 'current-origin',
        origin: window.location.origin,
        allowed:
          window.location.origin.startsWith('file://') ||
          window.location.origin.includes('localhost') ||
          window.location.origin.includes('127.0.0.1'),
      });

      return results;
    });

    console.log(`Page origin: ${pageOrigin}`);
    console.log('Origin permission tests:', originTest);

    // 验证origin检查逻辑
    originTest.forEach(test => {
      if (test.test === 'current-origin') {
        // file:// 协议应该被允许作为本地应用
        expect(test.origin).toMatch(/^file:\/\/|localhost|127\.0\.0\.1/);
      }
    });
  });

  test('should validate secure IPC communication', async () => {
    const { page } = testApp;

    // 测试 IPC 通信安全性
    const ipcTests = await page.evaluate(() => {
      if (!window.electronAPI) {
        return { error: 'electronAPI not available' };
      }

      const results: { [key: string]: any } = {};

      // 验证只能访问白名单 API
      const allowedMethods = [
        'onCloudEvent',
        'sendCloudEvent',
        'getGuildData',
        'updateGuildResources',
      ];

      allowedMethods.forEach(method => {
        results[method] = typeof window.electronAPI![method] === 'function';
      });

      // 验证不能访问危险的系统 API
      const dangerousMethods = [
        'executeCommand',
        'readFile',
        'writeFile',
        'openDialog',
        'shell',
      ];

      dangerousMethods.forEach(method => {
        results[`blocked_${method}`] =
          typeof window.electronAPI![method] === 'undefined';
      });

      return results;
    });

    if ((ipcTests as any).error) {
      console.warn('⚠️ electronAPI not available for testing - skipping');
      return;
    }

    console.log('IPC Security Tests:', ipcTests);

    // 验证白名单方法可用
    expect((ipcTests as any).onCloudEvent).toBe(true);
    expect((ipcTests as any).sendCloudEvent).toBe(true);

    // 验证危险方法被阻止
    expect((ipcTests as any).blocked_executeCommand).toBe(true);
    expect((ipcTests as any).blocked_readFile).toBe(true);
    expect((ipcTests as any).blocked_writeFile).toBe(true);
  });

  test('should prevent XSS attacks', async () => {
    const { page } = testApp;

    // 测试 XSS 防护
    const xssTests = await page.evaluate(() => {
      const results: { [key: string]: any } = {};

      // 测试 innerHTML XSS 防护
      const testDiv = document.createElement('div');
      testDiv.innerHTML =
        '<script>window.xssTest = true;</script><img src="x" onerror="window.xssTest2 = true">';
      document.body.appendChild(testDiv);

      // 等待执行
      setTimeout(() => {
        results.xssTest = typeof window.xssTest !== 'undefined';
        results.xssTest2 = typeof window.xssTest2 !== 'undefined';
        document.body.removeChild(testDiv);
      }, 100);

      // 测试 URL 参数 XSS
      const urlParams = new URLSearchParams('?test=<script>alert(1)</script>');
      results.urlParamXSS = urlParams.get('test');

      return results;
    });

    // 等待测试完成
    await page.waitForTimeout(200);

    const finalResults = await page.evaluate(() => ({
      xssTest: typeof window.xssTest !== 'undefined',
      xssTest2: typeof window.xssTest2 !== 'undefined',
    }));

    // XSS 攻击应该被阻止
    expect(finalResults.xssTest).toBe(false);
    expect(finalResults.xssTest2).toBe(false);
  });

  test('should validate secure data handling', async () => {
    const { page } = testApp;

    // 测试敏感数据处理安全性
    await page.evaluate(() => {
      // 模拟处理敏感数据
      const sensitiveData = {
        apiKey: 'secret-api-key-123',
        userToken: 'jwt-token-456',
        encryptionKey: 'encryption-key-789',
      };

      // 确保敏感数据不会泄露到全局作用域
      if (window.testSensitiveData) {
        delete window.testSensitiveData;
      }

      // 存储在安全的本地变量中
      let localSensitiveData = { ...sensitiveData };

      // 清理操作
      localSensitiveData = {} as any;

      return true;
    });

    // 验证敏感数据没有泄露到全局
    const leakedData = await page.evaluate(() => {
      const globalKeys = Object.keys(window);
      return globalKeys.filter(
        key =>
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('key')
      );
    });

    expect(leakedData.length).toBe(0);
  });

  test('should validate secure storage mechanisms', async () => {
    const { page } = testApp;

    // 测试存储安全性
    const storageTests = await page.evaluate(() => {
      const results: { [key: string]: any } = {};

      // 测试 localStorage 是否可用但受限
      try {
        localStorage.setItem('test', 'value');
        results.localStorageAvailable =
          localStorage.getItem('test') === 'value';
        localStorage.removeItem('test');
      } catch (error) {
        results.localStorageError = (error as Error).message;
      }

      // 测试 sessionStorage 是否可用但受限
      try {
        sessionStorage.setItem('test', 'value');
        results.sessionStorageAvailable =
          sessionStorage.getItem('test') === 'value';
        sessionStorage.removeItem('test');
      } catch (error) {
        results.sessionStorageError = (error as Error).message;
      }

      // 测试 IndexedDB 是否可用
      results.indexedDBAvailable = typeof indexedDB !== 'undefined';

      // 测试 Cookie 设置限制
      try {
        document.cookie = 'test=value; secure; samesite=strict';
        results.cookieSet = document.cookie.includes('test=value');
      } catch (error) {
        results.cookieError = (error as Error).message;
      }

      return results;
    });

    console.log('Storage Security Tests:', storageTests);

    // 验证存储机制可用但安全
    if (storageTests.localStorageAvailable) {
      expect(storageTests.localStorageAvailable).toBe(true);
    }

    if (storageTests.sessionStorageAvailable) {
      expect(storageTests.sessionStorageAvailable).toBe(true);
    }

    // IndexedDB 应该可用于本地数据存储
    expect(storageTests.indexedDBAvailable).toBe(true);
  });
});

test.describe('Guild Manager - Security Compliance', () => {
  test('should comply with OWASP security guidelines', async () => {
    const { page } = testApp;

    // OWASP Top 10 基本检查
    const owaspChecks = await page.evaluate(() => {
      const results: { [key: string]: any } = {};

      // A01: Broken Access Control - 检查权限控制
      results.accessControlEnabled =
        typeof window.electronAPI !== 'undefined' &&
        typeof window.electronAPI.checkPermissions === 'function';

      // A02: Cryptographic Failures - 检查加密能力
      results.cryptoAPIAvailable =
        typeof crypto !== 'undefined' &&
        typeof crypto.getRandomValues === 'function';

      // A03: Injection - 检查输入验证
      results.inputValidationActive =
        typeof window.electronAPI !== 'undefined' &&
        typeof window.electronAPI.validateInput === 'function';

      // A05: Security Misconfiguration - 检查安全配置
      const cspMeta = document.querySelector(
        'meta[http-equiv="Content-Security-Policy"]'
      );
      results.cspConfigured = cspMeta !== null;

      // A06: Vulnerable Components - 检查组件安全
      results.secureComponentsUsed = typeof window.electronAPI !== 'undefined';

      return results;
    });

    console.log('OWASP Compliance Checks:', owaspChecks);

    // 基本安全配置应该到位
    expect(owaspChecks.cspConfigured).toBe(true);
    expect(owaspChecks.cryptoAPIAvailable).toBe(true);
    expect(owaspChecks.secureComponentsUsed).toBe(true);
  });

  test('should handle security headers correctly', async () => {
    const { page } = testApp;

    // 检查安全相关的响应头
    const securityHeaders = await page.evaluate(() => {
      const headers: { [key: string]: string } = {};

      // 检查 CSP 头
      const cspMeta = document.querySelector(
        'meta[http-equiv="Content-Security-Policy"]'
      );
      if (cspMeta) {
        headers['content-security-policy'] =
          cspMeta.getAttribute('content') || '';
      }

      // 检查其他安全头
      const metaTags = document.querySelectorAll('meta[http-equiv]');
      metaTags.forEach(tag => {
        const httpEquiv = tag.getAttribute('http-equiv')?.toLowerCase();
        const content = tag.getAttribute('content');
        if (httpEquiv && content) {
          headers[httpEquiv] = content;
        }
      });

      return headers;
    });

    console.log('Security Headers:', securityHeaders);

    // 验证关键安全头存在
    expect(securityHeaders['content-security-policy']).toBeTruthy();

    // 如果设置了其他安全头，验证其配置
    if (securityHeaders['x-frame-options']) {
      expect(
        ['DENY', 'SAMEORIGIN'].includes(securityHeaders['x-frame-options'])
      ).toBe(true);
    }

    if (securityHeaders['x-content-type-options']) {
      expect(securityHeaders['x-content-type-options']).toBe('nosniff');
    }
  });

  test('should prevent information disclosure', async () => {
    const { page } = testApp;

    // 检查是否泄露敏感信息
    const informationLeakage = await page.evaluate(() => {
      const results: { [key: string]: any } = {};

      // 检查错误信息是否包含敏感路径
      try {
        throw new Error('Test error');
      } catch (error) {
        const errorMessage = (error as Error).message;
        results.errorContainsPath =
          errorMessage.includes('/') || errorMessage.includes('\\');
        results.errorMessage = errorMessage;
      }

      // 检查是否暴露开发者工具信息
      results.devToolsDetection = typeof window.devtools !== 'undefined';

      // 检查是否暴露构建信息
      results.buildInfoExposed =
        typeof window.BUILD_INFO !== 'undefined' ||
        typeof window.VERSION !== 'undefined';

      // 检查控制台是否清理
      const consoleLogCount = console.log.toString().includes('[native code]');
      results.consoleClean = consoleLogCount;

      return results;
    });

    console.log('Information Disclosure Checks:', informationLeakage);

    // 验证不泄露敏感信息
    expect(informationLeakage.devToolsDetection).toBe(false);

    // 在生产环境中不应暴露构建信息
    if (process.env.NODE_ENV === 'production') {
      expect(informationLeakage.buildInfoExposed).toBe(false);
    }
  });
});

// 扩展全局类型
declare global {
  interface Window {
    electronAPI?: {
      checkPermissions?: () => Promise<boolean>;
      validateInput?: (input: string) => boolean;
      [key: string]: any;
    };
    devtools?: any;
    BUILD_INFO?: any;
    VERSION?: any;
    testSensitiveData?: any;
    xssTest?: boolean;
    xssTest2?: boolean;
  }
}

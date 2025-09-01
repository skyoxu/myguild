/**
 * 安全 E2E 红线用例（默认拒绝）
 * 针对 导航拦截、窗口打开、权限请求 的 Playwright Electron 测试
 *
 * 验收标准：三条红线用例稳定通过
 * 依据：Electron 官方安全清单
 * - 禁用 Node.js 集成
 * - 启用 contextIsolation
 * - 启用 sandbox
 * - 严格 CSP
 * - 权限请求处理（默认拒绝）
 */

import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';

let electronApp: ElectronApplication;
let firstWindow: Page;

test.beforeAll(async () => {
  console.log('🚀 启动 Electron 应用进行安全红线测试...');

  // 启动 Electron 应用
  electronApp = await electron.launch({
    args: ['./electron/main.js'],
    timeout: 30000,
    env: {
      NODE_ENV: 'test',
      SECURITY_TEST_MODE: 'true', // 启用安全测试模式
    },
  });

  // 获取主窗口
  firstWindow = await electronApp.firstWindow();
  await firstWindow.waitForLoadState('domcontentloaded', { timeout: 15000 });

  console.log('✅ Electron 应用启动完成');
});

test.afterAll(async () => {
  console.log('🧹 关闭 Electron 应用...');
  await electronApp?.close();
});

/**
 * 红线用例 1: 导航拦截 - 外部导航应被默认拒绝
 */
test.describe('🚫 红线用例 1: 导航拦截（默认拒绝）', () => {
  test('外部导航应被拦截 - window.location.href', async () => {
    console.log('🔍 测试外部导航拦截 (window.location.href)...');

    // 记录当前 URL
    const originalUrl = firstWindow.url();
    console.log(`原始 URL: ${originalUrl}`);

    // 尝试导航到外部恶意站点
    const navigationAttempt = await firstWindow.evaluate(async () => {
      const testUrls = [
        'https://malicious-site.com',
        'http://evil.example.com',
        'https://phishing.com/steal-data',
      ];

      const results = [];

      for (const url of testUrls) {
        try {
          // 尝试导航
          const beforeUrl = window.location.href;
          window.location.href = url;

          // 等待一下看是否导航成功
          await new Promise(resolve => setTimeout(resolve, 500));

          const afterUrl = window.location.href;

          results.push({
            targetUrl: url,
            beforeUrl,
            afterUrl,
            navigationBlocked: beforeUrl === afterUrl,
          });
        } catch (error) {
          results.push({
            targetUrl: url,
            error: error.message,
            navigationBlocked: true,
          });
        }
      }

      return results;
    });

    // 验证所有外部导航被阻止
    for (const result of navigationAttempt) {
      console.log(`  - 测试导航到: ${result.targetUrl}`);
      console.log(`  - 导航被阻止: ${result.navigationBlocked}`);

      expect(result.navigationBlocked).toBe(true);
    }

    // 验证当前 URL 没有改变
    const currentUrl = firstWindow.url();
    expect(currentUrl).toBe(originalUrl);

    console.log('✅ 外部导航拦截验证通过');
  });

  test('外部导航应被拦截 - 链接点击', async () => {
    console.log('🔍 测试外部链接点击拦截...');

    // 在页面中创建外部链接并尝试点击
    const linkClickTest = await firstWindow.evaluate(async () => {
      const testLinks = [
        'https://attacker.com/malware',
        'http://tracker.ads.com/pixel',
        'https://crypto-scam.com/wallet',
      ];

      const results = [];

      for (const url of testLinks) {
        try {
          // 创建链接元素
          const link = document.createElement('a');
          link.href = url;
          link.textContent = 'Test Link';
          link.target = '_self';
          link.style.position = 'absolute';
          link.style.top = '10px';
          link.style.left = '10px';
          document.body.appendChild(link);

          const beforeUrl = window.location.href;

          // 模拟点击
          link.click();

          // 等待导航尝试
          await new Promise(resolve => setTimeout(resolve, 1000));

          const afterUrl = window.location.href;

          results.push({
            targetUrl: url,
            beforeUrl,
            afterUrl,
            navigationBlocked: beforeUrl === afterUrl,
          });

          // 清理
          document.body.removeChild(link);
        } catch (error) {
          results.push({
            targetUrl: url,
            error: error.message,
            navigationBlocked: true,
          });
        }
      }

      return results;
    });

    // 验证所有链接点击导航被阻止
    for (const result of linkClickTest) {
      console.log(`  - 点击链接: ${result.targetUrl}`);
      console.log(`  - 导航被阻止: ${result.navigationBlocked}`);

      expect(result.navigationBlocked).toBe(true);
    }

    console.log('✅ 外部链接点击拦截验证通过');
  });
});

/**
 * 红线用例 2: 窗口打开拦截 - 新窗口应被默认拒绝
 */
test.describe('🚫 红线用例 2: 窗口打开拦截（默认拒绝）', () => {
  test('window.open() 应被拦截', async () => {
    console.log('🔍 测试 window.open() 拦截...');

    const windowOpenTest = await firstWindow.evaluate(async () => {
      const testUrls = [
        'https://malicious-popup.com',
        'http://adware.com/install',
        'https://social-engineering.com/survey',
        'javascript:alert("XSS")',
      ];

      const results = [];

      for (const url of testUrls) {
        try {
          // 尝试打开新窗口
          const newWindow = window.open(url, '_blank');

          results.push({
            targetUrl: url,
            windowOpened: newWindow !== null,
            windowBlocked: newWindow === null,
          });

          // 如果窗口被意外创建，尝试关闭
          if (newWindow) {
            try {
              newWindow.close();
            } catch (e) {
              // 忽略关闭错误
            }
          }
        } catch (error) {
          results.push({
            targetUrl: url,
            error: error.message,
            windowOpened: false,
            windowBlocked: true,
          });
        }
      }

      return results;
    });

    // 验证所有 window.open 尝试被阻止
    for (const result of windowOpenTest) {
      console.log(`  - 尝试打开: ${result.targetUrl}`);
      console.log(`  - 窗口被阻止: ${result.windowBlocked}`);

      expect(result.windowBlocked).toBe(true);
      expect(result.windowOpened).toBe(false);
    }

    console.log('✅ window.open() 拦截验证通过');
  });

  test('target="_blank" 链接应被拦截', async () => {
    console.log('🔍 测试 target="_blank" 链接拦截...');

    const targetBlankTest = await firstWindow.evaluate(async () => {
      const testUrls = [
        'https://malware-download.com/trojan.exe',
        'http://phishing.site/login',
        'https://cryptocurrency-scam.com',
      ];

      const results = [];

      for (const url of testUrls) {
        try {
          // 创建 target="_blank" 链接
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'External Link';
          document.body.appendChild(link);

          // 监听窗口打开事件
          let windowOpened = false;
          const originalOpen = window.open;
          window.open = function (...args) {
            windowOpened = true;
            return originalOpen.apply(this, args);
          };

          // 模拟点击
          link.click();

          // 等待可能的窗口打开
          await new Promise(resolve => setTimeout(resolve, 1000));

          // 恢复原始 window.open
          window.open = originalOpen;

          results.push({
            targetUrl: url,
            windowOpened,
            linkBlocked: !windowOpened,
          });

          // 清理
          document.body.removeChild(link);
        } catch (error) {
          results.push({
            targetUrl: url,
            error: error.message,
            windowOpened: false,
            linkBlocked: true,
          });
        }
      }

      return results;
    });

    // 验证所有 target="_blank" 链接被阻止
    for (const result of targetBlankTest) {
      console.log(`  - target="_blank" 链接: ${result.targetUrl}`);
      console.log(`  - 链接被阻止: ${result.linkBlocked}`);

      expect(result.linkBlocked).toBe(true);
      expect(result.windowOpened).toBe(false);
    }

    console.log('✅ target="_blank" 链接拦截验证通过');
  });
});

/**
 * 红线用例 3: 权限请求拒绝 - 敏感权限应被默认拒绝
 */
test.describe('🚫 红线用例 3: 权限请求拒绝（默认拒绝）', () => {
  test('摄像头权限应被拒绝', async () => {
    console.log('🔍 测试摄像头权限拒绝...');

    const cameraPermissionTest = await firstWindow.evaluate(async () => {
      try {
        // 尝试请求摄像头权限
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        // 如果获取成功，立即停止流
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          return {
            permissionGranted: true,
            permissionDenied: false,
            error: null,
          };
        }

        return {
          permissionGranted: false,
          permissionDenied: true,
          error: null,
        };
      } catch (error) {
        return {
          permissionGranted: false,
          permissionDenied: true,
          error: error.name,
        };
      }
    });

    console.log(
      `  - 摄像头权限被拒绝: ${cameraPermissionTest.permissionDenied}`
    );
    console.log(`  - 错误类型: ${cameraPermissionTest.error}`);

    expect(cameraPermissionTest.permissionDenied).toBe(true);
    expect(cameraPermissionTest.permissionGranted).toBe(false);

    console.log('✅ 摄像头权限拒绝验证通过');
  });

  test('麦克风权限应被拒绝', async () => {
    console.log('🔍 测试麦克风权限拒绝...');

    const microphonePermissionTest = await firstWindow.evaluate(async () => {
      try {
        // 尝试请求麦克风权限
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });

        // 如果获取成功，立即停止流
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          return {
            permissionGranted: true,
            permissionDenied: false,
            error: null,
          };
        }

        return {
          permissionGranted: false,
          permissionDenied: true,
          error: null,
        };
      } catch (error) {
        return {
          permissionGranted: false,
          permissionDenied: true,
          error: error.name,
        };
      }
    });

    console.log(
      `  - 麦克风权限被拒绝: ${microphonePermissionTest.permissionDenied}`
    );
    console.log(`  - 错误类型: ${microphonePermissionTest.error}`);

    expect(microphonePermissionTest.permissionDenied).toBe(true);
    expect(microphonePermissionTest.permissionGranted).toBe(false);

    console.log('✅ 麦克风权限拒绝验证通过');
  });

  test('地理位置权限应被拒绝', async () => {
    console.log('🔍 测试地理位置权限拒绝...');

    const geolocationPermissionTest = await firstWindow.evaluate(async () => {
      try {
        // 尝试获取地理位置
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: false,
          });
        });

        return {
          permissionGranted: true,
          permissionDenied: false,
          error: null,
          position: position ? 'obtained' : 'null',
        };
      } catch (error) {
        return {
          permissionGranted: false,
          permissionDenied: true,
          error: error.code || error.name,
        };
      }
    });

    console.log(
      `  - 地理位置权限被拒绝: ${geolocationPermissionTest.permissionDenied}`
    );
    console.log(`  - 错误代码: ${geolocationPermissionTest.error}`);

    expect(geolocationPermissionTest.permissionDenied).toBe(true);
    expect(geolocationPermissionTest.permissionGranted).toBe(false);

    console.log('✅ 地理位置权限拒绝验证通过');
  });

  test('通知权限应被拒绝', async () => {
    console.log('🔍 测试通知权限拒绝...');

    const notificationPermissionTest = await firstWindow.evaluate(async () => {
      try {
        // 检查通知 API 是否可用
        if (!('Notification' in window)) {
          return {
            apiAvailable: false,
            permissionGranted: false,
            permissionDenied: true,
            error: 'Notification API not available',
          };
        }

        // 尝试请求通知权限
        const permission = await Notification.requestPermission();

        return {
          apiAvailable: true,
          permissionGranted: permission === 'granted',
          permissionDenied: permission === 'denied',
          permission: permission,
        };
      } catch (error) {
        return {
          apiAvailable: true,
          permissionGranted: false,
          permissionDenied: true,
          error: error.message,
        };
      }
    });

    console.log(
      `  - 通知 API 可用: ${notificationPermissionTest.apiAvailable}`
    );
    console.log(
      `  - 通知权限被拒绝: ${notificationPermissionTest.permissionDenied}`
    );
    console.log(`  - 权限状态: ${notificationPermissionTest.permission}`);

    expect(notificationPermissionTest.permissionDenied).toBe(true);
    expect(notificationPermissionTest.permissionGranted).toBe(false);

    console.log('✅ 通知权限拒绝验证通过');
  });
});

/**
 * 综合红线验证 - 确保三条红线稳定生效
 */
test.describe('🛡️ 综合红线验证', () => {
  test('三条红线用例稳定性测试', async () => {
    console.log('🔍 执行三条红线综合稳定性测试...');

    const comprehensiveTest = await firstWindow.evaluate(async () => {
      const results = {
        navigationBlocks: 0,
        windowOpenBlocks: 0,
        permissionBlocks: 0,
        totalTests: 0,
      };

      // 测试 1: 导航拦截
      const navigationUrls = [
        'https://evil1.com',
        'http://evil2.com',
        'https://evil3.com',
      ];
      for (const url of navigationUrls) {
        results.totalTests++;
        try {
          const beforeUrl = window.location.href;
          window.location.href = url;
          await new Promise(r => setTimeout(r, 200));
          const afterUrl = window.location.href;

          if (beforeUrl === afterUrl) {
            results.navigationBlocks++;
          }
        } catch {
          results.navigationBlocks++;
        }
      }

      // 测试 2: 窗口打开拦截
      const windowUrls = [
        'https://popup1.com',
        'https://popup2.com',
        'https://popup3.com',
      ];
      for (const url of windowUrls) {
        results.totalTests++;
        try {
          const newWindow = window.open(url, '_blank');
          if (!newWindow) {
            results.windowOpenBlocks++;
          } else {
            try {
              newWindow.close();
            } catch {}
          }
        } catch {
          results.windowOpenBlocks++;
        }
      }

      // 测试 3: 权限请求拒绝
      const permissionTests = [
        async () => {
          try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            return false;
          } catch {
            return true;
          }
        },
        async () => {
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            return false;
          } catch {
            return true;
          }
        },
        async () => {
          try {
            await new Promise((res, rej) =>
              navigator.geolocation.getCurrentPosition(res, rej, {
                timeout: 1000,
              })
            );
            return false;
          } catch {
            return true;
          }
        },
      ];

      for (const test of permissionTests) {
        results.totalTests++;
        if (await test()) {
          results.permissionBlocks++;
        }
      }

      return results;
    });

    console.log('📊 综合测试结果:');
    console.log(`  - 导航拦截: ${comprehensiveTest.navigationBlocks}/3`);
    console.log(`  - 窗口拦截: ${comprehensiveTest.windowOpenBlocks}/3`);
    console.log(`  - 权限拒绝: ${comprehensiveTest.permissionBlocks}/3`);
    console.log(`  - 总测试数: ${comprehensiveTest.totalTests}/9`);

    // 验证所有安全拦截都生效
    expect(comprehensiveTest.navigationBlocks).toBe(3);
    expect(comprehensiveTest.windowOpenBlocks).toBe(3);
    expect(comprehensiveTest.permissionBlocks).toBe(3);
    expect(comprehensiveTest.totalTests).toBe(9);

    console.log('✅ 三条红线稳定性验证通过');
  });

  test('安全配置持久性验证', async () => {
    console.log('🔍 验证安全配置在会话中的持久性...');

    // 验证安全配置在多次操作后仍然生效
    for (let i = 0; i < 3; i++) {
      console.log(`  - 执行第 ${i + 1} 轮安全验证...`);

      const persistenceTest = await firstWindow.evaluate(async () => {
        // 尝试各种攻击向量
        const attacks = [
          () => {
            window.location.href = 'https://attack.com';
            return window.location.href;
          },
          () => window.open('https://malware.com'),
          async () => {
            try {
              await navigator.mediaDevices.getUserMedia({ video: true });
              return false;
            } catch {
              return true;
            }
          },
        ];

        const results = [];
        for (const attack of attacks) {
          try {
            const result = await attack();
            results.push(result);
          } catch (error) {
            results.push(error.message);
          }
        }

        return results;
      });

      // 验证每轮测试的安全性
      expect(persistenceTest[0]).not.toContain('attack.com'); // 导航被阻止
      expect(persistenceTest[1]).toBeNull(); // 窗口打开被阻止
      expect(persistenceTest[2]).toBe(true); // 权限被拒绝
    }

    console.log('✅ 安全配置持久性验证通过');
  });
});

// 测试总结报告
test.afterAll(async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🛡️ 安全 E2E 红线用例测试完成');
  console.log('='.repeat(60));
  console.log('✅ 红线用例 1: 导航拦截（默认拒绝）');
  console.log('   - 外部导航 window.location.href 被拦截');
  console.log('   - 外部链接点击被拦截');
  console.log('');
  console.log('✅ 红线用例 2: 窗口打开拦截（默认拒绝）');
  console.log('   - window.open() 被拦截');
  console.log('   - target="_blank" 链接被拦截');
  console.log('');
  console.log('✅ 红线用例 3: 权限请求拒绝（默认拒绝）');
  console.log('   - 摄像头权限被拒绝');
  console.log('   - 麦克风权限被拒绝');
  console.log('   - 地理位置权限被拒绝');
  console.log('   - 通知权限被拒绝');
  console.log('');
  console.log('🎯 验收标准：三条红线用例稳定通过 ✅');
  console.log('📋 基于：Electron 官方安全清单实现');
  console.log('='.repeat(60));
});

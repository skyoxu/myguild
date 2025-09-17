/**
 * Electron安全基线端到端测试
 * 对应文档：02-安全基线(Electron)-v2.md - 2.7 自动化验证
 * 引用ADR: ADR-0002 (Electron安全基线), ADR-0005 (质量门禁)
 *
 * 本测试套件验证Electron应用的安全配置是否符合基线要求，
 * 包括进程隔离、CSP策略、Context Bridge API、IPC白名单等关键安全措施。
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { launchApp } from '../helpers/launch';
import type {
  PreloadExposedApi,
  SecurityViolation,
  CspViolationReport,
} from '@/shared/contracts/security';

// 测试配置
const TEST_TIMEOUT = 30000; // 30秒超时
const APP_START_TIMEOUT = 10000; // 应用启动超时

// 扩展Window类型以包含暴露的API
interface WindowWithSecureApi extends Window {
  readonly electronApi?: PreloadExposedApi;
}

test.describe('Electron安全基线验证套件', () => {
  let app: ElectronApplication;
  let page: Page;
  let consoleMessages: string[] = [];
  let consoleErrors: string[] = [];

  test.beforeAll(async () => {
    // 清理之前可能存在的进程
    try {
      await app?.close();
    } catch {
      // 忽略清理错误
    }

    // 启动Electron应用
    app = await launchApp();

    // 监听应用控制台输出
    app.on('console', message => {
      const text = message.text();
      consoleMessages.push(text);

      if (message.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // 获取第一个窗口
    page = await app.firstWindow();

    // 设置页面事件监听
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(`[PAGE] ${text}`);

      if (msg.type() === 'error') {
        consoleErrors.push(`[PAGE] ${text}`);
      }
    });

    // 监听页面错误
    page.on('pageerror', error => {
      consoleErrors.push(`[PAGE ERROR] ${error.message}`);
    });

    // 等待页面加载完成
    await page.waitForLoadState('domcontentloaded', { timeout: TEST_TIMEOUT });
  });

  test.afterAll(async () => {
    // 清理资源
    if (app) {
      await app.close();
    }
  });

  test.beforeEach(() => {
    // 每个测试前清理消息数组
    consoleMessages = [];
    consoleErrors = [];
  });

  // =============================================================================
  // 基础应用启动和可见性测试
  // =============================================================================

  test('应用成功启动且主窗口可见', async () => {
    // 验证窗口不为空
    expect(page).toBeTruthy();

    // 验证窗口可见
    const isVisible = await page.isVisible('body');
    expect(isVisible).toBe(true);

    // 验证页面标题包含应用名称（使用占位符）
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);

    // 验证没有关键启动错误
    const criticalErrors = consoleErrors.filter(
      error =>
        error.toLowerCase().includes('failed to load') ||
        error.toLowerCase().includes('uncaught exception')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // =============================================================================
  // Context Bridge API安全验证
  // =============================================================================

  test('Context Bridge API正确暴露且类型安全', async () => {
    // 检查安全API是否正确暴露
    const apiAvailable = await page.evaluate(() => {
      const w = window as WindowWithSecureApi;
      return typeof w.electronApi !== 'undefined';
    });
    expect(apiAvailable).toBe(true);

    // 验证API结构完整性
    const apiStructure = await page.evaluate(() => {
      const w = window as WindowWithSecureApi;
      const api = w.electronApi;

      if (!api) return null;

      return {
        hasApp: typeof api.app === 'object',
        hasGame: typeof api.game === 'object',
        hasTelemetry: typeof api.telemetry === 'object',
        hasSecurity: typeof api.security === 'object',

        // 检查app模块方法
        hasGetVersion: typeof api.app?.getVersion === 'function',
        hasGetPlatform: typeof api.app?.getPlatform === 'function',
        hasGetLocale: typeof api.app?.getLocale === 'function',

        // 检查game模块方法
        hasSave: typeof api.game?.save === 'function',
        hasLoad: typeof api.game?.load === 'function',

        // 检查telemetry模块方法
        hasTrack: typeof api.telemetry?.track === 'function',
        hasFlush: typeof api.telemetry?.flush === 'function',

        // 检查security模块方法
        hasReportViolation: typeof api.security?.reportViolation === 'function',
        hasGetSecurityStatus:
          typeof api.security?.getSecurityStatus === 'function',
      };
    });

    expect(apiStructure).toBeTruthy();
    expect(apiStructure?.hasApp).toBe(true);
    expect(apiStructure?.hasGame).toBe(true);
    expect(apiStructure?.hasTelemetry).toBe(true);
    expect(apiStructure?.hasSecurity).toBe(true);
    expect(apiStructure?.hasGetVersion).toBe(true);
    expect(apiStructure?.hasSave).toBe(true);
    expect(apiStructure?.hasTrack).toBe(true);
    expect(apiStructure?.hasReportViolation).toBe(true);
  });

  test('IPC白名单机制工作正常', async () => {
    // 测试允许的IPC调用 - app:getVersion
    const versionCall = await page.evaluate(async () => {
      try {
        const w = window as WindowWithSecureApi;
        const api = w.electronApi;
        if (!api) throw new Error('API not available');

        const version = await api.app.getVersion();
        return { success: true, result: version, error: null };
      } catch (error) {
        return {
          success: false,
          result: null,
          error: (error as Error).message,
        };
      }
    });

    expect(versionCall.success).toBe(true);
    expect(typeof versionCall.result).toBe('string');
    expect(versionCall.result).toBeTruthy();

    // 测试允许的IPC调用 - app:getPlatform
    const platformCall = await page.evaluate(async () => {
      try {
        const w = window as WindowWithSecureApi;
        const api = w.electronApi;
        if (!api) throw new Error('API not available');

        const platform = await api.app.getPlatform();
        return { success: true, result: platform, error: null };
      } catch (error) {
        return {
          success: false,
          result: null,
          error: (error as Error).message,
        };
      }
    });

    expect(platformCall.success).toBe(true);
    expect(typeof platformCall.result).toBe('string');
    expect(['win32', 'darwin', 'linux']).toContain(platformCall.result);
  });

  // =============================================================================
  // CSP (Content Security Policy) 验证
  // =============================================================================

  test('CSP策略正确设置且包含必需指令', async () => {
    // 检查CSP meta标签存在
    const cspMeta = await page.$('meta[http-equiv="Content-Security-Policy"]');
    expect(cspMeta).toBeTruthy();

    // 获取CSP内容并验证关键指令
    const cspContent = await page.evaluate(() => {
      const meta = document.querySelector(
        'meta[http-equiv="Content-Security-Policy"]'
      );
      return meta?.getAttribute('content') || '';
    });

    expect(cspContent).toBeTruthy();

    // 验证关键CSP指令
    const requiredDirectives = [
      "default-src 'none'",
      "object-src 'none'",
      "child-src 'none'",
      "frame-src 'none'",
    ];

    requiredDirectives.forEach(directive => {
      expect(cspContent).toContain(directive);
    });

    // 在生产环境验证额外的安全指令
    const isProduction = await page.evaluate(
      () => process?.env?.NODE_ENV === 'production'
    );

    if (isProduction) {
      expect(cspContent).toContain('upgrade-insecure-requests');
      expect(cspContent).toContain('block-all-mixed-content');
    }
  });

  test('CSP有效阻止内联脚本执行', async () => {
    const errorsBefore = [...consoleErrors];

    // 尝试注入内联脚本（应该被CSP阻止）
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent =
        'window.maliciousInjection = true; console.log("MALICIOUS_CODE_EXECUTED");';
      document.head.appendChild(script);
    });

    // 等待可能的错误出现
    await page.waitForTimeout(1000);

    // 验证恶意代码未执行
    const maliciousCodeExists = await page.evaluate(() => {
      return typeof (window as any).maliciousInjection !== 'undefined';
    });
    expect(maliciousCodeExists).toBe(false);

    // 验证控制台中没有恶意代码执行的日志
    const maliciousLog = consoleMessages.some(msg =>
      msg.includes('MALICIOUS_CODE_EXECUTED')
    );
    expect(maliciousLog).toBe(false);

    // 验证CSP违规错误出现
    const newErrors = consoleErrors.slice(errorsBefore.length);
    const cspError = newErrors.some(
      error =>
        error.toLowerCase().includes('content security policy') ||
        error.toLowerCase().includes('refused to execute inline script')
    );
    expect(cspError).toBe(true);
  });

  test('CSP阻止不安全的资源加载', async () => {
    const errorsBefore = [...consoleErrors];

    // 尝试加载外部不安全资源
    await page.evaluate(() => {
      // 尝试加载外部脚本
      const script = document.createElement('script');
      script.src = 'http://malicious-site.com/malicious.js';
      document.head.appendChild(script);

      // 尝试设置不安全的iframe
      const iframe = document.createElement('iframe');
      iframe.src = 'http://malicious-site.com/frame';
      document.body.appendChild(iframe);
    });

    // 等待CSP违规错误
    await page.waitForTimeout(2000);

    // 验证CSP违规错误被记录
    const newErrors = consoleErrors.slice(errorsBefore.length);
    const resourceBlocked = newErrors.some(
      error =>
        error.toLowerCase().includes('content security policy') ||
        error.toLowerCase().includes('refused to load') ||
        error.toLowerCase().includes('blocked')
    );
    expect(resourceBlocked).toBe(true);
  });

  // =============================================================================
  // Node.js API隔离验证
  // =============================================================================

  test('Node.js API在渲染进程中完全不可访问', async () => {
    const nodeApis = await page.evaluate(() => {
      return {
        // 核心Node.js全局变量
        require: typeof require,
        process: typeof process,
        global: typeof global,
        Buffer: typeof Buffer,
        __dirname: typeof __dirname,
        __filename: typeof __filename,

        // Node.js模块系统
        module: typeof module,
        exports: typeof exports,

        // 检查是否能访问敏感Node.js API
        canAccessFS: (() => {
          try {
            return typeof (globalThis as any).require?.('fs') !== 'undefined';
          } catch {
            return false;
          }
        })(),

        canAccessChild: (() => {
          try {
            return (
              typeof (globalThis as any).require?.('child_process') !==
              'undefined'
            );
          } catch {
            return false;
          }
        })(),
      };
    });

    // 验证所有Node.js API都不可访问
    expect(nodeApis.require).toBe('undefined');
    expect(nodeApis.global).toBe('undefined');
    expect(nodeApis.Buffer).toBe('undefined');
    expect(nodeApis.__dirname).toBe('undefined');
    expect(nodeApis.__filename).toBe('undefined');
    expect(nodeApis.module).toBe('undefined');
    expect(nodeApis.exports).toBe('undefined');

    // 验证无法访问敏感模块
    expect(nodeApis.canAccessFS).toBe(false);
    expect(nodeApis.canAccessChild).toBe(false);

    // process对象可能在某些情况下部分可用（但应该是受限的）
    // 这里检查不应该有完整的Node.js process对象
    if (nodeApis.process !== 'undefined') {
      const processInfo = await page.evaluate(() => {
        const p = (globalThis as any).process;
        return {
          hasExit: typeof p?.exit === 'function',
          hasKill: typeof p?.kill === 'function',
          hasCwd: typeof p?.cwd === 'function',
        };
      });

      // 即使process存在，关键方法也应该不可访问
      expect(processInfo.hasExit).toBe(false);
      expect(processInfo.hasKill).toBe(false);
      expect(processInfo.hasCwd).toBe(false);
    }
  });

  // =============================================================================
  // 导航和弹窗安全验证
  // =============================================================================

  test('外部导航被正确阻止', async () => {
    const originalUrl = await page.url();

    // 尝试导航到外部恶意URL
    const navigationResult = await page.evaluate(() => {
      const originalHref = window.location.href;

      try {
        // 尝试直接设置location
        window.location.href = 'https://malicious-site.com/phishing';

        // 检查是否真的导航了
        return {
          navigated: window.location.href !== originalHref,
          currentHref: window.location.href,
          originalHref: originalHref,
        };
      } catch (error) {
        return {
          navigated: false,
          error: (error as Error).message,
          currentHref: window.location.href,
          originalHref: originalHref,
        };
      }
    });

    // 验证导航被阻止
    expect(navigationResult.navigated).toBe(false);
    expect(navigationResult.currentHref).toBe(navigationResult.originalHref);

    // 验证当前URL没有改变
    const currentUrl = await page.url();
    expect(currentUrl).toBe(originalUrl);
  });

  test('新窗口和弹窗创建被阻止', async () => {
    const windowOpenResults = await page.evaluate(() => {
      const results = [];

      // 尝试多种方式打开新窗口
      const testCases = [
        { url: 'https://example.com', target: '_blank' },
        { url: 'javascript:alert("xss")', target: '_self' },
        { url: 'about:blank', target: '_blank' },
        { url: 'https://malicious-site.com', target: '_blank' },
      ];

      testCases.forEach(({ url, target }) => {
        try {
          const newWindow = window.open(url, target);
          results.push({
            url,
            target,
            blocked: newWindow === null,
            error: null,
          });
        } catch (error) {
          results.push({
            url,
            target,
            blocked: true,
            error: (error as Error).message,
          });
        }
      });

      return results;
    });

    // 验证所有新窗口创建尝试都被阻止
    windowOpenResults.forEach(result => {
      expect(result.blocked).toBe(true);
    });

    // 确保至少有一个测试用例
    expect(windowOpenResults.length).toBeGreaterThan(0);
  });

  // =============================================================================
  // 安全违规报告机制验证
  // =============================================================================

  test('安全违规报告功能正常工作', async () => {
    const testViolation: SecurityViolation = {
      type: 'unsafe-script-execution',
      severity: 'high',
      description: 'Test security violation for E2E testing',
      details: {
        testId: 'e2e-security-test',
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      },
      timestamp: Date.now(),
      url: window.location.href,
    };

    const reportResult = await page.evaluate(async violation => {
      try {
        const w = window as WindowWithSecureApi;
        const api = w.electronApi;
        if (!api) throw new Error('Security API not available');

        await api.security.reportViolation(violation);
        return { success: true, error: null };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }, testViolation);

    expect(reportResult.success).toBe(true);
    expect(reportResult.error).toBeNull();
  });

  test('安全状态查询功能正常', async () => {
    const statusResult = await page.evaluate(async () => {
      try {
        const w = window as WindowWithSecureApi;
        const api = w.electronApi;
        if (!api) throw new Error('Security API not available');

        const status = await api.security.getSecurityStatus();
        return { success: true, status, error: null };
      } catch (error) {
        return {
          success: false,
          status: null,
          error: (error as Error).message,
        };
      }
    });

    expect(statusResult.success).toBe(true);
    expect(statusResult.status).toBeTruthy();
    expect(typeof statusResult.status.secure).toBe('boolean');
    expect(typeof statusResult.status.violations).toBe('number');
  });

  // =============================================================================
  // 综合安全验证
  // =============================================================================

  test('应用整体安全配置符合基线要求', async () => {
    // 收集所有安全相关信息
    const securitySummary = await page.evaluate(() => {
      const w = window as WindowWithSecureApi;

      return {
        // Context Bridge检查
        hasSecureApi: typeof w.electronApi !== 'undefined',

        // CSP检查
        hasCsp: !!document.querySelector(
          'meta[http-equiv="Content-Security-Policy"]'
        ),

        // Node.js隔离检查
        nodeIsolated:
          typeof require === 'undefined' &&
          typeof process === 'undefined' &&
          typeof global === 'undefined',

        // 全局污染检查
        globalClean:
          typeof (w as any).require === 'undefined' &&
          typeof (w as any).global === 'undefined' &&
          typeof (w as any).Buffer === 'undefined',

        // 检查是否有意外的全局变量
        unexpectedGlobals: Object.keys(w).filter(
          key =>
            key.startsWith('__') ||
            key.includes('node') ||
            (key.includes('electron') && key !== 'electronApi')
        ).length,

        // 安全上下文检查
        isSecureContext: w.isSecureContext,

        // Location协议检查
        protocolSecure:
          w.location.protocol === 'file:' || w.location.protocol === 'https:',
      };
    });

    // 验证所有安全要求
    expect(securitySummary.hasSecureApi).toBe(true);
    expect(securitySummary.hasCsp).toBe(true);
    expect(securitySummary.nodeIsolated).toBe(true);
    expect(securitySummary.globalClean).toBe(true);
    expect(securitySummary.unexpectedGlobals).toBe(0);
    expect(securitySummary.protocolSecure).toBe(true);

    // 验证没有严重的控制台错误
    const criticalErrors = consoleErrors.filter(
      error =>
        error.toLowerCase().includes('uncaught') ||
        error.toLowerCase().includes('failed to load main script') ||
        error.toLowerCase().includes('security')
    );

    // 允许一些CSP违规错误（这是我们期望的）
    const nonCspErrors = criticalErrors.filter(
      error =>
        !error.toLowerCase().includes('content security policy') &&
        !error.toLowerCase().includes('refused to execute')
    );

    expect(nonCspErrors).toHaveLength(0);
  });

  // =============================================================================
  // 性能和稳定性验证
  // =============================================================================

  test('安全配置不影响应用基本性能', async () => {
    const startTime = Date.now();

    // 执行一系列基本操作
    await page.evaluate(async () => {
      const w = window as WindowWithSecureApi;
      const api = w.electronApi;

      if (api) {
        // 快速连续调用多个API
        await Promise.all([
          api.app.getVersion(),
          api.app.getPlatform(),
          api.app.getLocale(),
          api.security.getSecurityStatus(),
        ]);
      }
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 验证操作在合理时间内完成（不应超过5秒）
    expect(duration).toBeLessThan(5000);

    // 验证页面仍然响应
    const isResponsive = await page.evaluate(() => {
      return document.readyState === 'complete';
    });
    expect(isResponsive).toBe(true);
  });
});

// =============================================================================
// 辅助类型定义（与主文档保持一致）
// =============================================================================

interface PreloadExposedApi {
  readonly app: {
    readonly getVersion: () => Promise<string>;
    readonly getPlatform: () => Promise<NodeJS.Platform>;
    readonly getLocale: () => Promise<string>;
  };

  readonly game: {
    readonly save: (
      data: unknown
    ) => Promise<{ success: boolean; error?: string }>;
    readonly load: () => Promise<{
      data: unknown;
      success: boolean;
      error?: string;
    }>;
  };

  readonly telemetry: {
    readonly track: (
      event: string,
      properties?: Record<string, unknown>
    ) => Promise<void>;
    readonly flush: () => Promise<void>;
  };

  readonly security: {
    readonly reportViolation: (violation: SecurityViolation) => Promise<void>;
    readonly getSecurityStatus: () => Promise<{
      secure: boolean;
      violations: number;
    }>;
  };
}

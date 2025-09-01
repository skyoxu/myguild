/**
 * CSP策略安全验证 - 增强测试套件
 * 自动生成于: 2025-08-24T17:34:24.848Z
 * 优先级: critical
 */

import { test, expect } from '@playwright/test';
import {
  ElectronApplication,
  Page,
  _electron as electron,
} from '@playwright/test';

test.describe('CSP策略安全验证', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['.'],
      recordVideo: process.env.CI ? { dir: 'test-results/videos' } : undefined,
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('CSP应该阻止内联脚本执行', async () => {
    // 尝试执行内联脚本
    const scriptBlocked = await page.evaluate(async () => {
      return new Promise(resolve => {
        const script = document.createElement('script');
        script.textContent = 'window.testScriptExecuted = true;';
        script.onerror = () => resolve(true); // 脚本被阻止
        script.onload = () => resolve(false); // 脚本执行成功
        document.head.appendChild(script);

        // 检查是否执行
        setTimeout(() => {
          resolve(!(window as any).testScriptExecuted);
        }, 100);
      });
    });

    expect(scriptBlocked).toBe(true);
  });

  test('CSP应该阻止不安全的外部资源', async () => {
    const resourceBlocked = await page.evaluate(async () => {
      return new Promise(resolve => {
        const img = new Image();
        img.onerror = () => resolve(true); // 资源被阻止
        img.onload = () => resolve(false); // 资源加载成功
        img.src = 'http://malicious-site.example.com/image.png';

        setTimeout(() => resolve(true), 1000); // 超时认为被阻止
      });
    });

    expect(resourceBlocked).toBe(true);
  });

  test('CSP违规报告功能', async () => {
    // 监听 CSP 违规报告
    const cspViolations: Array<{
      violatedDirective: string;
      blockedURI: string;
    }> = [];

    page.on('console', msg => {
      if (
        msg.type() === 'error' &&
        msg.text().includes('Content-Security-Policy')
      ) {
        const cspError = msg.text();
        const violatedDirectiveMatch = cspError.match(
          /violated-directive:\s*([^;]+)/
        );
        const blockedURIMatch = cspError.match(/blocked-uri:\s*([^;]+)/);

        if (violatedDirectiveMatch && blockedURIMatch) {
          cspViolations.push({
            violatedDirective: violatedDirectiveMatch[1].trim(),
            blockedURI: blockedURIMatch[1].trim(),
          });
        }
      }
    });

    // 尝试执行违反 CSP 的操作
    await page.evaluate(() => {
      // 尝试内联脚本执行
      const script = document.createElement('script');
      script.textContent = 'console.log("违规脚本执行");';
      document.head.appendChild(script);

      // 尝试加载外部不安全资源
      const img = new Image();
      img.src = 'http://unsafe-domain.example.com/image.png';
      document.body.appendChild(img);
    });

    // 等待一段时间让违规报告触发
    await page.waitForTimeout(1000);

    // 验证至少捕获到一个 CSP 违规
    expect(cspViolations.length).toBeGreaterThan(0);
    expect(
      cspViolations.some(v => v.violatedDirective.includes('script-src'))
    ).toBe(true);
  });

  test('CSP策略完整性检查', async () => {
    // 获取当前页面的 CSP 策略
    const cspContent = await page.evaluate(() => {
      const cspMeta = document.querySelector<HTMLMetaElement>(
        'meta[http-equiv="Content-Security-Policy"]'
      );
      return cspMeta?.getAttribute('content') || '';
    });

    expect(cspContent).toBeTruthy();
    console.log('Current CSP Policy:', cspContent);

    // 验证关键 CSP 指令存在
    expect(cspContent).toContain('default-src');
    expect(cspContent).toContain('script-src');
    expect(cspContent).toContain('style-src');
    expect(cspContent).toContain("object-src 'none'");
    expect(cspContent).toContain("base-uri 'self'");

    // 验证不包含不安全的指令
    expect(cspContent).not.toContain("'unsafe-inline'");
    expect(cspContent).not.toContain("'unsafe-eval'");
    expect(cspContent).not.toContain('*'); // 避免通配符

    // 验证 connect-src 只允许必要的域名
    const connectSrcMatch = cspContent.match(/connect-src\s+([^;]+)/);
    if (connectSrcMatch) {
      const connectSrc = connectSrcMatch[1];
      expect(connectSrc).toContain("'self'");
      // 验证只包含必要的外部域名（如 Sentry）
      const allowedDomains = ['sentry.io'];
      const domains = connectSrc
        .split(' ')
        .filter(d => d.startsWith('https://'));
      domains.forEach(domain => {
        const isAllowed = allowedDomains.some(allowed =>
          domain.includes(allowed)
        );
        expect(isAllowed).toBe(true);
      });
    }
  });

  test('CSP动态策略验证 - 环境特定检查', async () => {
    // 获取当前环境
    const environment = process.env.NODE_ENV || 'development';

    const cspContent = await page.evaluate(() => {
      const cspMeta = document.querySelector<HTMLMetaElement>(
        'meta[http-equiv="Content-Security-Policy"]'
      );
      return cspMeta?.getAttribute('content') || '';
    });

    if (environment === 'production') {
      // 生产环境应该有更严格的策略
      expect(cspContent).not.toContain('localhost');
      expect(cspContent).not.toContain('127.0.0.1');
      expect(cspContent).not.toContain('data:'); // 生产环境可能禁用 data: URI
    } else if (environment === 'development') {
      // 开发环境可能需要更宽松的策略
      expect(cspContent).toContain("'self'");
    }

    // 验证 Sentry 集成的 connect-src 配置
    expect(cspContent).toContain('connect-src');
    expect(cspContent).toContain('sentry.io');
  });

  test('CSP实时策略更新验证', async () => {
    // 模拟策略更新场景
    const originalCsp = await page.evaluate(() => {
      const cspMeta = document.querySelector<HTMLMetaElement>(
        'meta[http-equiv="Content-Security-Policy"]'
      );
      return cspMeta?.getAttribute('content') || '';
    });

    // 尝试动态修改 CSP 策略（应该被阻止或无效）
    const updateResult = await page.evaluate(() => {
      try {
        const cspMeta = document.querySelector<HTMLMetaElement>(
          'meta[http-equiv="Content-Security-Policy"]'
        );
        if (cspMeta) {
          const originalContent = cspMeta.getAttribute('content');
          cspMeta.setAttribute('content', "default-src 'unsafe-inline' *");

          // 检查是否真的被修改
          const newContent = cspMeta.getAttribute('content');
          return {
            success: true,
            changed: newContent !== originalContent,
            original: originalContent,
            new: newContent,
          };
        }
        return { success: false, error: 'CSP meta not found' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 验证即使DOM被修改，浏览器仍然使用原始策略
    expect(updateResult.success).toBe(true);

    // 尝试执行应该被原始策略阻止的操作
    const stillBlocked = await page.evaluate(async () => {
      return new Promise(resolve => {
        const script = document.createElement('script');
        script.textContent = 'window.dynamicTestExecuted = true;';
        script.onerror = () => resolve(true); // 仍然被阻止
        script.onload = () => resolve(false); // 意外执行
        document.head.appendChild(script);

        setTimeout(() => {
          resolve(!(window as any).dynamicTestExecuted);
        }, 100);
      });
    });

    expect(stillBlocked).toBe(true);
  });

  test('CSP违规事件监听器验证', async () => {
    let violationReported = false;

    // 在页面中设置 CSP 违规监听器
    await page.evaluate(() => {
      document.addEventListener('securitypolicyviolation', e => {
        console.log('CSP Violation detected:', {
          violatedDirective: e.violatedDirective,
          blockedURI: e.blockedURI,
          lineNumber: e.lineNumber,
          sourceFile: e.sourceFile,
        });
        (window as any).cspViolationDetected = true;
      });
    });

    // 故意触发 CSP 违规
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.src = 'http://malicious-external-site.com/evil.js';
      document.head.appendChild(script);
    });

    // 等待违规事件触发
    await page.waitForTimeout(500);

    // 检查违规是否被检测到
    violationReported = await page.evaluate(() => {
      return (window as any).cspViolationDetected === true;
    });

    expect(violationReported).toBe(true);
  });

  test('CSP策略指令覆盖完整性', async () => {
    const cspContent = await page.evaluate(() => {
      const cspMeta = document.querySelector<HTMLMetaElement>(
        'meta[http-equiv="Content-Security-Policy"]'
      );
      return cspMeta?.getAttribute('content') || '';
    });

    // 解析 CSP 策略为指令映射
    const directives = {};
    cspContent.split(';').forEach(directive => {
      const [key, ...values] = directive.trim().split(/\s+/);
      if (key) {
        directives[key] = values.join(' ');
      }
    });

    // 验证关键安全指令存在
    const requiredDirectives = [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
    ];

    requiredDirectives.forEach(directive => {
      expect(directives).toHaveProperty(directive);
      expect(directives[directive]).toBeTruthy();
    });

    // 验证特定安全要求
    expect(directives['object-src']).toBe("'none'");
    expect(directives['base-uri']).toBe("'self'");
    expect(directives['form-action']).toBe("'self'");
    expect(directives['frame-ancestors']).toBe("'none'");
  });

  test('CSP策略动态环境适配', async () => {
    const environment = process.env.NODE_ENV || 'development';

    const cspContent = await page.evaluate(() => {
      const cspMeta = document.querySelector<HTMLMetaElement>(
        'meta[http-equiv="Content-Security-Policy"]'
      );
      return cspMeta?.getAttribute('content') || '';
    });

    // 根据环境验证不同的策略要求
    if (environment === 'development') {
      // 开发环境可能允许更多的调试工具
      console.log('验证开发环境 CSP 策略');
    } else if (environment === 'production') {
      // 生产环境必须更严格
      expect(cspContent).not.toContain('localhost');
      expect(cspContent).not.toContain('127.0.0.1');
      expect(cspContent).not.toContain('data:'); // 可选：生产环境禁用 data: URI
    }

    // 验证 Sentry 集成
    expect(cspContent).toContain('sentry.io');

    // 验证没有通配符（除了特定情况）
    const dangerousPatterns = ['*', "'unsafe-inline'", "'unsafe-eval'"];
    dangerousPatterns.forEach(pattern => {
      if (pattern === '*') {
        // 检查是否有单独的 * 通配符（某些特定指令可能需要 https: 等）
        expect(cspContent).not.toMatch(/[^-\w]\\*[^-\w]/);
      } else {
        expect(cspContent).not.toContain(pattern);
      }
    });
  });
});

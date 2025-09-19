/**
 * 导航行为专项测试
 * 验证：
 * 1. 外部导航阻止 - 不应落到 chrome-error
 * 2. 内部导航允许 - app协议应正常工作
 */

import { test, expect } from '@playwright/test';
import { launchApp } from '../../helpers/launch';

test.describe('导航行为验证', () => {
  test('外部导航阻止 - 不应落到chrome-error', async () => {
    console.log('🚫 测试外部导航阻止行为...');

    const { app: electronApp, page } = await launchApp();
    await page.waitForLoadState('domcontentloaded');

    const originalUrl = page.url();
    console.log(`📋 原始URL: ${originalUrl}`);

    // 监听导航事件
    const navigationPromise = new Promise<{
      navigated: boolean;
      finalUrl?: string;
    }>(resolve => {
      const timeout = setTimeout(() => {
        resolve({ navigated: false });
      }, 3000);

      page.on('framenavigated', () => {
        clearTimeout(timeout);
        resolve({ navigated: true, finalUrl: page.url() });
      });
    });

    // 尝试外部导航
    const result = await page.evaluate(() => {
      try {
        const before = window.location.href;
        window.location.href = 'https://malicious-site.com';
        return { before, after: window.location.href, success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 等待可能的导航
    const navigationResult = await navigationPromise;
    const finalUrl = page.url();

    console.log(`📊 导航测试结果:`);
    console.log(`   - 原始URL: ${originalUrl}`);
    console.log(`   - 最终URL: ${finalUrl}`);
    console.log(`   - 导航发生: ${navigationResult.navigated}`);
    console.log(`   - evaluate结果: ${JSON.stringify(result)}`);

    // 核心断言1: URL不应该变成恶意站点
    expect(finalUrl).not.toContain('malicious-site.com');

    // 核心断言2: 不应该落到chrome-error://
    expect(finalUrl.startsWith('chrome-error://')).toBeFalsy();

    // 核心断言3: 应该保持安全的URL协议（app://）
    expect(finalUrl.startsWith('app://')).toBeTruthy();

    console.log('✅ 外部导航阻止验证通过 - 未落到chrome-error');

    await electronApp.close();
  });

  test('内部导航允许 - app协议应正常工作', async () => {
    console.log('✅ 测试内部导航允许行为...');

    const { app: electronApp, page } = await launchApp();
    await page.waitForLoadState('domcontentloaded');

    const originalUrl = page.url();
    console.log(`📋 原始URL: ${originalUrl}`);

    // 如果当前是file://协议，测试相对路径导航
    if (originalUrl.startsWith('file://')) {
      console.log('🔍 测试file://协议内的相对导航...');

      // 测试锚点导航（页面内导航）
      const anchorResult = await page.evaluate(() => {
        try {
          window.location.hash = '#test-anchor';
          return { success: true, hash: window.location.hash };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      const urlWithAnchor = page.url();
      console.log(`   - 锚点导航结果: ${JSON.stringify(anchorResult)}`);
      console.log(`   - 锚点导航URL: ${urlWithAnchor}`);

      // 验证锚点导航成功
      expect(anchorResult.success).toBeTruthy();
      expect(urlWithAnchor).toContain('#test-anchor');
      expect(urlWithAnchor.startsWith('chrome-error://')).toBeFalsy();
    }

    // 如果支持app://协议，测试app://内部导航
    // 注意：这里可能需要根据实际的app://协议实现来调整
    console.log('🔍 检查是否支持app://协议...');

    const appProtocolTest = await page.evaluate(() => {
      try {
        // 检查是否有app://相关的API或能力
        const hasAppProtocol =
          window.location.protocol === 'app:' ||
          typeof window.electronAPI !== 'undefined';
        return { hasAppProtocol, currentProtocol: window.location.protocol };
      } catch (error) {
        return { hasAppProtocol: false, error: error.message };
      }
    });

    console.log(`   - app协议支持检查: ${JSON.stringify(appProtocolTest)}`);

    // 验证当前协议是安全的
    const currentUrl = page.url();
    expect(currentUrl.startsWith('app://')).toBeTruthy();
    expect(currentUrl.startsWith('chrome-error://')).toBeFalsy();

    console.log('✅ 内部导航允许验证通过 - 协议安全');

    await electronApp.close();
  });

  test('导航行为综合验证', async () => {
    console.log('🔄 综合测试导航行为...');

    const { app: electronApp, page } = await launchApp();
    await page.waitForLoadState('domcontentloaded');

    const results = {
      externalBlocked: false,
      internalAllowed: false,
      noChromError: false,
      protocolSafe: false,
    };

    // 1. 测试外部导航被阻止
    const externalTest = await page.evaluate(() => {
      try {
        const before = window.location.href;
        window.location.href = 'https://evil.com';
        const after = window.location.href;
        return { before, after, blocked: before === after };
      } catch (error) {
        return { blocked: true, error: error.message };
      }
    });

    results.externalBlocked = externalTest.blocked;

    // 2. 测试内部导航被允许
    const internalTest = await page.evaluate(() => {
      try {
        const before = window.location.href;
        window.location.hash = '#internal-test';
        const after = window.location.href;
        return {
          before,
          after,
          allowed: after !== before && after.includes('#internal-test'),
        };
      } catch (error) {
        return { allowed: false, error: error.message };
      }
    });

    results.internalAllowed = internalTest.allowed;

    // 3. 验证没有落到chrome-error://
    const currentUrl = page.url();
    results.noChromError = !currentUrl.startsWith('chrome-error://');

    // 4. 验证协议安全
    results.protocolSafe = currentUrl.startsWith('app://');

    console.log(`📊 综合验证结果:`);
    console.log(`   - 外部导航被阻止: ${results.externalBlocked}`);
    console.log(`   - 内部导航被允许: ${results.internalAllowed}`);
    console.log(`   - 未落到chrome-error: ${results.noChromError}`);
    console.log(`   - 协议安全: ${results.protocolSafe}`);
    console.log(`   - 当前URL: ${currentUrl}`);

    // 核心断言
    expect(results.externalBlocked).toBeTruthy();
    expect(results.internalAllowed).toBeTruthy();
    expect(results.noChromError).toBeTruthy();
    expect(results.protocolSafe).toBeTruthy();

    console.log('✅ 导航行为综合验证通过');

    await electronApp.close();
  });
});

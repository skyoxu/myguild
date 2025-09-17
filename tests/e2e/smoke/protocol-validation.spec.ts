/**
 * 协议验证专项测试 - 验收脚本自检断言
 *
 * 用于第一时间定位"协议/路径是否正确"与"是否误落到 chrome-error://"
 * 按用户要求添加的验收脚本断言
 */

import { test, expect } from '@playwright/test';
import { launchApp } from '../../helpers/launch';

test.describe('协议验证专项测试', () => {
  test('URL协议自检断言 - 验收脚本', async () => {
    console.log('🔍 开始协议验证测试...');

    const { app: electronApp, page } = await launchApp();

    // ✅ 验收脚本：协议/路径自检断言（定位chrome-error://问题）
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();

    console.log(`📋 当前URL: ${url}`);

    // 核心断言：URL必须是file://或app://协议
    expect(url.startsWith('app://')).toBeTruthy();

    // 核心断言：URL不能是chrome-error://
    expect(url.startsWith('chrome-error://')).toBeFalsy();

    // 额外验证：URL应该包含预期的文件路径
    expect(url).toMatch(/\.(html|js)$/);

    console.log('✅ 协议验证断言全部通过');
    console.log(`   - URL协议正确: ${url.split('://')[0]}://`);
    console.log(`   - 非chrome-error: ${!url.startsWith('chrome-error://')}`);
    console.log(`   - 包含文件扩展名: ${/\.(html|js)$/.test(url)}`);

    await electronApp.close();
  });

  test('协议验证 - 应用重启后一致性', async () => {
    console.log('🔄 测试应用重启后协议一致性...');

    // 第一次启动
    const { app: electronApp1, page: page1 } = await launchApp();
    await page1.waitForLoadState('domcontentloaded');
    const url1 = page1.url();
    await electronApp1.close();

    // 第二次启动
    const { app: electronApp2, page: page2 } = await launchApp();
    await page2.waitForLoadState('domcontentloaded');
    const url2 = page2.url();

    // 验证两次启动的URL协议一致
    expect(url1.split('://')[0]).toBe(url2.split('://')[0]);

    // 验证都不是chrome-error://
    expect(url1.startsWith('chrome-error://')).toBeFalsy();
    expect(url2.startsWith('chrome-error://')).toBeFalsy();

    console.log(`✅ 协议一致性验证通过:`);
    console.log(`   - 第一次: ${url1}`);
    console.log(`   - 第二次: ${url2}`);

    await electronApp2.close();
  });
});

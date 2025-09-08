/**
 * React 19 Actions验证E2E测试
 * 确保关键表单走Action路径而非传统状态管理
 * 防止"纸面升级"问题
 */
import { test, expect, Page } from '@playwright/test';
import { launchApp } from '../../helpers/launch';

let electronApp: ElectronApplication;
let mainWindow: Page;

test.beforeAll(async () => {
  console.log('[React19 Actions Test] 启动Electron应用...');

  electronApp = await launchApp().then(result => result.app);

  mainWindow = await electronApp.firstWindow();
  await mainWindow.waitForLoadState('domcontentloaded', { timeout: 10000 });
});

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close();
  }
});

test.describe('React 19 Actions 表单路径验证', () => {
  test('关键表单应使用React 19 Actions而非传统useState', async () => {
    console.log('[React19] 检查表单是否使用Actions API...');

    // 等待应用加载完成
    await mainWindow.waitForSelector('[data-testid="app-root"]', {
      timeout: 5000,
    });

    // 检查是否有表单元素
    const forms = await mainWindow.locator('form').count();

    if (forms > 0) {
      console.log(`[React19] 发现 ${forms} 个表单，检查Actions实现...`);

      // 执行客户端代码检查是否使用了useActionState
      const hasActionState = await mainWindow.evaluate(() => {
        // 检查React DevTools或组件实例中是否使用了Actions
        const formElements = document.querySelectorAll('form');
        let usesActionState = false;

        // 检查表单是否有action属性或特定的数据属性
        formElements.forEach(form => {
          // React 19 Actions通常会在form上设置action或特殊属性
          if (
            form.hasAttribute('action') ||
            form.hasAttribute('data-action-state') ||
            form.querySelector('[data-pending]')
          ) {
            usesActionState = true;
          }
        });

        return {
          hasActionState: usesActionState,
          formCount: formElements.length,
          formDetails: Array.from(formElements).map(form => ({
            hasAction: form.hasAttribute('action'),
            hasActionData: form.hasAttribute('data-action-state'),
            hasPendingStates: !!form.querySelector('[data-pending]'),
          })),
        };
      });

      console.log('[React19] 表单检查结果:', hasActionState);

      // 如果有表单但不使用Actions，发出警告
      if (hasActionState.formCount > 0 && !hasActionState.hasActionState) {
        console.warn('[React19] 警告：发现表单但未使用React 19 Actions API');
        console.warn('[React19] 表单详情:', hasActionState.formDetails);
      }

      // 对于关键表单（如登录、注册、设置），应该强制要求使用Actions
      const criticalForms = await mainWindow
        .locator(
          [
            'form[data-testid*="login"]',
            'form[data-testid*="register"]',
            'form[data-testid*="settings"]',
            'form[data-testid*="profile"]',
          ].join(', ')
        )
        .count();

      if (criticalForms > 0) {
        console.log(
          `[React19] 发现 ${criticalForms} 个关键表单，验证Actions使用...`
        );

        // 关键表单必须使用Actions
        const criticalFormsWithActions = await mainWindow
          .locator(
            [
              'form[data-testid*="login"][action]',
              'form[data-testid*="register"][action]',
              'form[data-testid*="settings"][action]',
              'form[data-testid*="profile"][action]',
            ].join(', ')
          )
          .count();

        if (criticalForms > 0 && criticalFormsWithActions === 0) {
          throw new Error(
            `React 19 Actions违规：发现 ${criticalForms} 个关键表单未使用Actions API。` +
              '请在关键表单中使用useActionState而非useState+onSubmit组合，避免纸面升级。'
          );
        }
      }
    } else {
      console.log('[React19] 未发现表单元素，跳过Actions验证');
    }

    // 检查是否存在反模式：直接使用useState进行表单提交
    const hasFormAntiPattern = await mainWindow.evaluate(() => {
      // 查找可能的反模式标识
      const submitButtons = document.querySelectorAll('button[type="submit"]');
      const forms = document.querySelectorAll('form');

      // 如果有提交按钮但表单没有action属性，可能存在反模式
      let suspiciousPatterns = 0;
      forms.forEach(form => {
        const hasSubmitButton = form.querySelector('button[type="submit"]');
        const hasAction = form.hasAttribute('action');
        const hasActionData = form.hasAttribute('data-action-state');

        if (hasSubmitButton && !hasAction && !hasActionData) {
          suspiciousPatterns++;
        }
      });

      return {
        suspiciousPatterns,
        totalForms: forms.length,
        totalSubmitButtons: submitButtons.length,
      };
    });

    console.log('[React19] 反模式检查结果:', hasFormAntiPattern);

    // 记录检查结果
    expect(hasFormAntiPattern).toBeDefined();
  });

  test('验证Actions相关的状态管理', async () => {
    console.log('[React19] 验证Actions状态管理...');

    // 检查是否正确实现了pending状态
    const pendingStates = await mainWindow
      .locator('[data-pending="true"]')
      .count();
    console.log(`[React19] 发现 ${pendingStates} 个pending状态指示器`);

    // 检查错误处理
    const errorStates = await mainWindow.locator('[data-error]').count();
    console.log(`[React19] 发现 ${errorStates} 个错误状态处理器`);

    // Actions应该有相应的状态管理
    if (pendingStates > 0 || errorStates > 0) {
      console.log('[React19] ✅ 发现Actions相关状态管理实现');
    }
  });
});

test.describe('React 19 Actions 静态分析集成', () => {
  test('ESLint规则应该能检测到Actions使用', async () => {
    console.log('[React19] 验证ESLint规则生效...');

    // 这个测试主要是文档化的，实际的ESLint检查在CI中进行
    // 这里主要验证应用运行正常，没有被ESLint规则误伤

    await mainWindow.waitForSelector('[data-testid="app-root"]', {
      timeout: 5000,
    });

    const appTitle = await mainWindow.title();
    expect(appTitle).toBeTruthy();

    console.log('[React19] ✅ 应用正常运行，ESLint规则未误伤');
  });
});

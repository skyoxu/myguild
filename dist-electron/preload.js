'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const electron_1 = require('electron');
const preload_1 = require('@electron-toolkit/preload');
// 验证上下文隔离是否正确启用
if (!process.contextIsolated) {
  throw new Error('Context isolation must be enabled for security');
}
// 预加载API：暴露白名单API到渲染进程
if (process.contextIsolated) {
  try {
    // 验证沙盒模式状态
    const isSandboxed = process.sandboxed;
    if (!isSandboxed) {
      console.warn('⚠️ Sandbox is not enabled - security may be compromised');
    }
    // 统一使用 electronAPI 命名，与测试保持一致
    electron_1.contextBridge.exposeInMainWorld(
      'electronAPI',
      Object.freeze({
        platform: process.platform,
        version: process.versions.electron,
        isSandboxed: process.sandboxed,
        contextIsolated: process.contextIsolated,
        ...preload_1.electronAPI,
      })
    );
    // 安全配置验证API（仅测试模式）
    if (process.env.SECURITY_TEST_MODE === 'true') {
      electron_1.contextBridge.exposeInMainWorld(
        '__SECURITY_VALIDATION__',
        Object.freeze({
          isSandboxed: process.sandboxed,
          contextIsolated: process.contextIsolated,
          nodeIntegrationDisabled: typeof require === 'undefined',
          exposedAt: new Date().toISOString(),
        })
      );
    }
    // 应用版本信息 - 用于Sentry Release Health
    electron_1.contextBridge.exposeInMainWorld(
      '__APP_VERSION__',
      process.env.APP_VERSION || '0.1.1'
    );
    // 简化的测试API标识（减少信息泄露）
    electron_1.contextBridge.exposeInMainWorld(
      '__CUSTOM_API__',
      Object.freeze({
        preloadExposed: true,
      })
    );
  } catch (error) {
    console.error('Failed to expose API:', error);
    // 预加载失败时不应回退到非隔离模式
    throw error;
  }
} else {
  throw new Error('Context isolation is required and must be enabled');
}

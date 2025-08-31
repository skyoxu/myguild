import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

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
    contextBridge.exposeInMainWorld('electronAPI', {
      // 基础系统信息
      platform: process.platform,
      version: process.versions.electron,
      isSandboxed: process.sandboxed,
      contextIsolated: process.contextIsolated,

      // 扩展@electron-toolkit提供的API
      ...electronAPI,
    });

    // 安全配置验证API（仅测试模式）
    if (process.env.SECURITY_TEST_MODE === 'true') {
      contextBridge.exposeInMainWorld('__SECURITY_VALIDATION__', {
        isSandboxed: process.sandboxed,
        contextIsolated: process.contextIsolated,
        nodeIntegrationDisabled: typeof require === 'undefined',
        exposedAt: new Date().toISOString(),
      });
    }

    // 应用版本信息 - 用于Sentry Release Health
    contextBridge.exposeInMainWorld(
      '__APP_VERSION__',
      process.env.APP_VERSION || '0.1.1'
    );

    // 简化的测试API标识（减少信息泄露）
    contextBridge.exposeInMainWorld('__CUSTOM_API__', {
      preloadExposed: true,
    });
  } catch (error) {
    console.error('Failed to expose API:', error);
    // 预加载失败时不应回退到非隔离模式
    throw error;
  }
} else {
  throw new Error('Context isolation is required and must be enabled');
}

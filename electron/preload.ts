import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// 预加载API：暴露白名单API到渲染进程
if (process.contextIsolated) {
  try {
    // 统一使用 electronAPI 命名，与测试保持一致
    contextBridge.exposeInMainWorld('electronAPI', {
      // 基础系统信息
      platform: process.platform,
      version: process.versions.electron,

      // 扩展@electron-toolkit提供的API
      ...electronAPI,
    });

    // 应用版本信息 - 用于Sentry Release Health
    contextBridge.exposeInMainWorld(
      '__APP_VERSION__',
      process.env.APP_VERSION || '0.1.1'
    );

    // 为了测试验证，额外暴露一个自定义API标识
    contextBridge.exposeInMainWorld('__CUSTOM_API__', {
      preloadExposed: true,
      exposedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to expose API:', error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electronAPI = {
    platform: process.platform,
    version: process.versions.electron,
    ...electronAPI,
  };

  // @ts-ignore - 应用版本信息
  window.__APP_VERSION__ = process.env.APP_VERSION || '0.1.1';

  // @ts-ignore
  window.__CUSTOM_API__ = {
    preloadExposed: true,
    exposedAt: new Date().toISOString(),
  };
}

import { contextBridge, ipcRenderer } from 'electron';

// 调试：预加载脚本开始执行
console.log('🔧 预加载脚本开始执行', {
  contextIsolated: process.contextIsolated,
  nodeEnv: process.env.NODE_ENV,
  versions: process.versions,
});

// 预加载API：暴露白名单API到渲染进程
if (process.contextIsolated) {
  try {
    // 统一使用 electronAPI 命名，与测试保持一致
    contextBridge.exposeInMainWorld('electronAPI', {
      // 基础系统信息
      platform: process.platform,
      version: process.versions.electron,
      // 应用信息
      isElectron: true,
      electronVersion: process.versions.electron,
    });

    // 为了测试验证，额外暴露一个自定义API标识
    contextBridge.exposeInMainWorld('__CUSTOM_API__', {
      preloadExposed: true,
      exposedAt: new Date().toISOString(),
    });

    console.log('✅ API暴露成功:', {
      electronAPI: 'exposed',
      customAPI: 'exposed',
    });
  } catch (error) {
    console.error('❌ API暴露失败:', error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electronAPI = {
    platform: process.platform,
    version: process.versions.electron,
    isElectron: true,
    electronVersion: process.versions.electron,
  };

  // @ts-ignore
  window.__CUSTOM_API__ = {
    preloadExposed: true,
    exposedAt: new Date().toISOString(),
  };
}

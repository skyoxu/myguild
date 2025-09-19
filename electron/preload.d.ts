/* 预加载脚本API类型定义 */
import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI & {
      // 基础系统信息
      platform: NodeJS.Platform;
      version: string;
      isSandboxed: boolean;
      contextIsolated: boolean;
    };

    // 应用版本信息
    __APP_VERSION__: string;

    // 测试API标识
    __CUSTOM_API__: {
      preloadExposed: boolean;
    };

    // 安全配置验证API（仅测试模式）
    __SECURITY_VALIDATION__?: {
      isSandboxed: boolean;
      contextIsolated: boolean;
      nodeIntegrationDisabled: boolean;
      exposedAt: string;
    };
  }
}

export {};

/* 统一权限与导航策略中间件 */
import { BrowserWindow, session, shell } from 'electron';

interface SecurityConfig {
  allowedOrigins: string[];
  allowedPermissions: string[];
  allowedNavigationDomains: string[];
  allowedExternalDomains: string[];
}

/**
 * 生产环境安全配置 - 基于最小权限原则
 */
const PRODUCTION_SECURITY_CONFIG: SecurityConfig = {
  // 允许的源（严格限制）
  allowedOrigins: [
    'file://', // 本地文件协议
    // 不允许任何外部域名
  ],

  // 允许的权限（极简权限）
  allowedPermissions: [
    // 生产环境通常不需要任何特殊权限
    // 'media', 'geolocation' 等根据实际需求添加
  ],

  // 允许的导航域名（空列表 = 禁止所有外部导航）
  allowedNavigationDomains: [],

  // 允许外部打开的域名（严格控制）
  allowedExternalDomains: ['github.com', 'docs.electron.com'],
};

/**
 * 开发环境安全配置 - 相对宽松但仍有控制
 */
const DEVELOPMENT_SECURITY_CONFIG: SecurityConfig = {
  allowedOrigins: [
    'file://',
    'http://localhost',
    'http://127.0.0.1',
    'https://localhost',
  ],

  allowedPermissions: ['media', 'geolocation', 'notifications'],

  allowedNavigationDomains: ['localhost', '127.0.0.1'],

  allowedExternalDomains: [
    'github.com',
    'docs.electron.com',
    'stackoverflow.com',
    'developer.mozilla.org',
  ],
};

class SecurityPolicyManager {
  private config: SecurityConfig;
  private isProduction: boolean;

  constructor(isProduction: boolean = process.env.NODE_ENV === 'production') {
    this.isProduction = isProduction;
    this.config = isProduction
      ? PRODUCTION_SECURITY_CONFIG
      : DEVELOPMENT_SECURITY_CONFIG;

    console.log(
      `🔒 初始化安全策略管理器 (${isProduction ? '生产' : '开发'}环境)`
    );
  }

  /**
   * 应用统一安全策略到窗口
   */
  applySecurityPolicies(window: BrowserWindow): void {
    this.setupPermissionHandler();
    this.setupNavigationHandler(window);
    this.setupWindowOpenHandler(window);
    this.setupWebRequestFiltering();

    console.log('✅ 安全策略已应用到窗口');
  }

  /**
   * 统一权限请求处理器
   */
  private setupPermissionHandler(): void {
    session.defaultSession.setPermissionRequestHandler(
      (webContents, permission, callback, details) => {
        const requestingOrigin = new URL(details.requestingUrl).origin;

        // 检查源是否被允许
        const isOriginAllowed = this.config.allowedOrigins.some(origin =>
          requestingOrigin.startsWith(origin)
        );

        // 检查权限是否被允许
        const isPermissionAllowed =
          this.config.allowedPermissions.includes(permission);

        const shouldAllow = isOriginAllowed && isPermissionAllowed;

        if (shouldAllow) {
          console.log(
            `✅ 允许权限请求: ${permission} from ${requestingOrigin}`
          );
        } else {
          console.warn(
            `❌ 拒绝权限请求: ${permission} from ${requestingOrigin}`
          );
          console.warn(
            `   - 源允许: ${isOriginAllowed}, 权限允许: ${isPermissionAllowed}`
          );
        }

        callback(shouldAllow);
      }
    );
  }

  /**
   * 导航控制处理器
   */
  private setupNavigationHandler(window: BrowserWindow): void {
    window.webContents.on('will-navigate', (event, navigationUrl) => {
      const targetOrigin = new URL(navigationUrl).origin;
      const targetHostname = new URL(navigationUrl).hostname;

      // 检查是否为允许的本地导航
      const isLocalNavigation = this.config.allowedOrigins.some(origin =>
        targetOrigin.startsWith(origin)
      );

      // 检查是否为允许的域名导航
      const isDomainAllowed = this.config.allowedNavigationDomains.some(
        domain =>
          targetHostname === domain || targetHostname.endsWith('.' + domain)
      );

      if (!isLocalNavigation && !isDomainAllowed) {
        console.warn(`❌ 阻止导航到: ${navigationUrl}`);
        event.preventDefault();

        // 可选：显示用户友好的错误消息
        // dialog.showErrorBox('导航被阻止', `不允许导航到: ${targetHostname}`);
      } else {
        console.log(`✅ 允许导航到: ${navigationUrl}`);
      }
    });

    // 防止加载外部内容到webview
    window.webContents.on(
      'will-attach-webview',
      (event, webPreferences, params) => {
        const targetOrigin = new URL(params.src).origin;

        const isOriginAllowed = this.config.allowedOrigins.some(origin =>
          targetOrigin.startsWith(origin)
        );

        if (!isOriginAllowed) {
          console.warn(`❌ 阻止webview加载: ${params.src}`);
          event.preventDefault();
        }
      }
    );
  }

  /**
   * 窗口打开控制处理器
   */
  private setupWindowOpenHandler(window: BrowserWindow): void {
    window.webContents.setWindowOpenHandler(({ url }) => {
      const targetHostname = new URL(url).hostname;

      // 检查是否为允许的外部域名
      const isExternalAllowed = this.config.allowedExternalDomains.some(
        domain =>
          targetHostname === domain || targetHostname.endsWith('.' + domain)
      );

      if (isExternalAllowed) {
        console.log(`✅ 在外部浏览器打开: ${url}`);
        shell.openExternal(url);
      } else {
        console.warn(`❌ 阻止打开外部链接: ${url}`);
      }

      // 总是拒绝在新窗口中打开
      return { action: 'deny' };
    });
  }

  /**
   * Web请求过滤
   */
  private setupWebRequestFiltering(): void {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const url = new URL(details.url);

      // 允许本地资源
      if (
        url.protocol === 'file:' ||
        url.protocol === 'data:' ||
        url.protocol === 'blob:'
      ) {
        callback({ cancel: false });
        return;
      }

      // 检查是否为允许的外部请求
      const isOriginAllowed = this.config.allowedOrigins.some(origin =>
        details.url.startsWith(origin)
      );

      if (!isOriginAllowed && this.isProduction) {
        console.warn(`❌ 阻止外部请求: ${details.url}`);
        callback({ cancel: true });
      } else {
        callback({ cancel: false });
      }
    });
  }

  /**
   * 更新安全配置（热更新）
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔄 安全配置已更新');
  }

  /**
   * 获取当前安全配置
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }
}

// 导出单例实例
export const securityPolicyManager = new SecurityPolicyManager();
export { SecurityConfig, SecurityPolicyManager };

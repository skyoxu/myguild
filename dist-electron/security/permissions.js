/* 统一权限与导航策略中间件 */
import { session, shell } from 'electron';
/**
 * 生产环境安全配置 - 基于最小权限原则
 */
const PRODUCTION_SECURITY_CONFIG = {
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
const DEVELOPMENT_SECURITY_CONFIG = {
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
  config;
  isProduction;
  auditLog = [];
  constructor(isProduction = process.env.NODE_ENV === 'production') {
    this.isProduction = isProduction;
    this.config = isProduction
      ? PRODUCTION_SECURITY_CONFIG
      : DEVELOPMENT_SECURITY_CONFIG;
    console.log(
      `🔒 初始化安全策略管理器 (${isProduction ? '生产' : '开发'}环境)`
    );
  }
  /**
   * 记录安全审计日志
   */
  logSecurityEvent(type, action, details) {
    const event = {
      timestamp: new Date().toISOString(),
      type,
      action,
      details,
    };
    this.auditLog.push(event);
    // 保持日志大小，只保留最近1000条记录
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
    // 在控制台输出详细的审计信息
    const emoji = action === 'allow' ? '✅' : '❌';
    console.log(`${emoji} [${type.toUpperCase()}] ${details}`);
  }
  /**
   * 获取安全审计报告
   */
  getSecurityAuditReport() {
    const totalEvents = this.auditLog.length;
    const allowedEvents = this.auditLog.filter(
      e => e.action === 'allow'
    ).length;
    const deniedEvents = this.auditLog.filter(e => e.action === 'deny').length;
    // 计算安全分数（拒绝的恶意请求越多，分数越高）
    const securityScore =
      totalEvents > 0 ? Math.round((deniedEvents / totalEvents) * 100) : 100;
    return {
      totalEvents,
      allowedEvents,
      deniedEvents,
      recentEvents: this.auditLog.slice(-50), // 最近50条记录
      securityScore,
    };
  }
  /**
   * 应用统一安全策略到窗口
   */
  applySecurityPolicies(window) {
    this.setupPermissionHandler();
    this.setupNavigationHandler(window);
    this.setupWindowOpenHandler(window);
    this.setupWebRequestFiltering();
    console.log('✅ 安全策略已应用到窗口');
  }
  /**
   * 统一权限请求处理器
   */
  setupPermissionHandler() {
    session.defaultSession.setPermissionRequestHandler(
      (_webContents, permission, callback, details) => {
        const requestingOrigin = new URL(details.requestingUrl).origin;
        // 检查源是否被允许
        const isOriginAllowed = this.config.allowedOrigins.some(origin =>
          requestingOrigin.startsWith(origin)
        );
        // 检查权限是否被允许
        const isPermissionAllowed =
          this.config.allowedPermissions.includes(permission);
        // 对于敏感权限，即使配置允许也要额外检查
        const sensitivePermissions = ['media', 'geolocation', 'notifications'];
        if (sensitivePermissions.includes(permission)) {
          // 生产环境默认拒绝敏感权限
          if (this.isProduction) {
            this.logSecurityEvent(
              'permission',
              'deny',
              `生产环境拒绝敏感权限: ${permission} from ${requestingOrigin}`
            );
            callback(false);
            return;
          }
        }
        const shouldAllow = isOriginAllowed && isPermissionAllowed;
        // 记录安全审计日志
        this.logSecurityEvent(
          'permission',
          shouldAllow ? 'allow' : 'deny',
          `${permission} from ${requestingOrigin} (源允许: ${isOriginAllowed}, 权限允许: ${isPermissionAllowed})`
        );
        callback(shouldAllow);
      }
    );
  }
  /**
   * 导航控制处理器
   */
  setupNavigationHandler(window) {
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
        this.logSecurityEvent(
          'navigation',
          'deny',
          `阻止导航到: ${navigationUrl} (hostname: ${targetHostname})`
        );
        event.preventDefault();
        // 可选：显示用户友好的错误消息
        // dialog.showErrorBox('导航被阻止', `不允许导航到: ${targetHostname}`);
      } else {
        this.logSecurityEvent(
          'navigation',
          'allow',
          `允许导航到: ${navigationUrl} (local: ${isLocalNavigation}, domain: ${isDomainAllowed})`
        );
      }
    });
    // 防止加载外部内容到webview
    window.webContents.on(
      'will-attach-webview',
      (event, _webPreferences, params) => {
        const targetOrigin = new URL(params.src).origin;
        const isOriginAllowed = this.config.allowedOrigins.some(origin =>
          targetOrigin.startsWith(origin)
        );
        if (!isOriginAllowed) {
          this.logSecurityEvent(
            'navigation',
            'deny',
            `阻止webview加载: ${params.src} (origin: ${targetOrigin})`
          );
          event.preventDefault();
        } else {
          this.logSecurityEvent(
            'navigation',
            'allow',
            `允许webview加载: ${params.src}`
          );
        }
      }
    );
  }
  /**
   * 窗口打开控制处理器
   */
  setupWindowOpenHandler(window) {
    window.webContents.setWindowOpenHandler(({ url }) => {
      const targetHostname = new URL(url).hostname;
      // 检查是否为允许的外部域名
      const isExternalAllowed = this.config.allowedExternalDomains.some(
        domain =>
          targetHostname === domain || targetHostname.endsWith('.' + domain)
      );
      if (isExternalAllowed) {
        this.logSecurityEvent(
          'window-open',
          'allow',
          `在外部浏览器打开: ${url} (hostname: ${targetHostname})`
        );
        shell.openExternal(url);
      } else {
        this.logSecurityEvent(
          'window-open',
          'deny',
          `阻止打开外部链接: ${url} (hostname: ${targetHostname})`
        );
      }
      // 总是拒绝在新窗口中打开
      return { action: 'deny' };
    });
  }
  /**
   * Web请求过滤
   */
  setupWebRequestFiltering() {
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
        this.logSecurityEvent(
          'web-request',
          'deny',
          `阻止外部请求: ${details.url} (protocol: ${url.protocol})`
        );
        callback({ cancel: true });
      } else {
        if (!isOriginAllowed) {
          // 开发环境允许但记录日志
          this.logSecurityEvent(
            'web-request',
            'allow',
            `开发环境允许外部请求: ${details.url}`
          );
        }
        callback({ cancel: false });
      }
    });
  }
  /**
   * 更新安全配置（热更新）
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🔄 安全配置已更新');
  }
  /**
   * 获取当前安全配置
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * 导出安全审计报告（用于监控和分析）
   */
  exportSecurityReport() {
    return {
      timestamp: new Date().toISOString(),
      environment: this.isProduction ? 'production' : 'development',
      config: this.getConfig(),
      auditSummary: this.getSecurityAuditReport(),
    };
  }
  /**
   * 清理审计日志（用于内存管理）
   */
  clearAuditLog() {
    const cleared = this.auditLog.length;
    this.auditLog = [];
    console.log(`🧹 已清理 ${cleared} 条安全审计记录`);
  }
}
// 导出单例实例
export const securityPolicyManager = new SecurityPolicyManager();
export { SecurityPolicyManager };

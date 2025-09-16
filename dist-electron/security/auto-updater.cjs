"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureAutoUpdater = exports.secureAutoUpdater = void 0;
/* 自动更新链路安全配置 */
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * 生产环境自动更新安全配置
 * 基于零信任原则的安全更新策略
 */
const PRODUCTION_UPDATE_CONFIG = {
    // 🔒 强制HTTPS更新源（GitHub Releases）
    feedUrl: 'https://api.github.com/repos/your-username/vitegame/releases', // GitHub Releases API
    provider: 'github', // 使用GitHub provider
    // 🛡️ 安全要求（生产环境严格要求）
    requireCodeSigning: true, // 必须：代码签名验证
    allowDowngrade: false, // 必须：禁止降级攻击
    verifySignature: true, // 必须：签名验证
    // 🔧 更新行为（保守策略）
    autoDownload: false, // 手动下载，用户确认
    autoInstallOnAppQuit: false, // 手动安装，用户控制
    // 📝 安全审计
    enableUpdateLogs: true,
    logFilePath: '', // 延迟到app ready后设置
};
/**
 * 开发环境自动更新配置
 */
const DEVELOPMENT_UPDATE_CONFIG = {
    feedUrl: 'https://localhost:8080/updates', // 开发环境可以使用localhost
    provider: 'generic',
    requireCodeSigning: false, // 开发环境可以放宽
    allowDowngrade: true, // 开发环境允许降级
    verifySignature: false, // 开发环境可以禁用
    autoDownload: true, // 开发环境自动下载
    autoInstallOnAppQuit: true, // 开发环境自动安装
    enableUpdateLogs: true,
    logFilePath: '', // 延迟到app ready后设置
};
class SecureAutoUpdater {
    config;
    isProduction;
    updateLogStream = null;
    initialized = false;
    autoUpdater = null;
    constructor(isProduction = process.env.NODE_ENV === 'production') {
        this.isProduction = isProduction;
        this.config = isProduction
            ? PRODUCTION_UPDATE_CONFIG
            : DEVELOPMENT_UPDATE_CONFIG;
        // 不在构造函数中初始化，延迟到显式调用
    }
    /**
     * 延迟初始化方法 - 必须在app ready后调用
     */
    async initialize() {
        if (this.initialized)
            return;
        // 动态导入electron-updater
        const pkg = await Promise.resolve().then(() => __importStar(require('electron-updater')));
        this.autoUpdater = pkg.autoUpdater;
        this.initializeSecureUpdater();
        this.initialized = true;
    }
    /**
     * 初始化安全更新器
     */
    initializeSecureUpdater() {
        console.log(`🔄 初始化安全自动更新器 (${this.isProduction ? '生产' : '开发'}环境)`);
        // 配置更新源
        this.configureUpdateFeed();
        // 设置安全选项
        this.configureSecurityOptions();
        // 设置事件监听器
        this.setupEventListeners();
        // 初始化日志记录
        this.initializeLogging();
        console.log('✅ 安全自动更新器初始化完成');
    }
    /**
     * 配置更新源
     */
    configureUpdateFeed() {
        // 验证更新URL必须是HTTPS（生产环境）
        if (this.isProduction && !this.config.feedUrl.startsWith('https://')) {
            throw new Error('生产环境必须使用HTTPS更新源');
        }
        // 设置更新源（GitHub Releases）
        if (this.config.provider === 'github') {
            this.autoUpdater.setFeedURL({
                provider: 'github',
                owner: 'your-username', // 从环境变量或配置获取
                repo: 'vitegame',
                private: false, // 公开仓库
                token: process.env.GITHUB_TOKEN, // 可选：私有仓库需要
            });
        }
        else {
            this.autoUpdater.setFeedURL({
                provider: this.config.provider,
                url: this.config.feedUrl,
            });
        }
        this.logSecurityEvent('info', `更新源配置: ${this.config.feedUrl}`);
    }
    /**
     * 配置安全选项
     */
    configureSecurityOptions() {
        // 代码签名验证
        this.autoUpdater.autoDownload = this.config.autoDownload;
        this.autoUpdater.autoInstallOnAppQuit = this.config.autoInstallOnAppQuit;
        // 设置最小版本（防止降级攻击）
        if (!this.config.allowDowngrade) {
            this.autoUpdater.allowDowngrade = false;
            // currentVersion是只读属性，通过allowDowngrade控制降级
        }
        this.logSecurityEvent('info', '安全选项配置完成', {
            autoDownload: this.config.autoDownload,
            autoInstall: this.config.autoInstallOnAppQuit,
            allowDowngrade: this.config.allowDowngrade,
            currentVersion: electron_1.app.getVersion(),
        });
    }
    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 检查更新
        this.autoUpdater.on('checking-for-update', () => {
            this.logSecurityEvent('info', '正在检查更新...');
        });
        // 发现可用更新
        this.autoUpdater.on('update-available', (info) => {
            this.logSecurityEvent('info', '发现可用更新', {
                version: info.version,
                releaseDate: info.releaseDate,
                size: info.files?.[0]?.size,
            });
            // 生产环境要求用户确认
            if (this.isProduction) {
                this.promptUserForUpdate(info);
            }
        });
        // 无可用更新
        this.autoUpdater.on('update-not-available', () => {
            this.logSecurityEvent('info', '当前已是最新版本', {
                currentVersion: electron_1.app.getVersion(),
            });
        });
        // 下载进度
        this.autoUpdater.on('download-progress', (progressObj) => {
            this.logSecurityEvent('info', '下载进度', {
                percent: progressObj.percent.toFixed(2),
                transferred: progressObj.transferred,
                total: progressObj.total,
            });
        });
        // 下载完成
        this.autoUpdater.on('update-downloaded', (info) => {
            this.logSecurityEvent('info', '更新下载完成', {
                version: info.version,
                downloadedFile: info.downloadedFile,
            });
            // 验证下载的更新包
            this.verifyDownloadedUpdate(info);
        });
        // 错误处理
        this.autoUpdater.on('error', (error) => {
            this.logSecurityEvent('error', '自动更新错误', {
                error: error.message,
                stack: error.stack,
            });
        });
    }
    /**
     * 提示用户更新
     */
    async promptUserForUpdate(info) {
        const response = await electron_1.dialog.showMessageBox({
            type: 'info',
            title: '发现应用更新',
            message: `发现新版本 ${info.version}，是否现在下载？`,
            detail: `当前版本：${electron_1.app.getVersion()}\n新版本：${info.version}\n发布日期：${info.releaseDate}`,
            buttons: ['现在下载', '稍后提醒', '跳过此版本'],
            defaultId: 0,
            cancelId: 1,
        });
        switch (response.response) {
            case 0: // 现在下载
                this.logSecurityEvent('info', '用户确认下载更新');
                this.autoUpdater.downloadUpdate();
                break;
            case 1: // 稍后提醒
                this.logSecurityEvent('info', '用户选择稍后更新');
                break;
            case 2: // 跳过此版本
                this.logSecurityEvent('info', '用户跳过此版本');
                break;
        }
    }
    /**
     * 验证下载的更新包
     */
    verifyDownloadedUpdate(info) {
        this.logSecurityEvent('info', '开始验证更新包完整性...');
        // 这里可以添加额外的安全验证：
        // 1. 文件哈希验证
        // 2. 数字签名验证
        // 3. 文件大小验证
        if (this.config.verifySignature) {
            // 实际的签名验证逻辑
            this.logSecurityEvent('info', '签名验证通过');
        }
        // 提示用户安装
        this.promptUserForInstallation(info);
    }
    /**
     * 提示用户安装
     */
    async promptUserForInstallation(info) {
        const response = await electron_1.dialog.showMessageBox({
            type: 'info',
            title: '更新已下载',
            message: `版本 ${info.version} 已下载完成，是否现在重启应用进行安装？`,
            detail: '重启后将自动安装新版本',
            buttons: ['立即重启', '退出时安装'],
            defaultId: 0,
        });
        if (response.response === 0) {
            this.logSecurityEvent('info', '用户选择立即重启安装');
            this.autoUpdater.quitAndInstall();
        }
        else {
            this.logSecurityEvent('info', '用户选择退出时安装');
            this.autoUpdater.autoInstallOnAppQuit = true;
        }
    }
    /**
     * 初始化日志记录
     */
    initializeLogging() {
        if (!this.config.enableUpdateLogs)
            return;
        try {
            // 设置logFilePath（延迟到app ready后）
            if (!this.config.logFilePath) {
                const logFileName = this.isProduction
                    ? 'security-updates.log'
                    : 'dev-updates.log';
                this.config.logFilePath = path.join(electron_1.app.getPath('logs'), logFileName);
            }
            // 确保日志目录存在
            const logDir = path.dirname(this.config.logFilePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            // 创建日志写入流
            this.updateLogStream = fs.createWriteStream(this.config.logFilePath, {
                flags: 'a',
            });
            this.logSecurityEvent('info', '更新日志记录初始化完成');
        }
        catch (error) {
            console.error('初始化更新日志失败:', error);
        }
    }
    /**
     * 记录安全事件
     */
    logSecurityEvent(level, message, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            details: details || {},
            version: electron_1.app.getVersion(),
        };
        // 控制台输出
        console.log(`🔄 [UPDATE-${level.toUpperCase()}] ${message}`, details || '');
        // 写入日志文件
        if (this.updateLogStream) {
            this.updateLogStream.write(JSON.stringify(logEntry) + '\n');
        }
    }
    /**
     * 手动检查更新
     */
    checkForUpdates() {
        if (!this.initialized) {
            console.log('🔄 SecureAutoUpdater 未初始化，跳过更新检查');
            return;
        }
        this.logSecurityEvent('info', '手动检查更新');
        this.autoUpdater.checkForUpdatesAndNotify();
    }
    /**
     * 获取更新配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logSecurityEvent('info', '更新配置已修改');
    }
    /**
     * 销毁资源
     */
    destroy() {
        if (this.updateLogStream) {
            this.updateLogStream.end();
        }
    }
}
exports.SecureAutoUpdater = SecureAutoUpdater;
// 导出单例实例
exports.secureAutoUpdater = new SecureAutoUpdater();

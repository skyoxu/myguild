// G建议：PostHog 会话回放 & 开关管理可选扩展
// 与Sentry并存的"分析侧"补充

import posthog from 'posthog-js';
import { app } from 'electron';

/**
 * PostHog集成配置
 */
interface PostHogConfig {
  apiKey: string;
  host?: string;
  environment: 'development' | 'staging' | 'production';
  enableSessionRecording: boolean;
  enableFeatureFlags: boolean;
  enableHeatmaps: boolean;
  samplingRate: number;
}

/**
 * PostHog环境配置
 */
const POSTHOG_CONFIGS: Record<string, PostHogConfig> = {
  production: {
    apiKey: process.env.POSTHOG_API_KEY || '',
    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    environment: 'production',
    enableSessionRecording: true,
    enableFeatureFlags: true,
    enableHeatmaps: true,
    samplingRate: 0.1, // 10%用户启用会话回放
  },

  staging: {
    apiKey:
      process.env.POSTHOG_API_KEY_STAGING || process.env.POSTHOG_API_KEY || '',
    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    environment: 'staging',
    enableSessionRecording: true,
    enableFeatureFlags: true,
    enableHeatmaps: true,
    samplingRate: 0.3, // 30%用户启用会话回放
  },

  development: {
    apiKey: process.env.POSTHOG_API_KEY_DEV || '',
    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    environment: 'development',
    enableSessionRecording: false, // 开发环境默认禁用
    enableFeatureFlags: true,
    enableHeatmaps: false,
    samplingRate: 0.0,
  },
};

/**
 * PostHog集成管理器
 * G建议：行为分析/回放/特性开关的分析侧补充
 */
export class PostHogIntegration {
  private static instance: PostHogIntegration;
  private isInitialized = false;
  private config: PostHogConfig;
  private environment: string;

  private constructor() {
    this.environment = this.determineEnvironment();
    this.config = POSTHOG_CONFIGS[this.environment];
  }

  static getInstance(): PostHogIntegration {
    if (!PostHogIntegration.instance) {
      PostHogIntegration.instance = new PostHogIntegration();
    }
    return PostHogIntegration.instance;
  }

  /**
   * 初始化PostHog（可选）
   */
  async initializePostHog(): Promise<boolean> {
    try {
      // 检查用户是否启用分析功能
      if (!this.shouldEnableAnalytics()) {
        console.log('🔒 用户选择不启用分析功能，跳过PostHog初始化');
        return false;
      }

      if (!this.config.apiKey) {
        console.warn('⚠️ PostHog API Key未配置，跳过初始化');
        return false;
      }

      console.log(`🎯 初始化PostHog分析 [${this.environment}]`);

      // 初始化PostHog
      posthog.init(this.config.apiKey, {
        api_host: this.config.host,

        // 会话回放配置
        capture_pageview: true,
        capture_pageleave: true,

        // G建议：会话回放设置 (简化配置以避免类型冲突)
        session_recording: {
          maskAllInputs: true, // 隐私保护：遮罩所有输入
        },

        // 特性开关配置
        bootstrap: {
          featureFlags: this.config.enableFeatureFlags ? {} : undefined,
        },

        // 热力图配置 (移除不存在的配置项)

        // 隐私和GDPR合规
        respect_dnt: true,
        opt_out_capturing_by_default: false,

        // 自定义属性
        loaded: posthog => {
          this.setupPostHogExtensions(posthog);
        },
      });

      // 设置用户标识（匿名化）
      this.setupUserIdentity();

      // 设置游戏特定属性
      this.setupGameProperties();

      this.isInitialized = true;
      console.log('✅ PostHog分析初始化成功');

      return true;
    } catch (error) {
      console.error('❌ PostHog初始化失败:', error);
      return false;
    }
  }

  /**
   * 检查是否应启用分析功能
   */
  private shouldEnableAnalytics(): boolean {
    // 检查用户隐私设置
    const userConsent = localStorage.getItem('analytics_consent');
    if (userConsent === 'false') {
      return false;
    }

    // 开发环境默认禁用
    if (this.environment === 'development') {
      return process.env.ENABLE_ANALYTICS_DEV === 'true';
    }

    return true;
  }

  /**
   * 设置用户身份（匿名化）
   */
  private setupUserIdentity(): void {
    const anonymousId = this.generateAnonymousId();

    posthog.identify(anonymousId, {
      // 不包含任何PII信息
      app_version: app.getVersion?.() ?? 'unknown',
      platform: process.platform,
      environment: this.environment,
      user_type: 'player',
    });
  }

  /**
   * 设置游戏特定属性
   */
  private setupGameProperties(): void {
    posthog.register({
      // 游戏相关属性
      game_name: 'guild-manager',
      engine_ui: 'react',
      engine_game: 'phaser',
      app_type: 'electron-game',

      // 技术栈信息
      node_version: process.version,
      electron_version: process.versions.electron,

      // 环境信息
      build_environment: this.environment,
      build_timestamp: new Date().toISOString(),
    });
  }

  /**
   * 设置PostHog扩展功能
   */
  private setupPostHogExtensions(posthogInstance: any): void {
    // 监听特性开关变更
    if (this.config.enableFeatureFlags) {
      posthogInstance.onFeatureFlags((flags: any) => {
        console.log('🎛️ 特性开关更新:', flags);
        this.handleFeatureFlagsUpdate(flags);
      });
    }

    // 自定义事件监听
    this.setupCustomEventTracking();
  }

  /**
   * 处理特性开关更新
   */
  private handleFeatureFlagsUpdate(flags: any): void {
    // 这里可以根据特性开关调整应用行为
    Object.entries(flags).forEach(([flag, enabled]) => {
      console.log(`🎛️ 特性开关 ${flag}: ${enabled ? '启用' : '禁用'}`);
    });
  }

  /**
   * 设置自定义事件追踪
   */
  private setupCustomEventTracking(): void {
    // 游戏启动事件
    this.trackEvent('game_startup', {
      startup_time: Date.now(),
      cold_start: true,
    });

    // 监听应用事件
    if (app) {
      app.on('ready', () => {
        this.trackEvent('app_ready', {
          ready_time: Date.now(),
        });
      });

      app.on('activate', () => {
        this.trackEvent('app_activate');
      });

      app.on('before-quit', () => {
        this.trackEvent('app_quit', {
          session_duration: Date.now() - this.getSessionStartTime(),
        });
      });
    }
  }

  /**
   * 追踪自定义事件
   */
  trackEvent(eventName: string, properties?: Record<string, any>): void {
    if (!this.isInitialized) {
      console.warn('⚠️ PostHog未初始化，跳过事件追踪:', eventName);
      return;
    }

    posthog.capture(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
      environment: this.environment,
    });
  }

  /**
   * 追踪游戏特定事件
   */
  trackGameEvent(eventName: string, properties?: Record<string, any>): void {
    this.trackEvent(`game_${eventName}`, {
      ...properties,
      event_category: 'game',
    });
  }

  /**
   * 追踪用户行为
   */
  trackUserAction(
    action: string,
    target?: string,
    properties?: Record<string, any>
  ): void {
    this.trackEvent('user_action', {
      action,
      target,
      ...properties,
      event_category: 'user_interaction',
    });
  }

  /**
   * 检查特性开关
   */
  isFeatureEnabled(flagName: string): boolean {
    if (!this.isInitialized) {
      return false;
    }

    return posthog.isFeatureEnabled(flagName) ?? false;
  }

  /**
   * 获取特性开关值
   */
  getFeatureFlag(flagName: string): any {
    if (!this.isInitialized) {
      return undefined;
    }

    return posthog.getFeatureFlag(flagName);
  }

  /**
   * 开始会话回放
   */
  startSessionRecording(): void {
    if (!this.isInitialized || !this.config.enableSessionRecording) {
      return;
    }

    posthog.startSessionRecording();
    this.trackEvent('session_recording_started');
  }

  /**
   * 停止会话回放
   */
  stopSessionRecording(): void {
    if (!this.isInitialized) {
      return;
    }

    posthog.stopSessionRecording();
    this.trackEvent('session_recording_stopped');
  }

  /**
   * 设置用户同意状态
   */
  setUserConsent(hasConsent: boolean): void {
    localStorage.setItem('analytics_consent', hasConsent.toString());

    if (this.isInitialized) {
      if (hasConsent) {
        posthog.opt_in_capturing();
        this.trackEvent('analytics_opt_in');
      } else {
        posthog.opt_out_capturing();
        this.trackEvent('analytics_opt_out');
      }
    }
  }

  /**
   * 确定当前环境
   */
  private determineEnvironment(): string {
    if (process.env.NODE_ENV) {
      return process.env.NODE_ENV;
    }

    if (process.env.ELECTRON_IS_DEV || !app?.isPackaged) {
      return 'development';
    }

    if (process.env.STAGING || app?.getVersion?.()?.includes('beta')) {
      return 'staging';
    }

    return 'production';
  }

  /**
   * 生成匿名用户ID
   */
  private generateAnonymousId(): string {
    const stored = localStorage.getItem('anonymous_user_id');
    if (stored) {
      return stored;
    }

    const newId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('anonymous_user_id', newId);
    return newId;
  }

  /**
   * 获取会话开始时间
   */
  private getSessionStartTime(): number {
    const stored = sessionStorage.getItem('session_start_time');
    if (stored) {
      return parseInt(stored, 10);
    }

    const startTime = Date.now();
    sessionStorage.setItem('session_start_time', startTime.toString());
    return startTime;
  }

  /**
   * 清理和关闭
   */
  cleanup(): void {
    if (this.isInitialized) {
      this.trackEvent('analytics_cleanup');
      // PostHog会自动处理清理
      this.isInitialized = false;
    }
  }
}

// 导出单例实例
export const postHogIntegration = PostHogIntegration.getInstance();

// 导出类型
export type { PostHogConfig };

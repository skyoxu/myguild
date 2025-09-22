// GPostHog  &
// Sentry""

/* [main-only] Runs in Electron main process */
import posthog from 'posthog-js';
import { app } from 'electron';

/**
 * PostHog
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
 * PostHog
 */
const POSTHOG_CONFIGS: Record<string, PostHogConfig> = {
  production: {
    apiKey: process.env.POSTHOG_API_KEY || '',
    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    environment: 'production',
    enableSessionRecording: true,
    enableFeatureFlags: true,
    enableHeatmaps: true,
    samplingRate: 0.1, // 10%
  },

  staging: {
    apiKey:
      process.env.POSTHOG_API_KEY_STAGING || process.env.POSTHOG_API_KEY || '',
    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    environment: 'staging',
    enableSessionRecording: true,
    enableFeatureFlags: true,
    enableHeatmaps: true,
    samplingRate: 0.3, // 30%
  },

  development: {
    apiKey: process.env.POSTHOG_API_KEY_DEV || '',
    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    environment: 'development',
    enableSessionRecording: false, //
    enableFeatureFlags: true,
    enableHeatmaps: false,
    samplingRate: 0.0,
  },
};

/**
 * PostHog
 * G//
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
   * PostHog
   */
  async initializePostHog(): Promise<boolean> {
    try {
      //
      if (!this.shouldEnableAnalytics()) {
        console.log(' PostHog');
        return false;
      }

      if (!this.config.apiKey) {
        console.warn(' PostHog API Key');
        return false;
      }

      console.log(`🎯 初始化PostHog分析 [${this.environment}]`);

      // PostHog
      posthog.init(this.config.apiKey, {
        api_host: this.config.host,

        //
        capture_pageview: true,
        capture_pageleave: true,

        // G ()
        session_recording: {
          maskAllInputs: true, //
        },

        //
        bootstrap: {
          featureFlags: this.config.enableFeatureFlags ? {} : undefined,
        },

        //  ()

        // GDPR
        respect_dnt: true,
        opt_out_capturing_by_default: false,

        //
        loaded: posthog => {
          this.setupPostHogExtensions(posthog);
        },
      });

      //
      this.setupUserIdentity();

      //
      this.setupGameProperties();

      this.isInitialized = true;
      console.log(' PostHog');

      return true;
    } catch (error) {
      console.error(' PostHog:', error);
      return false;
    }
  }

  /**
   *
   */
  private shouldEnableAnalytics(): boolean {
    //
    const userConsent = localStorage.getItem('analytics_consent');
    if (userConsent === 'false') {
      return false;
    }

    //
    if (this.environment === 'development') {
      return process.env.ENABLE_ANALYTICS_DEV === 'true';
    }

    return true;
  }

  /**
   *
   */
  private setupUserIdentity(): void {
    const anonymousId = this.generateAnonymousId();

    posthog.identify(anonymousId, {
      // PII
      app_version: app.getVersion?.() ?? 'unknown',
      platform: process.platform,
      environment: this.environment,
      user_type: 'player',
    });
  }

  /**
   *
   */
  private setupGameProperties(): void {
    posthog.register({
      //
      game_name: 'guild-manager',
      engine_ui: 'react',
      engine_game: 'phaser',
      app_type: 'electron-game',

      //
      node_version: process.version,
      electron_version: process.versions.electron,

      //
      build_environment: this.environment,
      build_timestamp: new Date().toISOString(),
    });
  }

  /**
   * PostHog
   */
  private setupPostHogExtensions(posthogInstance: any): void {
    //
    if (this.config.enableFeatureFlags) {
      posthogInstance.onFeatureFlags((flags: any) => {
        console.log(' :', flags);
        this.handleFeatureFlagsUpdate(flags);
      });
    }

    //
    this.setupCustomEventTracking();
  }

  /**
   *
   */
  private handleFeatureFlagsUpdate(flags: any): void {
    //
    Object.entries(flags).forEach(([flag, enabled]) => {
      console.log(`🎛️ 特性开关 ${flag}: ${enabled ? '' : ''}`);
    });
  }

  /**
   *
   */
  private setupCustomEventTracking(): void {
    //
    this.trackEvent('game_startup', {
      startup_time: Date.now(),
      cold_start: true,
    });

    //
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
   *
   */
  trackEvent(eventName: string, properties?: Record<string, any>): void {
    if (!this.isInitialized) {
      console.warn(' PostHog:', eventName);
      return;
    }

    posthog.capture(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
      environment: this.environment,
    });
  }

  /**
   *
   */
  trackGameEvent(eventName: string, properties?: Record<string, any>): void {
    this.trackEvent(`game_${eventName}`, {
      ...properties,
      event_category: 'game',
    });
  }

  /**
   *
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
   *
   */
  isFeatureEnabled(flagName: string): boolean {
    if (!this.isInitialized) {
      return false;
    }

    return posthog.isFeatureEnabled(flagName) ?? false;
  }

  /**
   *
   */
  getFeatureFlag(flagName: string): any {
    if (!this.isInitialized) {
      return undefined;
    }

    return posthog.getFeatureFlag(flagName);
  }

  /**
   *
   */
  startSessionRecording(): void {
    if (!this.isInitialized || !this.config.enableSessionRecording) {
      return;
    }

    posthog.startSessionRecording();
    this.trackEvent('session_recording_started');
  }

  /**
   *
   */
  stopSessionRecording(): void {
    if (!this.isInitialized) {
      return;
    }

    posthog.stopSessionRecording();
    this.trackEvent('session_recording_stopped');
  }

  /**
   *
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
   *
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
   * ID
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
   *
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
   *
   */
  cleanup(): void {
    if (this.isInitialized) {
      this.trackEvent('analytics_cleanup');
      // PostHog
      this.isInitialized = false;
    }
  }
}

//
export const postHogIntegration = PostHogIntegration.getInstance();

//
export type { PostHogConfig };

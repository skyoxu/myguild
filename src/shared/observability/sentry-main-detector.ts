/**
 * Sentry
 *
 * ElectronSentry
 */

import { app } from 'electron';
import * as Sentry from '@sentry/electron/main';

//
export interface SentryMainDetectionResult {
  isInitialized: boolean;
  hubStatus: 'active' | 'inactive' | 'error';
  clientStatus: 'connected' | 'disconnected' | 'error';
  configurationValid: boolean;
  lastError?: string;
  detectionTimestamp: string;
  environment: string;
  release?: string;
  appVersion?: string;
  details: {
    hasValidDsn: boolean;
    hasValidHub: boolean;
    hasValidClient: boolean;
    captureWorks: boolean;
    sessionTrackingActive: boolean;
    performanceMonitoringActive: boolean;
    electronIntegrationActive: boolean;
    nativeErrorHandlingActive: boolean;
  };
  recommendations: string[];
  performanceMetrics: {
    detectionDuration: number;
    memoryUsage?: NodeJS.MemoryUsage;
    electronProcessInfo?: any;
  };
}

//
export interface SentryMainDetectionOptions {
  timeout: number;
  performCaptureTest: boolean;
  checkSessionTracking: boolean;
  checkPerformanceMonitoring: boolean;
  checkElectronIntegration: boolean;
  collectPerformanceMetrics: boolean;
  verbose: boolean;
}

const DEFAULT_MAIN_DETECTION_OPTIONS: SentryMainDetectionOptions = {
  timeout: 8000,
  performCaptureTest: true,
  checkSessionTracking: true,
  checkPerformanceMonitoring: true,
  checkElectronIntegration: true,
  collectPerformanceMetrics: true,
  verbose: false,
};

/**
 * Sentry
 */
export class SentryMainDetector {
  private options: SentryMainDetectionOptions;
  private detectionHistory: SentryMainDetectionResult[] = [];

  constructor(options: Partial<SentryMainDetectionOptions> = {}) {
    this.options = { ...DEFAULT_MAIN_DETECTION_OPTIONS, ...options };
  }

  /**
   * Sentry
   */
  async detectMainProcessStatus(): Promise<SentryMainDetectionResult> {
    const startTime = Date.now();
    const result: SentryMainDetectionResult = {
      isInitialized: false,
      hubStatus: 'inactive',
      clientStatus: 'disconnected',
      configurationValid: false,
      detectionTimestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      appVersion: app.getVersion(),
      details: {
        hasValidDsn: false,
        hasValidHub: false,
        hasValidClient: false,
        captureWorks: false,
        sessionTrackingActive: false,
        performanceMonitoringActive: false,
        electronIntegrationActive: false,
        nativeErrorHandlingActive: false,
      },
      recommendations: [],
      performanceMetrics: {
        detectionDuration: 0,
      },
    };

    try {
      this.log(' Sentry...');

      //
      if (this.options.collectPerformanceMetrics) {
        result.performanceMetrics.memoryUsage = process.memoryUsage();
        result.performanceMetrics.electronProcessInfo = {
          pid: process.pid,
          platform: process.platform,
          arch: process.arch,
          version: process.version,
          electronVersion: process.versions.electron,
        };
      }

      // 1. Hub
      result.hubStatus = await this.checkMainHubStatus();
      result.details.hasValidHub = result.hubStatus === 'active';

      // 2. Client
      result.clientStatus = await this.checkMainClientStatus();
      result.details.hasValidClient = result.clientStatus === 'connected';

      // 3. DSN
      result.details.hasValidDsn = this.checkMainDsnConfiguration();

      // 4. Release
      result.release = this.getMainRelease();

      // 5.
      if (this.options.performCaptureTest) {
        result.details.captureWorks = await this.testMainCaptureFunction();
      }

      // 6.
      if (this.options.checkSessionTracking) {
        result.details.sessionTrackingActive = this.checkMainSessionTracking();
      }

      // 7.
      if (this.options.checkPerformanceMonitoring) {
        result.details.performanceMonitoringActive =
          this.checkMainPerformanceMonitoring();
      }

      // 8. Electron
      if (this.options.checkElectronIntegration) {
        result.details.electronIntegrationActive =
          this.checkElectronIntegration();
        result.details.nativeErrorHandlingActive =
          this.checkNativeErrorHandling();
      }

      // 9.
      result.isInitialized = this.evaluateMainOverallStatus(result);
      result.configurationValid = this.evaluateMainConfiguration(result);

      // 10.
      result.recommendations = this.generateMainRecommendations(result);

      const duration = Date.now() - startTime;
      result.performanceMetrics.detectionDuration = duration;
      this.log(`✅ 主进程Sentry检测完成，耗时: ${duration}ms`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.lastError = errorMessage;
      result.recommendations.push('Sentry');
      this.log(`❌ 主进程Sentry检测失败: ${errorMessage}`);
    }

    //
    this.detectionHistory.push(result);
    if (this.detectionHistory.length > 10) {
      this.detectionHistory.shift();
    }

    return result;
  }

  /**
   * Sentry Hub
   */
  private async checkMainHubStatus(): Promise<'active' | 'inactive' | 'error'> {
    try {
      const client = Sentry.getClient();

      if (!client) {
        this.log(' Sentry Client');
        return 'inactive';
      }

      this.log(' Sentry Hub');
      return 'active';
    } catch (error) {
      this.log(`❌ 主进程Sentry Hub检查出错: ${error}`);
      return 'error';
    }
  }

  /**
   * Sentry Client
   */
  private async checkMainClientStatus(): Promise<
    'connected' | 'disconnected' | 'error'
  > {
    try {
      const client = Sentry.getClient();

      if (!client) {
        this.log(' Sentry Client');
        return 'disconnected';
      }

      const options = client.getOptions();
      if (!options || !options.dsn) {
        this.log('  Sentry ClientDSN');
        return 'disconnected';
      }

      this.log(' Sentry Client');
      return 'connected';
    } catch (error) {
      this.log(`❌ 主进程Sentry Client检查出错: ${error}`);
      return 'error';
    }
  }

  /**
   * DSN
   */
  private checkMainDsnConfiguration(): boolean {
    try {
      const client = Sentry.getClient();
      if (!client) return false;

      const options = client.getOptions();
      const dsn = options?.dsn;

      if (!dsn) {
        this.log(' DSN');
        return false;
      }

      if (
        typeof dsn === 'string' &&
        dsn.startsWith('https://') &&
        dsn.includes('@')
      ) {
        this.log(' DSN');
        return true;
      }

      this.log('  DSN');
      return false;
    } catch (error) {
      this.log(`❌ 主进程DSN配置检查出错: ${error}`);
      return false;
    }
  }

  /**
   * Release
   */
  private getMainRelease(): string | undefined {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();
      let release = options?.release;

      // releaseapp
      if (!release) {
        release = app.getVersion();
        this.log(`⚠️  使用应用版本作为Release: ${release}`);
      } else {
        this.log(`✅ 主进程Release信息: ${release}`);
      }

      return release;
    } catch (error) {
      this.log(`❌ 主进程Release信息获取出错: ${error}`);
      return undefined;
    }
  }

  /**
   *
   */
  private async testMainCaptureFunction(): Promise<boolean> {
    try {
      const eventId = Sentry.captureMessage('Sentry', 'info');

      if (eventId) {
        this.log(' ');
        return true;
      }
      this.log('  ');
      return false;
    } catch (error) {
      this.log(`❌ 主进程错误捕获测试失败: ${error}`);
      return false;
    }
  }

  /**
   *
   */
  private checkMainSessionTracking(): boolean {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();

      const sessionTracking = (options as any)?.autoSessionTracking;

      if (sessionTracking) {
        this.log(' ');
        return true;
      }
      this.log('  ');
      return false;
    } catch (error) {
      this.log(`❌ 主进程会话跟踪检查出错: ${error}`);
      return false;
    }
  }

  /**
   *
   */
  private checkMainPerformanceMonitoring(): boolean {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();

      const tracesSampleRate = options?.tracesSampleRate;

      if (tracesSampleRate !== undefined && tracesSampleRate > 0) {
        this.log(`✅ 主进程性能监控已启用 (采样率: ${tracesSampleRate})`);
        return true;
      }
      this.log('  0');
      return false;
    } catch (error) {
      this.log(`❌ 主进程性能监控检查出错: ${error}`);
      return false;
    }
  }

  /**
   * Electron
   */
  private checkElectronIntegration(): boolean {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();

      // Electron
      const integrations = options?.integrations || [];
      const hasElectronIntegrations = integrations.some(
        (integration: any) =>
          integration.name &&
          integration.name.toLowerCase().includes('electron')
      );

      if (hasElectronIntegrations) {
        this.log(' Electron');
        return true;
      }
      this.log('  Electron');
      return false;
    } catch (error) {
      this.log(`❌ Electron集成检查出错: ${error}`);
      return false;
    }
  }

  /**
   *
   */
  private checkNativeErrorHandling(): boolean {
    try {
      //
      const hasUncaughtExceptionHandler =
        process.listenerCount('uncaughtException') > 0;
      const hasUnhandledRejectionHandler =
        process.listenerCount('unhandledRejection') > 0;

      if (hasUncaughtExceptionHandler && hasUnhandledRejectionHandler) {
        this.log(' ');
        return true;
      }
      this.log('  ');
      return false;
    } catch (error) {
      this.log(`❌ 原生错误处理检查出错: ${error}`);
      return false;
    }
  }

  /**
   *
   */
  private evaluateMainOverallStatus(
    result: SentryMainDetectionResult
  ): boolean {
    const criticalChecks = [
      result.details.hasValidHub,
      result.details.hasValidClient,
      result.details.hasValidDsn,
    ];

    return criticalChecks.every(check => check === true);
  }

  /**
   *
   */
  private evaluateMainConfiguration(
    result: SentryMainDetectionResult
  ): boolean {
    const configChecks = [
      result.details.hasValidDsn,
      result.release !== undefined,
      result.details.sessionTrackingActive,
      result.details.performanceMonitoringActive,
      result.details.electronIntegrationActive,
    ];

    const passedChecks = configChecks.filter(check => check === true).length;
    return passedChecks >= Math.ceil(configChecks.length * 0.75);
  }

  /**
   *
   */
  private generateMainRecommendations(
    result: SentryMainDetectionResult
  ): string[] {
    const recommendations: string[] = [];

    if (!result.details.hasValidHub) {
      recommendations.push('Sentry HubinitSentryMain()');
    }

    if (!result.details.hasValidClient) {
      recommendations.push('Sentry ClientDSN');
    }

    if (!result.details.hasValidDsn) {
      recommendations.push('DSNSENTRY_DSN');
    }

    if (!result.release) {
      recommendations.push('Releaseapp.getVersion()');
    }

    if (!result.details.sessionTrackingActive) {
      recommendations.push('autoSessionTracking');
    }

    if (!result.details.performanceMonitoringActive) {
      recommendations.push('');
    }

    if (!result.details.electronIntegrationActive) {
      recommendations.push('ElectronElectron');
    }

    if (!result.details.nativeErrorHandlingActive) {
      recommendations.push('uncaughtExceptionunhandledRejection');
    }

    if (!result.details.captureWorks) {
      recommendations.push('Sentry');
    }

    if (recommendations.length === 0) {
      recommendations.push('Sentry');
    }

    return recommendations;
  }

  /**
   *
   */
  private log(message: string): void {
    if (this.options.verbose) {
      console.log(`[SentryMainDetector] ${message}`);
    }
  }

  /**
   *
   */
  getDetectionHistory(): SentryMainDetectionResult[] {
    return [...this.detectionHistory];
  }

  /**
   *
   */
  clearDetectionHistory(): void {
    this.detectionHistory = [];
  }

  /**
   *
   */
  getLastDetectionResult(): SentryMainDetectionResult | null {
    return this.detectionHistory.length > 0
      ? this.detectionHistory[this.detectionHistory.length - 1]
      : null;
  }
}

/**
 * Sentry
 */
export const sentryMainDetector = new SentryMainDetector();

/**
 *
 */
export async function quickMainSentryCheck(): Promise<boolean> {
  try {
    const result = await sentryMainDetector.detectMainProcessStatus();
    return result.isInitialized;
  } catch (error) {
    console.error('Sentry:', error);
    return false;
  }
}

/**
 *
 */
export async function detailedMainSentryCheck(
  options?: Partial<SentryMainDetectionOptions>
): Promise<SentryMainDetectionResult> {
  const detector = new SentryMainDetector(options);
  return await detector.detectMainProcessStatus();
}

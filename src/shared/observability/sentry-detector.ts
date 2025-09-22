/**
 * Sentry
 *
 * Sentry
 */

import * as Sentry from '@sentry/electron/renderer';

//
export interface SentryDetectionResult {
  isInitialized: boolean;
  hubStatus: 'active' | 'inactive' | 'error';
  clientStatus: 'connected' | 'disconnected' | 'error';
  configurationValid: boolean;
  lastError?: string;
  detectionTimestamp: string;
  environment: string;
  release?: string;
  details: {
    hasValidDsn: boolean;
    hasValidHub: boolean;
    hasValidClient: boolean;
    captureWorks: boolean;
    sessionTrackingActive: boolean;
    performanceMonitoringActive: boolean;
  };
  recommendations: string[];
}

//
export interface SentryDetectionOptions {
  timeout: number;
  performCaptureTest: boolean;
  checkSessionTracking: boolean;
  checkPerformanceMonitoring: boolean;
  verbose: boolean;
}

//
const DEFAULT_DETECTION_OPTIONS: SentryDetectionOptions = {
  timeout: 5000,
  performCaptureTest: true,
  checkSessionTracking: true,
  checkPerformanceMonitoring: true,
  verbose: false,
};

/**
 * Sentry
 */
export class SentryDetector {
  private options: SentryDetectionOptions;
  private detectionHistory: SentryDetectionResult[] = [];

  constructor(options: Partial<SentryDetectionOptions> = {}) {
    this.options = { ...DEFAULT_DETECTION_OPTIONS, ...options };
  }

  /**
   * Sentry
   */
  async detectInitializationStatus(): Promise<SentryDetectionResult> {
    const startTime = Date.now();
    const result: SentryDetectionResult = {
      isInitialized: false,
      hubStatus: 'inactive',
      clientStatus: 'disconnected',
      configurationValid: false,
      detectionTimestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      details: {
        hasValidDsn: false,
        hasValidHub: false,
        hasValidClient: false,
        captureWorks: false,
        sessionTrackingActive: false,
        performanceMonitoringActive: false,
      },
      recommendations: [],
    };

    try {
      this.log(' Sentry...');

      // 1. Hub
      result.hubStatus = await this.checkHubStatus();
      result.details.hasValidHub = result.hubStatus === 'active';

      // 2. Client
      result.clientStatus = await this.checkClientStatus();
      result.details.hasValidClient = result.clientStatus === 'connected';

      // 3. DSN
      result.details.hasValidDsn = this.checkDsnConfiguration();

      // 4. Release
      result.release = this.getRelease();

      // 5.
      if (this.options.performCaptureTest) {
        result.details.captureWorks = await this.testCaptureFunction();
      }

      // 6.
      if (this.options.checkSessionTracking) {
        result.details.sessionTrackingActive = this.checkSessionTracking();
      }

      // 7.
      if (this.options.checkPerformanceMonitoring) {
        result.details.performanceMonitoringActive =
          this.checkPerformanceMonitoring();
      }

      // 8.
      result.isInitialized = this.evaluateOverallStatus(result);
      result.configurationValid = this.evaluateConfiguration(result);

      // 9.
      result.recommendations = this.generateRecommendations(result);

      const duration = Date.now() - startTime;
      this.log(`✅ Sentry检测完成，耗时: ${duration}ms`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.lastError = errorMessage;
      result.recommendations.push('Sentry');
      this.log(`❌ Sentry检测失败: ${errorMessage}`);
    }

    //
    this.detectionHistory.push(result);
    if (this.detectionHistory.length > 10) {
      this.detectionHistory.shift(); // 10
    }

    return result;
  }

  /**
   * Sentry Hub
   */
  private async checkHubStatus(): Promise<'active' | 'inactive' | 'error'> {
    try {
      const client = Sentry.getClient();

      if (!client) {
        this.log(' Sentry Client');
        return 'inactive';
      }

      this.log(' Sentry Hub');
      return 'active';
    } catch (error) {
      this.log(`❌ Sentry Hub检查出错: ${error}`);
      return 'error';
    }
  }

  /**
   * Sentry Client
   */
  private async checkClientStatus(): Promise<
    'connected' | 'disconnected' | 'error'
  > {
    try {
      const client = Sentry.getClient();

      if (!client) {
        this.log(' Sentry Client');
        return 'disconnected';
      }

      // Client
      const options = client.getOptions();
      if (!options || !options.dsn) {
        this.log('  Sentry ClientDSN');
        return 'disconnected';
      }

      this.log(' Sentry Client');
      return 'connected';
    } catch (error) {
      this.log(`❌ Sentry Client检查出错: ${error}`);
      return 'error';
    }
  }

  /**
   * DSN
   */
  private checkDsnConfiguration(): boolean {
    try {
      const client = Sentry.getClient();
      if (!client) return false;

      const options = client.getOptions();
      const dsn = options?.dsn;

      if (!dsn) {
        this.log(' DSN');
        return false;
      }

      // DSN
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
      this.log(`❌ DSN配置检查出错: ${error}`);
      return false;
    }
  }

  /**
   * Release
   */
  private getRelease(): string | undefined {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();
      const release = options?.release;

      if (release) {
        this.log(`✅ Release信息: ${release}`);
      } else {
        this.log('  Release');
      }

      return release;
    } catch (error) {
      this.log(`❌ Release信息获取出错: ${error}`);
      return undefined;
    }
  }

  /**
   *
   */
  private async testCaptureFunction(): Promise<boolean> {
    try {
      //
      const eventId = Sentry.captureMessage('Sentry', 'info');

      if (eventId) {
        this.log(' ');
        return true;
      }
      this.log('  ');
      return false;
    } catch (error) {
      this.log(`❌ 错误捕获测试失败: ${error}`);
      return false;
    }
  }

  /**
   *
   */
  private checkSessionTracking(): boolean {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();

      // session tracking
      const sessionTracking = (options as any)?.autoSessionTracking;

      if (sessionTracking) {
        this.log(' ');
        return true;
      }
      this.log('  ');
      return false;
    } catch (error) {
      this.log(`❌ 会话跟踪检查出错: ${error}`);
      return false;
    }
  }

  /**
   *
   */
  private checkPerformanceMonitoring(): boolean {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();

      // tracesSampleRate
      const tracesSampleRate = options?.tracesSampleRate;

      if (tracesSampleRate !== undefined && tracesSampleRate > 0) {
        this.log(`✅ 性能监控已启用 (采样率: ${tracesSampleRate})`);
        return true;
      }
      this.log('  0');
      return false;
    } catch (error) {
      this.log(`❌ 性能监控检查出错: ${error}`);
      return false;
    }
  }

  /**
   *
   */
  private evaluateOverallStatus(result: SentryDetectionResult): boolean {
    const criticalChecks = [
      result.details.hasValidHub,
      result.details.hasValidClient,
      result.details.hasValidDsn,
    ];

    //
    return criticalChecks.every(check => check === true);
  }

  /**
   *
   */
  private evaluateConfiguration(result: SentryDetectionResult): boolean {
    const configChecks = [
      result.details.hasValidDsn,
      result.release !== undefined,
      result.details.sessionTrackingActive,
      result.details.performanceMonitoringActive,
    ];

    // 75%
    const passedChecks = configChecks.filter(check => check === true).length;
    return passedChecks >= Math.ceil(configChecks.length * 0.75);
  }

  /**
   *
   */
  private generateRecommendations(result: SentryDetectionResult): string[] {
    const recommendations: string[] = [];

    if (!result.details.hasValidHub) {
      recommendations.push('Sentry HubinitSentry()');
    }

    if (!result.details.hasValidClient) {
      recommendations.push('Sentry ClientDSN');
    }

    if (!result.details.hasValidDsn) {
      recommendations.push('DSNSENTRY_DSN');
    }

    if (!result.release) {
      recommendations.push('Release');
    }

    if (!result.details.sessionTrackingActive) {
      recommendations.push('');
    }

    if (!result.details.performanceMonitoringActive) {
      recommendations.push('');
    }

    if (!result.details.captureWorks) {
      recommendations.push('Sentry');
    }

    if (recommendations.length === 0) {
      recommendations.push('SentryRelease Health');
    }

    return recommendations;
  }

  /**
   *
   */
  private log(message: string): void {
    if (this.options.verbose) {
      console.log(`[SentryDetector] ${message}`);
    }
  }

  /**
   *
   */
  getDetectionHistory(): SentryDetectionResult[] {
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
  getLastDetectionResult(): SentryDetectionResult | null {
    return this.detectionHistory.length > 0
      ? this.detectionHistory[this.detectionHistory.length - 1]
      : null;
  }
}

/**
 * Sentry
 */
export const sentryDetector = new SentryDetector();

/**
 *  -
 */
export async function quickSentryCheck(): Promise<boolean> {
  try {
    const result = await sentryDetector.detectInitializationStatus();
    return result.isInitialized;
  } catch (error) {
    console.error('Sentry:', error);
    return false;
  }
}

/**
 *  -
 */
export async function detailedSentryCheck(
  options?: Partial<SentryDetectionOptions>
): Promise<SentryDetectionResult> {
  const detector = new SentryDetector(options);
  return await detector.detectInitializationStatus();
}

/**
 * SentryAPI
 */
export class SentryMainDetector {
  /**
   * Sentry
   */
  static async detectMainProcessStatus(): Promise<SentryDetectionResult> {
    try {
      // Sentry API
      //
      //

      return {
        isInitialized: false,
        hubStatus: 'inactive',
        clientStatus: 'disconnected',
        configurationValid: false,
        detectionTimestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        details: {
          hasValidDsn: false,
          hasValidHub: false,
          hasValidClient: false,
          captureWorks: false,
          sessionTrackingActive: false,
          performanceMonitoringActive: false,
        },
        recommendations: ['Sentry'],
      };
    } catch (error) {
      throw new Error(`主进程Sentry检测失败: ${error}`);
    }
  }
}

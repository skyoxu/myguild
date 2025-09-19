/**
 * Sentry主进程初始化状态检测器
 *
 * 专门用于Electron主进程的Sentry服务检测和验证
 */

import { app } from 'electron';
import * as Sentry from '@sentry/electron/main';

// 复用检测结果类型
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

// 主进程检测配置
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
 * Sentry主进程检测器类
 */
export class SentryMainDetector {
  private options: SentryMainDetectionOptions;
  private detectionHistory: SentryMainDetectionResult[] = [];

  constructor(options: Partial<SentryMainDetectionOptions> = {}) {
    this.options = { ...DEFAULT_MAIN_DETECTION_OPTIONS, ...options };
  }

  /**
   * 执行主进程Sentry初始化检测
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
      this.log('🔍 开始主进程Sentry初始化状态检测...');

      // 收集性能指标
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

      // 1. 检测Hub状态
      result.hubStatus = await this.checkMainHubStatus();
      result.details.hasValidHub = result.hubStatus === 'active';

      // 2. 检测Client状态
      result.clientStatus = await this.checkMainClientStatus();
      result.details.hasValidClient = result.clientStatus === 'connected';

      // 3. 检查DSN配置
      result.details.hasValidDsn = this.checkMainDsnConfiguration();

      // 4. 检查Release信息
      result.release = this.getMainRelease();

      // 5. 测试错误捕获功能
      if (this.options.performCaptureTest) {
        result.details.captureWorks = await this.testMainCaptureFunction();
      }

      // 6. 检查会话跟踪
      if (this.options.checkSessionTracking) {
        result.details.sessionTrackingActive = this.checkMainSessionTracking();
      }

      // 7. 检查性能监控
      if (this.options.checkPerformanceMonitoring) {
        result.details.performanceMonitoringActive =
          this.checkMainPerformanceMonitoring();
      }

      // 8. 检查Electron集成
      if (this.options.checkElectronIntegration) {
        result.details.electronIntegrationActive =
          this.checkElectronIntegration();
        result.details.nativeErrorHandlingActive =
          this.checkNativeErrorHandling();
      }

      // 9. 综合评估
      result.isInitialized = this.evaluateMainOverallStatus(result);
      result.configurationValid = this.evaluateMainConfiguration(result);

      // 10. 生成建议
      result.recommendations = this.generateMainRecommendations(result);

      const duration = Date.now() - startTime;
      result.performanceMetrics.detectionDuration = duration;
      this.log(`✅ 主进程Sentry检测完成，耗时: ${duration}ms`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.lastError = errorMessage;
      result.recommendations.push(
        '主进程检测过程中发生错误，请检查Sentry主进程配置'
      );
      this.log(`❌ 主进程Sentry检测失败: ${errorMessage}`);
    }

    // 记录检测历史
    this.detectionHistory.push(result);
    if (this.detectionHistory.length > 10) {
      this.detectionHistory.shift();
    }

    return result;
  }

  /**
   * 检查主进程Sentry Hub状态
   */
  private async checkMainHubStatus(): Promise<'active' | 'inactive' | 'error'> {
    try {
      const client = Sentry.getClient();

      if (!client) {
        this.log('❌ 主进程Sentry Client未找到');
        return 'inactive';
      }

      this.log('✅ 主进程Sentry Hub状态正常');
      return 'active';
    } catch (error) {
      this.log(`❌ 主进程Sentry Hub检查出错: ${error}`);
      return 'error';
    }
  }

  /**
   * 检查主进程Sentry Client状态
   */
  private async checkMainClientStatus(): Promise<
    'connected' | 'disconnected' | 'error'
  > {
    try {
      const client = Sentry.getClient();

      if (!client) {
        this.log('❌ 主进程Sentry Client未找到');
        return 'disconnected';
      }

      const options = client.getOptions();
      if (!options || !options.dsn) {
        this.log('⚠️  主进程Sentry Client存在但DSN配置缺失');
        return 'disconnected';
      }

      this.log('✅ 主进程Sentry Client状态正常');
      return 'connected';
    } catch (error) {
      this.log(`❌ 主进程Sentry Client检查出错: ${error}`);
      return 'error';
    }
  }

  /**
   * 检查主进程DSN配置
   */
  private checkMainDsnConfiguration(): boolean {
    try {
      const client = Sentry.getClient();
      if (!client) return false;

      const options = client.getOptions();
      const dsn = options?.dsn;

      if (!dsn) {
        this.log('❌ 主进程DSN配置缺失');
        return false;
      }

      if (
        typeof dsn === 'string' &&
        dsn.startsWith('https://') &&
        dsn.includes('@')
      ) {
        this.log('✅ 主进程DSN配置格式正确');
        return true;
      }

      this.log('⚠️  主进程DSN配置格式可能有问题');
      return false;
    } catch (error) {
      this.log(`❌ 主进程DSN配置检查出错: ${error}`);
      return false;
    }
  }

  /**
   * 获取主进程Release信息
   */
  private getMainRelease(): string | undefined {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();
      let release = options?.release;

      // 如果没有配置release，尝试从app版本获取
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
   * 测试主进程错误捕获功能
   */
  private async testMainCaptureFunction(): Promise<boolean> {
    try {
      const eventId = Sentry.captureMessage(
        '主进程Sentry初始化检测测试消息',
        'info'
      );

      if (eventId) {
        this.log('✅ 主进程错误捕获功能正常');
        return true;
      }
      this.log('⚠️  主进程错误捕获功能可能异常');
      return false;
    } catch (error) {
      this.log(`❌ 主进程错误捕获测试失败: ${error}`);
      return false;
    }
  }

  /**
   * 检查主进程会话跟踪状态
   */
  private checkMainSessionTracking(): boolean {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();

      const sessionTracking = (options as any)?.autoSessionTracking;

      if (sessionTracking) {
        this.log('✅ 主进程会话跟踪已启用');
        return true;
      }
      this.log('⚠️  主进程会话跟踪未启用');
      return false;
    } catch (error) {
      this.log(`❌ 主进程会话跟踪检查出错: ${error}`);
      return false;
    }
  }

  /**
   * 检查主进程性能监控状态
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
      this.log('⚠️  主进程性能监控未启用或采样率为0');
      return false;
    } catch (error) {
      this.log(`❌ 主进程性能监控检查出错: ${error}`);
      return false;
    }
  }

  /**
   * 检查Electron集成状态
   */
  private checkElectronIntegration(): boolean {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();

      // 检查是否有Electron相关的集成
      const integrations = options?.integrations || [];
      const hasElectronIntegrations = integrations.some(
        (integration: any) =>
          integration.name &&
          integration.name.toLowerCase().includes('electron')
      );

      if (hasElectronIntegrations) {
        this.log('✅ Electron集成已正确配置');
        return true;
      }
      this.log('⚠️  未检测到Electron特定集成');
      return false;
    } catch (error) {
      this.log(`❌ Electron集成检查出错: ${error}`);
      return false;
    }
  }

  /**
   * 检查原生错误处理
   */
  private checkNativeErrorHandling(): boolean {
    try {
      // 检查是否绑定了原生错误处理器
      const hasUncaughtExceptionHandler =
        process.listenerCount('uncaughtException') > 0;
      const hasUnhandledRejectionHandler =
        process.listenerCount('unhandledRejection') > 0;

      if (hasUncaughtExceptionHandler && hasUnhandledRejectionHandler) {
        this.log('✅ 原生错误处理已配置');
        return true;
      }
      this.log('⚠️  原生错误处理可能未完全配置');
      return false;
    } catch (error) {
      this.log(`❌ 原生错误处理检查出错: ${error}`);
      return false;
    }
  }

  /**
   * 评估主进程整体初始化状态
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
   * 评估主进程配置有效性
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
   * 生成主进程改进建议
   */
  private generateMainRecommendations(
    result: SentryMainDetectionResult
  ): string[] {
    const recommendations: string[] = [];

    if (!result.details.hasValidHub) {
      recommendations.push(
        '主进程Sentry Hub未正确初始化，请检查主进程中的initSentryMain()调用'
      );
    }

    if (!result.details.hasValidClient) {
      recommendations.push(
        '主进程Sentry Client未连接，请检查DSN配置和网络连接'
      );
    }

    if (!result.details.hasValidDsn) {
      recommendations.push(
        '主进程DSN配置缺失或格式错误，请检查环境变量SENTRY_DSN'
      );
    }

    if (!result.release) {
      recommendations.push('建议配置Release信息，可以使用app.getVersion()');
    }

    if (!result.details.sessionTrackingActive) {
      recommendations.push(
        '建议在主进程中启用autoSessionTracking以监控应用会话'
      );
    }

    if (!result.details.performanceMonitoringActive) {
      recommendations.push('建议启用主进程性能监控以跟踪主进程性能');
    }

    if (!result.details.electronIntegrationActive) {
      recommendations.push(
        '建议启用Electron特定集成以更好地捕获Electron相关错误'
      );
    }

    if (!result.details.nativeErrorHandlingActive) {
      recommendations.push(
        '建议配置uncaughtException和unhandledRejection处理器'
      );
    }

    if (!result.details.captureWorks) {
      recommendations.push(
        '主进程错误捕获功能异常，请检查网络连接和Sentry服务状态'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('主进程Sentry配置优秀，建议定期监控主进程性能指标');
    }

    return recommendations;
  }

  /**
   * 日志输出
   */
  private log(message: string): void {
    if (this.options.verbose) {
      console.log(`[SentryMainDetector] ${message}`);
    }
  }

  /**
   * 获取检测历史
   */
  getDetectionHistory(): SentryMainDetectionResult[] {
    return [...this.detectionHistory];
  }

  /**
   * 清空检测历史
   */
  clearDetectionHistory(): void {
    this.detectionHistory = [];
  }

  /**
   * 获取最近一次检测结果
   */
  getLastDetectionResult(): SentryMainDetectionResult | null {
    return this.detectionHistory.length > 0
      ? this.detectionHistory[this.detectionHistory.length - 1]
      : null;
  }
}

/**
 * 全局主进程Sentry检测器实例
 */
export const sentryMainDetector = new SentryMainDetector();

/**
 * 快速主进程检测函数
 */
export async function quickMainSentryCheck(): Promise<boolean> {
  try {
    const result = await sentryMainDetector.detectMainProcessStatus();
    return result.isInitialized;
  } catch (error) {
    console.error('主进程Sentry快速检测失败:', error);
    return false;
  }
}

/**
 * 详细主进程检测函数
 */
export async function detailedMainSentryCheck(
  options?: Partial<SentryMainDetectionOptions>
): Promise<SentryMainDetectionResult> {
  const detector = new SentryMainDetector(options);
  return await detector.detectMainProcessStatus();
}

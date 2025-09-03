/**
 * Sentry初始化状态检测器
 *
 * 用于检测和验证Sentry服务的初始化状态，确保可观测性系统正常工作
 */

import * as Sentry from '@sentry/electron/renderer';

// 检测结果类型定义
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

// 检测配置选项
export interface SentryDetectionOptions {
  timeout: number;
  performCaptureTest: boolean;
  checkSessionTracking: boolean;
  checkPerformanceMonitoring: boolean;
  verbose: boolean;
}

// 默认检测配置
const DEFAULT_DETECTION_OPTIONS: SentryDetectionOptions = {
  timeout: 5000,
  performCaptureTest: true,
  checkSessionTracking: true,
  checkPerformanceMonitoring: true,
  verbose: false,
};

/**
 * Sentry初始化状态检测器类
 */
export class SentryDetector {
  private options: SentryDetectionOptions;
  private detectionHistory: SentryDetectionResult[] = [];

  constructor(options: Partial<SentryDetectionOptions> = {}) {
    this.options = { ...DEFAULT_DETECTION_OPTIONS, ...options };
  }

  /**
   * 执行完整的Sentry初始化检测
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
      this.log('🔍 开始Sentry初始化状态检测...');

      // 1. 检测Hub状态
      result.hubStatus = await this.checkHubStatus();
      result.details.hasValidHub = result.hubStatus === 'active';

      // 2. 检测Client状态
      result.clientStatus = await this.checkClientStatus();
      result.details.hasValidClient = result.clientStatus === 'connected';

      // 3. 检查DSN配置
      result.details.hasValidDsn = this.checkDsnConfiguration();

      // 4. 检查Release信息
      result.release = this.getRelease();

      // 5. 测试错误捕获功能
      if (this.options.performCaptureTest) {
        result.details.captureWorks = await this.testCaptureFunction();
      }

      // 6. 检查会话跟踪
      if (this.options.checkSessionTracking) {
        result.details.sessionTrackingActive = this.checkSessionTracking();
      }

      // 7. 检查性能监控
      if (this.options.checkPerformanceMonitoring) {
        result.details.performanceMonitoringActive =
          this.checkPerformanceMonitoring();
      }

      // 8. 综合评估
      result.isInitialized = this.evaluateOverallStatus(result);
      result.configurationValid = this.evaluateConfiguration(result);

      // 9. 生成建议
      result.recommendations = this.generateRecommendations(result);

      const duration = Date.now() - startTime;
      this.log(`✅ Sentry检测完成，耗时: ${duration}ms`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.lastError = errorMessage;
      result.recommendations.push('检测过程中发生错误，请检查Sentry配置');
      this.log(`❌ Sentry检测失败: ${errorMessage}`);
    }

    // 记录检测历史
    this.detectionHistory.push(result);
    if (this.detectionHistory.length > 10) {
      this.detectionHistory.shift(); // 只保留最近10次检测记录
    }

    return result;
  }

  /**
   * 检查Sentry Hub状态
   */
  private async checkHubStatus(): Promise<'active' | 'inactive' | 'error'> {
    try {
      const client = Sentry.getClient();

      if (!client) {
        this.log('❌ Sentry Client未找到');
        return 'inactive';
      }

      this.log('✅ Sentry Hub状态正常');
      return 'active';
    } catch (error) {
      this.log(`❌ Sentry Hub检查出错: ${error}`);
      return 'error';
    }
  }

  /**
   * 检查Sentry Client状态
   */
  private async checkClientStatus(): Promise<
    'connected' | 'disconnected' | 'error'
  > {
    try {
      const client = Sentry.getClient();

      if (!client) {
        this.log('❌ Sentry Client未找到');
        return 'disconnected';
      }

      // 检查Client配置
      const options = client.getOptions();
      if (!options || !options.dsn) {
        this.log('⚠️  Sentry Client存在但DSN配置缺失');
        return 'disconnected';
      }

      this.log('✅ Sentry Client状态正常');
      return 'connected';
    } catch (error) {
      this.log(`❌ Sentry Client检查出错: ${error}`);
      return 'error';
    }
  }

  /**
   * 检查DSN配置
   */
  private checkDsnConfiguration(): boolean {
    try {
      const client = Sentry.getClient();
      if (!client) return false;

      const options = client.getOptions();
      const dsn = options?.dsn;

      if (!dsn) {
        this.log('❌ DSN配置缺失');
        return false;
      }

      // 验证DSN格式
      if (
        typeof dsn === 'string' &&
        dsn.startsWith('https://') &&
        dsn.includes('@')
      ) {
        this.log('✅ DSN配置格式正确');
        return true;
      }

      this.log('⚠️  DSN配置格式可能有问题');
      return false;
    } catch (error) {
      this.log(`❌ DSN配置检查出错: ${error}`);
      return false;
    }
  }

  /**
   * 获取Release信息
   */
  private getRelease(): string | undefined {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();
      const release = options?.release;

      if (release) {
        this.log(`✅ Release信息: ${release}`);
      } else {
        this.log('⚠️  Release信息未配置');
      }

      return release;
    } catch (error) {
      this.log(`❌ Release信息获取出错: ${error}`);
      return undefined;
    }
  }

  /**
   * 测试错误捕获功能
   */
  private async testCaptureFunction(): Promise<boolean> {
    try {
      // 发送一个测试事件
      const eventId = Sentry.captureMessage('Sentry初始化检测测试消息', 'info');

      if (eventId) {
        this.log('✅ 错误捕获功能正常');
        return true;
      }
      this.log('⚠️  错误捕获功能可能异常');
      return false;
    } catch (error) {
      this.log(`❌ 错误捕获测试失败: ${error}`);
      return false;
    }
  }

  /**
   * 检查会话跟踪状态
   */
  private checkSessionTracking(): boolean {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();

      // 检查autoSessionTracking配置
      const sessionTracking = options?.autoSessionTracking;

      if (sessionTracking) {
        this.log('✅ 会话跟踪已启用');
        return true;
      }
      this.log('⚠️  会话跟踪未启用');
      return false;
    } catch (error) {
      this.log(`❌ 会话跟踪检查出错: ${error}`);
      return false;
    }
  }

  /**
   * 检查性能监控状态
   */
  private checkPerformanceMonitoring(): boolean {
    try {
      const client = Sentry.getClient();
      const options = client?.getOptions();

      // 检查tracesSampleRate配置
      const tracesSampleRate = options?.tracesSampleRate;

      if (tracesSampleRate !== undefined && tracesSampleRate > 0) {
        this.log(`✅ 性能监控已启用 (采样率: ${tracesSampleRate})`);
        return true;
      }
      this.log('⚠️  性能监控未启用或采样率为0');
      return false;
    } catch (error) {
      this.log(`❌ 性能监控检查出错: ${error}`);
      return false;
    }
  }

  /**
   * 评估整体初始化状态
   */
  private evaluateOverallStatus(result: SentryDetectionResult): boolean {
    const criticalChecks = [
      result.details.hasValidHub,
      result.details.hasValidClient,
      result.details.hasValidDsn,
    ];

    // 所有关键检查都必须通过
    return criticalChecks.every(check => check === true);
  }

  /**
   * 评估配置有效性
   */
  private evaluateConfiguration(result: SentryDetectionResult): boolean {
    const configChecks = [
      result.details.hasValidDsn,
      result.release !== undefined,
      result.details.sessionTrackingActive,
      result.details.performanceMonitoringActive,
    ];

    // 至少75%的配置检查通过
    const passedChecks = configChecks.filter(check => check === true).length;
    return passedChecks >= Math.ceil(configChecks.length * 0.75);
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(result: SentryDetectionResult): string[] {
    const recommendations: string[] = [];

    if (!result.details.hasValidHub) {
      recommendations.push('Sentry Hub未正确初始化，请检查initSentry()调用');
    }

    if (!result.details.hasValidClient) {
      recommendations.push('Sentry Client未连接，请检查DSN配置和网络连接');
    }

    if (!result.details.hasValidDsn) {
      recommendations.push('DSN配置缺失或格式错误，请检查环境变量SENTRY_DSN');
    }

    if (!result.release) {
      recommendations.push('建议配置Release信息以便更好地跟踪版本');
    }

    if (!result.details.sessionTrackingActive) {
      recommendations.push('建议启用会话跟踪以监控应用稳定性');
    }

    if (!result.details.performanceMonitoringActive) {
      recommendations.push('建议启用性能监控以跟踪应用性能');
    }

    if (!result.details.captureWorks) {
      recommendations.push('错误捕获功能异常，请检查网络连接和Sentry服务状态');
    }

    if (recommendations.length === 0) {
      recommendations.push('Sentry配置优秀，建议定期检查Release Health指标');
    }

    return recommendations;
  }

  /**
   * 日志输出
   */
  private log(message: string): void {
    if (this.options.verbose) {
      console.log(`[SentryDetector] ${message}`);
    }
  }

  /**
   * 获取检测历史
   */
  getDetectionHistory(): SentryDetectionResult[] {
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
  getLastDetectionResult(): SentryDetectionResult | null {
    return this.detectionHistory.length > 0
      ? this.detectionHistory[this.detectionHistory.length - 1]
      : null;
  }
}

/**
 * 全局Sentry检测器实例
 */
export const sentryDetector = new SentryDetector();

/**
 * 快速检测函数 - 用于简单的初始化状态检查
 */
export async function quickSentryCheck(): Promise<boolean> {
  try {
    const result = await sentryDetector.detectInitializationStatus();
    return result.isInitialized;
  } catch (error) {
    console.error('Sentry快速检测失败:', error);
    return false;
  }
}

/**
 * 详细检测函数 - 用于获取完整的检测报告
 */
export async function detailedSentryCheck(
  options?: Partial<SentryDetectionOptions>
): Promise<SentryDetectionResult> {
  const detector = new SentryDetector(options);
  return await detector.detectInitializationStatus();
}

/**
 * 用于主进程的Sentry检测器（需要适配主进程API）
 */
export class SentryMainDetector {
  /**
   * 检测主进程Sentry初始化状态
   */
  static async detectMainProcessStatus(): Promise<SentryDetectionResult> {
    try {
      // 这里需要使用主进程的Sentry API
      // 由于当前在渲染进程环境，这个函数主要作为接口定义
      // 实际实现需要在主进程中调用

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
        recommendations: ['主进程Sentry检测需要在主进程中运行'],
      };
    } catch (error) {
      throw new Error(`主进程Sentry检测失败: ${error}`);
    }
  }
}


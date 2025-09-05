/**
 * 可观测性门禁管理器
 *
 * 统一管理和执行所有可观测性相关的检查，提供完整的门禁决策
 */

import {
  SentryDetector,
  sentryDetector,
  type SentryDetectionResult,
} from './sentry-detector';
import {
  SentryMainDetector,
  sentryMainDetector,
  type SentryMainDetectionResult,
} from './sentry-main-detector';
import {
  ConfigValidator,
  configValidator,
  type ConfigValidationResult,
  type Environment,
} from './config-validator';
import {
  LoggingHealthChecker,
  loggingHealthChecker,
  type LoggingHealthResult,
} from './logging-health-checker';

// 门禁检查整体结果
export interface ObservabilityGateResult {
  timestamp: string;
  environment: Environment;
  overall: {
    passed: boolean;
    score: number; // 0-100分
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    recommendation: 'proceed' | 'warning' | 'block';
    confidence: number; // 0-1, 结果置信度
  };
  checks: {
    sentryRenderer: SentryDetectionResult;
    sentryMain: SentryMainDetectionResult;
    configValidation: ConfigValidationResult;
    loggingHealth: LoggingHealthResult;
  };
  gate: {
    p0Issues: GateIssue[]; // P0级别问题，直接阻止
    p1Issues: GateIssue[]; // P1级别问题，警告但不阻止
    p2Issues: GateIssue[]; // P2级别问题，信息性
  };
  metrics: {
    totalDuration: number; // ms
    checkDurations: Record<string, number>;
    memoryUsage: NodeJS.MemoryUsage;
    systemInfo: SystemInfo;
  };
  recommendations: string[];
  summary: string;
}

// 门禁问题
export interface GateIssue {
  id: string;
  category: 'sentry' | 'config' | 'logging' | 'system';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  autoFixable: boolean;
}

// 系统信息
export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  electronVersion?: string;
  memoryTotal: number;
  cpuCount: number;
}

// 门禁选项
export interface GatekeeperOptions {
  environment: Environment;
  strictMode: boolean; // 严格模式下P1问题也会阻止
  skipLongRunningChecks: boolean;
  timeoutMs: number;
  enableParallelChecks: boolean;
  generateDetailedReports: boolean;
  verbose: boolean;
}

const DEFAULT_GATEKEEPER_OPTIONS: GatekeeperOptions = {
  environment: (process.env.NODE_ENV as Environment) || 'development',
  strictMode: false,
  skipLongRunningChecks: false,
  timeoutMs: 30000,
  enableParallelChecks: true,
  generateDetailedReports: true,
  verbose: false,
};

/**
 * 可观测性门禁管理器类
 */
export class ObservabilityGatekeeper {
  private options: GatekeeperOptions;

  constructor(options: Partial<GatekeeperOptions> = {}) {
    this.options = { ...DEFAULT_GATEKEEPER_OPTIONS, ...options };
  }

  /**
   * 执行完整的可观测性门禁检查
   */
  async runFullGateCheck(): Promise<ObservabilityGateResult> {
    const startTime = Date.now();

    this.log('🚪 开始可观测性门禁检查...');
    this.log(
      `📊 环境: ${this.options.environment}, 严格模式: ${this.options.strictMode}`
    );

    const result: ObservabilityGateResult = {
      timestamp: new Date().toISOString(),
      environment: this.options.environment,
      overall: {
        passed: false,
        score: 0,
        grade: 'F',
        recommendation: 'block',
        confidence: 0,
      },
      checks: {} as any,
      gate: {
        p0Issues: [],
        p1Issues: [],
        p2Issues: [],
      },
      metrics: {
        totalDuration: 0,
        checkDurations: {},
        memoryUsage: process.memoryUsage(),
        systemInfo: this.collectSystemInfo(),
      },
      recommendations: [],
      summary: '',
    };

    try {
      // 根据配置决定执行方式
      if (
        this.options.enableParallelChecks &&
        !this.options.skipLongRunningChecks
      ) {
        await this.runParallelChecks(result);
      } else {
        await this.runSequentialChecks(result);
      }

      // 分析结果并生成门禁决策
      await this.analyzeResults(result);
      this.generateGateDecision(result);
      this.generateRecommendations(result);
      this.generateSummary(result);

      result.metrics.totalDuration = Date.now() - startTime;

      this.log(
        `✅ 门禁检查完成，总分: ${result.overall.score}, 决策: ${result.overall.recommendation}`
      );
    } catch (error) {
      this.log(`❌ 门禁检查失败: ${error}`);

      // 创建失败结果
      result.overall.recommendation = 'block';
      result.gate.p0Issues.push({
        id: 'gate_check_failure',
        category: 'system',
        severity: 'critical',
        title: '门禁检查执行失败',
        description: `门禁检查过程中发生错误: ${error}`,
        impact: '无法确保可观测性系统正常工作',
        recommendation: '修复门禁检查脚本错误后重试',
        autoFixable: false,
      });

      result.metrics.totalDuration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * 并行执行检查
   */
  private async runParallelChecks(
    result: ObservabilityGateResult
  ): Promise<void> {
    this.log('⚡ 并行执行所有检查...');

    const checkPromises = [
      this.timedCheck('sentryRenderer', () =>
        sentryDetector.detectInitializationStatus()
      ),
      this.timedCheck('sentryMain', () =>
        sentryMainDetector.detectMainProcessStatus()
      ),
      this.timedCheck('configValidation', () =>
        configValidator.validateEnvironment(this.options.environment)
      ),
      this.timedCheck('loggingHealth', () =>
        loggingHealthChecker.performHealthCheck()
      ),
    ];

    const checkResults = await Promise.allSettled(checkPromises);

    // 处理结果
    for (let i = 0; i < checkResults.length; i++) {
      const checkResult = checkResults[i];
      const checkName = [
        'sentryRenderer',
        'sentryMain',
        'configValidation',
        'loggingHealth',
      ][i];

      if (checkResult.status === 'fulfilled') {
        const { duration, result: checkData } = checkResult.value;
        result.metrics.checkDurations[checkName] = duration;

        switch (checkName) {
          case 'sentryRenderer':
            result.checks.sentryRenderer = checkData as SentryDetectionResult;
            break;
          case 'sentryMain':
            result.checks.sentryMain = checkData as SentryMainDetectionResult;
            break;
          case 'configValidation':
            result.checks.configValidation =
              checkData as ConfigValidationResult;
            break;
          case 'loggingHealth':
            result.checks.loggingHealth = checkData as LoggingHealthResult;
            break;
        }
      } else {
        this.log(`❌ ${checkName} 检查失败: ${checkResult.reason}`);
        result.gate.p0Issues.push({
          id: `${checkName}_check_failed`,
          category: 'system',
          severity: 'critical',
          title: `${checkName} 检查失败`,
          description: `无法执行 ${checkName} 检查: ${checkResult.reason}`,
          impact: '可观测性系统状态未知',
          recommendation: `修复 ${checkName} 检查相关问题`,
          autoFixable: false,
        });
      }
    }
  }

  /**
   * 顺序执行检查
   */
  private async runSequentialChecks(
    result: ObservabilityGateResult
  ): Promise<void> {
    this.log('🔄 顺序执行所有检查...');

    // 1. Sentry渲染进程检查
    try {
      const { duration, result: sentryResult } = await this.timedCheck(
        'sentryRenderer',
        () => sentryDetector.detectInitializationStatus()
      );
      result.checks.sentryRenderer = sentryResult;
      result.metrics.checkDurations.sentryRenderer = duration;
      this.log(`✅ Sentry渲染进程检查完成 (${duration}ms)`);
    } catch (error) {
      this.handleCheckError('sentryRenderer', error, result);
    }

    // 2. Sentry主进程检查
    try {
      const { duration, result: sentryMainResult } = await this.timedCheck(
        'sentryMain',
        () => sentryMainDetector.detectMainProcessStatus()
      );
      result.checks.sentryMain = sentryMainResult;
      result.metrics.checkDurations.sentryMain = duration;
      this.log(`✅ Sentry主进程检查完成 (${duration}ms)`);
    } catch (error) {
      this.handleCheckError('sentryMain', error, result);
    }

    // 3. 配置验证检查
    try {
      const { duration, result: configResult } = await this.timedCheck(
        'configValidation',
        () => configValidator.validateEnvironment(this.options.environment)
      );
      result.checks.configValidation = configResult;
      result.metrics.checkDurations.configValidation = duration;
      this.log(`✅ 配置验证检查完成 (${duration}ms)`);
    } catch (error) {
      this.handleCheckError('configValidation', error, result);
    }

    // 4. 日志健康检查
    if (!this.options.skipLongRunningChecks) {
      try {
        const { duration, result: loggingResult } = await this.timedCheck(
          'loggingHealth',
          () => loggingHealthChecker.performHealthCheck()
        );
        result.checks.loggingHealth = loggingResult;
        result.metrics.checkDurations.loggingHealth = duration;
        this.log(`✅ 日志健康检查完成 (${duration}ms)`);
      } catch (error) {
        this.handleCheckError('loggingHealth', error, result);
      }
    } else {
      this.log('⏭️  跳过日志健康检查（长时间运行检查已禁用）');
    }
  }

  /**
   * 分析检查结果
   */
  private async analyzeResults(result: ObservabilityGateResult): Promise<void> {
    this.log('🔍 分析检查结果...');

    // 分析Sentry检查结果
    if (result.checks.sentryRenderer) {
      this.analyzeSentryResults(
        result.checks.sentryRenderer,
        'renderer',
        result
      );
    }

    if (result.checks.sentryMain) {
      this.analyzeSentryMainResults(result.checks.sentryMain, result);
    }

    // 分析配置验证结果
    if (result.checks.configValidation) {
      this.analyzeConfigResults(result.checks.configValidation, result);
    }

    // 分析日志健康结果
    if (result.checks.loggingHealth) {
      this.analyzeLoggingResults(result.checks.loggingHealth, result);
    }
  }

  /**
   * 分析Sentry渲染进程结果
   */
  private analyzeSentryResults(
    sentryResult: SentryDetectionResult,
    process: string,
    result: ObservabilityGateResult
  ): void {
    if (!sentryResult.isInitialized) {
      result.gate.p0Issues.push({
        id: `sentry_${process}_not_initialized`,
        category: 'sentry',
        severity: 'critical',
        title: `Sentry${process}进程未初始化`,
        description: 'Sentry服务未正确初始化，错误和性能数据无法收集',
        impact: '可观测性能力完全丧失',
        recommendation: '检查Sentry配置和初始化代码',
        autoFixable: false,
      });
    }

    if (!sentryResult.details.hasValidDsn) {
      result.gate.p0Issues.push({
        id: `sentry_${process}_invalid_dsn`,
        category: 'sentry',
        severity: 'critical',
        title: `Sentry${process}进程DSN无效`,
        description: 'Sentry DSN配置缺失或格式错误',
        impact: '无法将错误数据发送到Sentry服务',
        recommendation: '检查SENTRY_DSN环境变量配置',
        autoFixable: false,
      });
    }

    if (!sentryResult.details.captureWorks) {
      result.gate.p1Issues.push({
        id: `sentry_${process}_capture_failed`,
        category: 'sentry',
        severity: 'high',
        title: `Sentry${process}进程错误捕获失败`,
        description: 'Sentry错误捕获功能异常',
        impact: '错误可能无法正确上报',
        recommendation: '检查网络连接和Sentry服务状态',
        autoFixable: false,
      });
    }
  }

  /**
   * 分析Sentry主进程结果
   */
  private analyzeSentryMainResults(
    sentryMainResult: SentryMainDetectionResult,
    result: ObservabilityGateResult
  ): void {
    if (!sentryMainResult.isInitialized) {
      result.gate.p0Issues.push({
        id: 'sentry_main_not_initialized',
        category: 'sentry',
        severity: 'critical',
        title: 'Sentry主进程未初始化',
        description: 'Sentry主进程服务未正确初始化',
        impact: '主进程错误和性能数据无法收集',
        recommendation: '检查主进程Sentry配置和初始化代码',
        autoFixable: false,
      });
    }

    if (!sentryMainResult.details.electronIntegrationActive) {
      result.gate.p1Issues.push({
        id: 'sentry_electron_integration_missing',
        category: 'sentry',
        severity: 'high',
        title: 'Electron集成缺失',
        description: 'Sentry Electron特定集成未启用',
        impact: 'Electron特定错误可能无法正确捕获',
        recommendation: '启用Sentry Electron集成',
        autoFixable: true,
      });
    }
  }

  /**
   * 分析配置验证结果
   */
  private analyzeConfigResults(
    configResult: ConfigValidationResult,
    result: ObservabilityGateResult
  ): void {
    if (!configResult.isValid) {
      result.gate.p0Issues.push({
        id: 'config_validation_failed',
        category: 'config',
        severity: 'critical',
        title: '配置验证失败',
        description: `${this.options.environment} 环境配置验证失败`,
        impact: '环境配置不符合要求，可能导致系统不稳定',
        recommendation: '修复配置验证中发现的问题',
        autoFixable: false,
      });
    }

    // 分析Critical问题
    for (const issue of configResult.criticalIssues) {
      result.gate.p0Issues.push({
        id: `config_critical_${Date.now()}`,
        category: 'config',
        severity: 'critical',
        title: '配置关键问题',
        description: issue,
        impact: '关键配置缺失，影响系统正常运行',
        recommendation: '立即修复配置问题',
        autoFixable: false,
      });
    }

    // 分析Warning问题
    for (const warning of configResult.warnings) {
      result.gate.p1Issues.push({
        id: `config_warning_${Date.now()}`,
        category: 'config',
        severity: 'high',
        title: '配置警告',
        description: warning,
        impact: '配置不是最优，可能影响性能或稳定性',
        recommendation: '考虑优化配置',
        autoFixable: true,
      });
    }
  }

  /**
   * 分析日志健康结果
   */
  private analyzeLoggingResults(
    loggingResult: LoggingHealthResult,
    result: ObservabilityGateResult
  ): void {
    if (!loggingResult.overall.healthy) {
      result.gate.p1Issues.push({
        id: 'logging_unhealthy',
        category: 'logging',
        severity: 'high',
        title: '日志系统不健康',
        description: '日志系统健康检查未通过',
        impact: '日志功能可能受影响，影响问题排查能力',
        recommendation: '检查和修复日志系统问题',
        autoFixable: false,
      });
    }

    // 分析具体的日志问题
    for (const issue of loggingResult.issues) {
      const gateIssue: GateIssue = {
        id: `logging_${issue.category}_${Date.now()}`,
        category: 'logging',
        severity: issue.severity,
        title: `日志${issue.category}问题`,
        description: issue.message,
        impact: '影响日志系统功能',
        recommendation: issue.recommendation,
        autoFixable: false,
      };

      if (issue.severity === 'critical') {
        result.gate.p0Issues.push(gateIssue);
      } else if (issue.severity === 'high') {
        result.gate.p1Issues.push(gateIssue);
      } else {
        result.gate.p2Issues.push(gateIssue);
      }
    }
  }

  /**
   * 生成门禁决策
   */
  private generateGateDecision(result: ObservabilityGateResult): void {
    // 计算总体分数
    const scores: number[] = [];

    if (result.checks.sentryRenderer) {
      scores.push(result.checks.sentryRenderer.isInitialized ? 100 : 0);
    }

    if (result.checks.sentryMain) {
      scores.push(result.checks.sentryMain.isInitialized ? 100 : 0);
    }

    if (result.checks.configValidation) {
      scores.push(result.checks.configValidation.overall.score);
    }

    if (result.checks.loggingHealth) {
      scores.push(result.checks.loggingHealth.overall.score);
    }

    result.overall.score =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

    // 计算等级
    if (result.overall.score >= 90) result.overall.grade = 'A';
    else if (result.overall.score >= 80) result.overall.grade = 'B';
    else if (result.overall.score >= 70) result.overall.grade = 'C';
    else if (result.overall.score >= 60) result.overall.grade = 'D';
    else result.overall.grade = 'F';

    // 门禁决策逻辑
    const hasP0Issues = result.gate.p0Issues.length > 0;
    const hasP1Issues = result.gate.p1Issues.length > 0;
    const strictModeP1Block = this.options.strictMode && hasP1Issues;

    if (hasP0Issues || strictModeP1Block) {
      result.overall.passed = false;
      result.overall.recommendation = 'block';
      result.overall.confidence = 0.95;
    } else if (hasP1Issues) {
      result.overall.passed = true;
      result.overall.recommendation = 'warning';
      result.overall.confidence = 0.75;
    } else {
      result.overall.passed = true;
      result.overall.recommendation = 'proceed';
      result.overall.confidence = 0.9;
    }
  }

  /**
   * 生成建议
   */
  private generateRecommendations(result: ObservabilityGateResult): void {
    const recommendations: string[] = [];

    // 基于门禁决策的建议
    switch (result.overall.recommendation) {
      case 'block':
        recommendations.push(
          '🚫 门禁被阻止，请立即修复所有Critical级别问题后重试'
        );
        recommendations.push(
          '📋 优先处理P0级别问题，这些问题会直接影响可观测性能力'
        );
        break;
      case 'warning':
        recommendations.push(
          '⚠️ 门禁通过但有警告，建议在下次迭代中修复P1级别问题'
        );
        recommendations.push('📈 虽然可以继续，但监控能力可能受到影响');
        break;
      case 'proceed':
        recommendations.push('✅ 门禁检查通过，可观测性系统工作正常');
        recommendations.push('🔄 建议定期运行门禁检查以确保系统健康');
        break;
    }

    // 基于环境的建议
    if (this.options.environment === 'production') {
      recommendations.push('🏭 生产环境建议启用所有监控功能并设置合适的采样率');
    } else if (this.options.environment === 'development') {
      recommendations.push('🔧 开发环境建议启用详细日志以便调试');
    }

    // 基于分数的建议
    if (result.overall.score < 60) {
      recommendations.push('📉 可观测性系统得分较低，建议全面检查和优化配置');
    } else if (result.overall.score < 80) {
      recommendations.push('📊 可观测性系统基本正常，建议优化配置以提高可靠性');
    }

    result.recommendations = recommendations;
  }

  /**
   * 生成摘要
   */
  private generateSummary(result: ObservabilityGateResult): void {
    const { overall, gate } = result;
    const totalIssues =
      gate.p0Issues.length + gate.p1Issues.length + gate.p2Issues.length;

    let summary = `门禁检查${overall.passed ? '通过' : '失败'} (${overall.grade}级, ${overall.score}分)\n`;
    summary += `发现问题: P0=${gate.p0Issues.length}, P1=${gate.p1Issues.length}, P2=${gate.p2Issues.length}\n`;
    summary += `建议: ${overall.recommendation === 'proceed' ? '继续部署' : overall.recommendation === 'warning' ? '警告部署' : '阻止部署'}\n`;
    summary += `置信度: ${Math.round(overall.confidence * 100)}%`;

    result.summary = summary;
  }

  // 辅助方法

  private async timedCheck<T>(
    name: string,
    checkFn: () => Promise<T>
  ): Promise<{ duration: number; result: T }> {
    const startTime = Date.now();
    const result = await Promise.race([
      checkFn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${name} 检查超时`)),
          this.options.timeoutMs
        )
      ),
    ]);
    const duration = Date.now() - startTime;
    return { duration, result };
  }

  private handleCheckError(
    checkName: string,
    error: any,
    result: ObservabilityGateResult
  ): void {
    this.log(`❌ ${checkName} 检查失败: ${error}`);
    result.gate.p0Issues.push({
      id: `${checkName}_failed`,
      category: 'system',
      severity: 'critical',
      title: `${checkName} 检查失败`,
      description: `无法执行 ${checkName} 检查: ${error}`,
      impact: '无法验证该部分可观测性功能',
      recommendation: `修复 ${checkName} 检查相关问题`,
      autoFixable: false,
    });
  }

  private collectSystemInfo(): SystemInfo {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      memoryTotal: process.memoryUsage().heapTotal,
      cpuCount: require('os').cpus().length,
    };
  }

  private log(message: string): void {
    if (this.options.verbose) {
      console.log(`[ObservabilityGatekeeper] ${message}`);
    }
  }
}

// 导出默认实例
export const observabilityGatekeeper = new ObservabilityGatekeeper();

// 便捷函数
export async function runQuickGateCheck(
  environment?: Environment
): Promise<ObservabilityGateResult> {
  const gatekeeper = new ObservabilityGatekeeper({
    environment:
      environment || (process.env.NODE_ENV as Environment) || 'development',
    skipLongRunningChecks: true,
    verbose: false,
  });
  return await gatekeeper.runFullGateCheck();
}

export async function runFullGateCheck(
  environment?: Environment
): Promise<ObservabilityGateResult> {
  const gatekeeper = new ObservabilityGatekeeper({
    environment:
      environment || (process.env.NODE_ENV as Environment) || 'development',
    strictMode: environment === 'production',
    verbose: true,
  });
  return await gatekeeper.runFullGateCheck();
}

export async function runStrictGateCheck(
  environment?: Environment
): Promise<ObservabilityGateResult> {
  const gatekeeper = new ObservabilityGatekeeper({
    environment:
      environment || (process.env.NODE_ENV as Environment) || 'development',
    strictMode: true,
    verbose: true,
  });
  return await gatekeeper.runFullGateCheck();
}

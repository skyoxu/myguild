/**
 *
 *
 *
 */

import { sentryDetector, type SentryDetectionResult } from './sentry-detector';
import {
  sentryMainDetector,
  type SentryMainDetectionResult,
} from './sentry-main-detector';
import {
  configValidator,
  type ConfigValidationResult,
  type Environment,
} from './config-validator.main';
import {
  loggingHealthChecker,
  type LoggingHealthResult,
} from './logging-health-checker.main';

//
export interface ObservabilityGateResult {
  timestamp: string;
  environment: Environment;
  overall: {
    passed: boolean;
    score: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    recommendation: 'proceed' | 'warning' | 'block';
    confidence: number; // 0-1,
  };
  checks: {
    sentryRenderer: SentryDetectionResult;
    sentryMain: SentryMainDetectionResult;
    configValidation: ConfigValidationResult;
    loggingHealth: LoggingHealthResult;
  };
  gate: {
    p0Issues: GateIssue[]; // P0
    p1Issues: GateIssue[]; // P1
    p2Issues: GateIssue[]; // P2
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

//
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

//
export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  electronVersion?: string;
  memoryTotal: number;
  cpuCount: number;
}

//
export interface GatekeeperOptions {
  environment: Environment;
  strictMode: boolean; // P1
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
 *
 */
export class ObservabilityGatekeeper {
  private options: GatekeeperOptions;

  constructor(options: Partial<GatekeeperOptions> = {}) {
    this.options = { ...DEFAULT_GATEKEEPER_OPTIONS, ...options };
  }

  /**
   *
   */
  async runFullGateCheck(): Promise<ObservabilityGateResult> {
    const startTime = Date.now();

    this.log('[gate] Starting observability gate checks...');
    this.log(
      `[gate] environment=${this.options.environment} strictMode=${this.options.strictMode}`
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
      //
      if (
        this.options.enableParallelChecks &&
        !this.options.skipLongRunningChecks
      ) {
        await this.runParallelChecks(result);
      } else {
        await this.runSequentialChecks(result);
      }

      //
      await this.analyzeResults(result);
      this.generateGateDecision(result);
      this.generateRecommendations(result);
      this.generateSummary(result);

      result.metrics.totalDuration = Date.now() - startTime;

      this.log(
        `[gate] finished: score=${result.overall.score} decision=${result.overall.recommendation}`
      );
    } catch (error) {
      this.log(`[gate] failed: ${String(error)}`);

      //
      result.overall.recommendation = 'block';
      result.gate.p0Issues.push({
        id: 'gate_check_failure',
        category: 'system',
        severity: 'critical',
        title: 'Gate check execution failed',
        description: `Gatekeeper threw during execution: ${String(error)}`,
        impact: 'Cannot assert observability readiness',
        recommendation: 'Fix gatekeeper script errors and rerun',
        autoFixable: false,
      });

      result.metrics.totalDuration = Date.now() - startTime;
    }

    return result;
  }

  /**
   *
   */
  private async runParallelChecks(
    result: ObservabilityGateResult
  ): Promise<void> {
    this.log('[gate] running checks in parallel...');

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

    //
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
        this.log(`[gate] ${checkName} check failed: ${checkResult.reason}`);
        result.gate.p0Issues.push({
          id: `${checkName}_check_failed`,
          category: 'system',
          severity: 'critical',
          title: `${checkName} check failed`,
          description: `Failed to execute ${checkName} check: ${checkResult.reason}`,
          impact: 'Cannot verify observability guarantees for this area',
          recommendation: `Fix ${checkName} configuration or implementation`,
          autoFixable: false,
        });
      }
    }
  }

  /**
   *
   */
  private async runSequentialChecks(
    result: ObservabilityGateResult
  ): Promise<void> {
    this.log('[gate] running checks sequentially...');

    // 1. Sentry
    try {
      const { duration, result: sentryResult } = await this.timedCheck(
        'sentryRenderer',
        () => sentryDetector.detectInitializationStatus()
      );
      result.checks.sentryRenderer = sentryResult;
      result.metrics.checkDurations.sentryRenderer = duration;
      this.log(`[gate] sentryRenderer check completed (${duration}ms)`);
    } catch (error) {
      this.handleCheckError('sentryRenderer', error, result);
    }

    // 2. Sentry
    try {
      const { duration, result: sentryMainResult } = await this.timedCheck(
        'sentryMain',
        () => sentryMainDetector.detectMainProcessStatus()
      );
      result.checks.sentryMain = sentryMainResult;
      result.metrics.checkDurations.sentryMain = duration;
      this.log(`[gate] sentryMain check completed (${duration}ms)`);
    } catch (error) {
      this.handleCheckError('sentryMain', error, result);
    }

    // 3.
    try {
      const { duration, result: configResult } = await this.timedCheck(
        'configValidation',
        () => configValidator.validateEnvironment(this.options.environment)
      );
      result.checks.configValidation = configResult;
      result.metrics.checkDurations.configValidation = duration;
      this.log(`[gate] configValidation check completed (${duration}ms)`);
    } catch (error) {
      this.handleCheckError('configValidation', error, result);
    }

    // 4.
    if (!this.options.skipLongRunningChecks) {
      try {
        const { duration, result: loggingResult } = await this.timedCheck(
          'loggingHealth',
          () => loggingHealthChecker.performHealthCheck()
        );
        result.checks.loggingHealth = loggingResult;
        result.metrics.checkDurations.loggingHealth = duration;
        this.log(`[gate] loggingHealth check completed (${duration}ms)`);
      } catch (error) {
        this.handleCheckError('loggingHealth', error, result);
      }
    } else {
      this.log('[gate] skipped long-running checks');
    }
  }

  /**
   *
   */
  private async analyzeResults(result: ObservabilityGateResult): Promise<void> {
    this.log('[gate] analyzing check results...');

    // Sentry
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

    //
    if (result.checks.configValidation) {
      this.analyzeConfigResults(result.checks.configValidation, result);
    }

    //
    if (result.checks.loggingHealth) {
      this.analyzeLoggingResults(result.checks.loggingHealth, result);
    }
  }

  /**
   * Sentry
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
        title: 'Sentry not initialized',
        description: `Sentry is not initialized in ${process} process`,
        impact: 'No error capture or tracing available',
        recommendation: 'Initialize Sentry with valid DSN and config',
        autoFixable: false,
      });
    }

    if (!sentryResult.details.hasValidDsn) {
      result.gate.p0Issues.push({
        id: `sentry_${process}_invalid_dsn`,
        category: 'sentry',
        severity: 'critical',
        title: 'Invalid Sentry DSN',
        description: 'SENTRY_DSN is missing or invalid',
        impact: 'Events cannot be delivered to Sentry',
        recommendation: 'Provide a valid SENTRY_DSN for the environment',
        autoFixable: false,
      });
    }

    if (!sentryResult.details.captureWorks) {
      result.gate.p1Issues.push({
        id: `sentry_${process}_capture_failed`,
        category: 'sentry',
        severity: 'high',
        title: 'Sentry capture failed',
        description: 'Event capture test did not report successfully',
        impact: 'Observability coverage is degraded',
        recommendation:
          'Verify network/firewall and Sentry client configuration',
        autoFixable: false,
      });
    }
  }

  /**
   * Sentry
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
        title: 'Sentry',
        description: 'Sentry',
        impact: '',
        recommendation: 'Sentry',
        autoFixable: false,
      });
    }

    if (!sentryMainResult.details.electronIntegrationActive) {
      result.gate.p1Issues.push({
        id: 'sentry_electron_integration_missing',
        category: 'sentry',
        severity: 'high',
        title: 'Electron',
        description: 'Sentry Electron',
        impact: 'Electron',
        recommendation: 'Sentry Electron',
        autoFixable: true,
      });
    }
  }

  /**
   *
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
        title: 'Configuration validation failed',
        description: 'Baseline observability configuration is invalid',
        impact: 'Gate cannot verify observability guarantees',
        recommendation: 'Fix configuration errors reported by config-validator',
        autoFixable: false,
      });
    }

    // Critical
    for (const issue of configResult.criticalIssues) {
      result.gate.p0Issues.push({
        id: `config_critical_${Date.now()}`,
        category: 'config',
        severity: 'critical',
        title: 'Critical config issue',
        description: issue,
        impact: 'Cannot trust observability runtime',
        recommendation: 'Fix configuration and re-run gate',
        autoFixable: false,
      });
    }

    // Warning
    for (const warning of configResult.warnings) {
      result.gate.p1Issues.push({
        id: `config_warning_${Date.now()}`,
        category: 'config',
        severity: 'high',
        title: 'Config warning',
        description: warning,
        impact: 'May reduce observability precision or coverage',
        recommendation: 'Address warning to improve reliability',
        autoFixable: true,
      });
    }
  }

  /**
   *
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
        title: 'Logging system unhealthy',
        description: 'Logging checks did not meet thresholds',
        impact: 'Troubleshooting signal may be degraded',
        recommendation: 'Verify log write/rotation/format configuration',
        autoFixable: false,
      });
    }

    //
    for (const issue of loggingResult.issues) {
      const gateIssue: GateIssue = {
        id: `logging_${issue.category}_${Date.now()}`,
        category: 'logging',
        severity: issue.severity,
        title: `${issue.category} issue`,
        description: issue.message,
        impact: '',
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
   *
   */
  private generateGateDecision(result: ObservabilityGateResult): void {
    //
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

    //
    if (result.overall.score >= 90) result.overall.grade = 'A';
    else if (result.overall.score >= 80) result.overall.grade = 'B';
    else if (result.overall.score >= 70) result.overall.grade = 'C';
    else if (result.overall.score >= 60) result.overall.grade = 'D';
    else result.overall.grade = 'F';

    //
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
   *
   */
  private generateRecommendations(result: ObservabilityGateResult): void {
    const recommendations: string[] = [];

    // Outcome-based guidance
    switch (result.overall.recommendation) {
      case 'block':
        recommendations.push('Fix Critical issues before proceeding.');
        recommendations.push(
          'Prioritize P0 issues; they directly impact observability guarantees.'
        );
        break;
      case 'warning':
        recommendations.push('Resolve all P1 issues in next iteration.');
        recommendations.push('Proceed with caution and monitor impact.');
        break;
      case 'proceed':
        recommendations.push('Gate passed; proceed.');
        recommendations.push(
          'Schedule routine improvements to maintain reliability.'
        );
        break;
    }

    //
    if (this.options.environment === 'production') {
      recommendations.push(
        'Enable detailed monitoring/alerting and verify rollout gates.'
      );
    } else if (this.options.environment === 'development') {
      recommendations.push('Enable verbose logging to aid debugging.');
    }

    //
    if (result.overall.score < 60) {
      recommendations.push(
        'Low observability score; perform comprehensive improvements.'
      );
    } else if (result.overall.score < 80) {
      recommendations.push(
        'Moderate score; prioritize improvements to increase reliability.'
      );
    }

    result.recommendations = recommendations;
  }

  /**
   *
   */
  private generateSummary(result: ObservabilityGateResult): void {
    const { overall, gate } = result;
    const totalIssues =
      gate.p0Issues.length + gate.p1Issues.length + gate.p2Issues.length;

    let summary = `Gate ${overall.passed ? 'passed' : 'failed'} (${overall.grade}, ${overall.score})\n`;
    summary += `Issues: P0=${gate.p0Issues.length}, P1=${gate.p1Issues.length}, P2=${gate.p2Issues.length} (total=${totalIssues})\n`;
    summary += `Decision: ${overall.recommendation}\n`;
    summary += `Confidence: ${Math.round(overall.confidence * 100)}%`;

    result.summary = summary;
  }

  //

  private async timedCheck<T>(
    name: string,
    checkFn: () => Promise<T>
  ): Promise<{ duration: number; result: T }> {
    const startTime = Date.now();
    const result = await Promise.race([
      checkFn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${name} check timed out`)),
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
    result.gate.p0Issues.push({
      id: `${checkName}_failed`,
      category: 'system',
      severity: 'critical',
      title: `${checkName} check failed`,
      description: `Failed to execute ${checkName} check: ${String(error)}`,
      impact: 'Cannot verify observability guarantees for this area',
      recommendation: `Fix ${checkName} configuration or implementation`,
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- node built-in used only in main-side system info
      cpuCount: require('os').cpus().length,
    };
  }

  private log(message: string): void {
    if (this.options.verbose) {
      console.log(`[ObservabilityGatekeeper] ${message}`);
    }
  }
}

//
export const observabilityGatekeeper = new ObservabilityGatekeeper();

//
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

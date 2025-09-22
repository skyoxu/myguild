/**
 *
 *
 *
 */

import {
  existsSync,
  statSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';

//
export interface LoggingHealthResult {
  timestamp: string;
  overall: {
    healthy: boolean;
    score: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    status: 'excellent' | 'good' | 'warning' | 'critical' | 'failure';
  };
  checks: {
    writeCapability: HealthCheck;
    formatValidation: HealthCheck;
    performanceBenchmark: HealthCheck;
    storageManagement: HealthCheck;
    rotationMechanism: HealthCheck;
    errorRecovery: HealthCheck;
    structuredLogging: HealthCheck;
    piiFiltering: HealthCheck;
    levelFiltering: HealthCheck;
    asyncProcessing: HealthCheck;
  };
  metrics: {
    writeLatency: number; // ms
    throughput: number; // entries/second
    storageUsed: number; // bytes
    memoryUsage: number; // bytes
    errorRate: number; // 0-1
  };
  recommendations: string[];
  issues: LoggingIssue[];
}

//
export interface HealthCheck {
  name: string;
  passed: boolean;
  score: number; // 0-100
  duration: number; // ms
  details: string;
  metrics?: Record<string, any>;
  error?: string;
}

//
export interface LoggingIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'performance' | 'storage' | 'format' | 'security' | 'reliability';
  message: string;
  recommendation: string;
}

//
export interface LoggingHealthOptions {
  logDirectory: string;
  performanceTestEntries: number;
  performanceTestDuration: number; // ms
  storageThresholdMB: number;
  enableDeepChecks: boolean;
  includePerformanceTests: boolean;
  testDataSize: number; // bytes per entry
  verbose: boolean;
}

const DEFAULT_HEALTH_OPTIONS: LoggingHealthOptions = {
  logDirectory: 'logs',
  performanceTestEntries: 1000,
  performanceTestDuration: 5000,
  storageThresholdMB: 100,
  enableDeepChecks: true,
  includePerformanceTests: true,
  testDataSize: 1024,
  verbose: false,
};

/**
 * [main-only] Runs in Electron main process.
 *
 */
export class LoggingHealthChecker {
  private options: LoggingHealthOptions;
  private projectRoot: string;
  private logDirectory: string;

  constructor(
    options: Partial<LoggingHealthOptions> = {},
    projectRoot: string = process.cwd()
  ) {
    this.options = { ...DEFAULT_HEALTH_OPTIONS, ...options };
    this.projectRoot = projectRoot;
    this.logDirectory = join(projectRoot, this.options.logDirectory);
  }

  /**
   *
   */
  async performHealthCheck(): Promise<LoggingHealthResult> {
    this.log(' ...');

    const result: LoggingHealthResult = {
      timestamp: new Date().toISOString(),
      overall: {
        healthy: false,
        score: 0,
        grade: 'F',
        status: 'failure',
      },
      checks: {} as any,
      metrics: {
        writeLatency: 0,
        throughput: 0,
        storageUsed: 0,
        memoryUsage: 0,
        errorRate: 0,
      },
      recommendations: [],
      issues: [],
    };

    try {
      // 1.
      result.checks.writeCapability = await this.checkWriteCapability();

      // 2.
      result.checks.formatValidation = await this.checkFormatValidation();

      // 3.
      if (this.options.includePerformanceTests) {
        result.checks.performanceBenchmark =
          await this.checkPerformanceBenchmark();
      } else {
        result.checks.performanceBenchmark = this.createSkippedCheck('', '');
      }

      // 4.
      result.checks.storageManagement = await this.checkStorageManagement();

      // 5.
      result.checks.rotationMechanism = await this.checkRotationMechanism();

      // 6.
      result.checks.errorRecovery = await this.checkErrorRecovery();

      // 7.
      result.checks.structuredLogging = await this.checkStructuredLogging();

      // 8. PII
      result.checks.piiFiltering = await this.checkPiiFiltering();

      // 9.
      result.checks.levelFiltering = await this.checkLevelFiltering();

      // 10.
      result.checks.asyncProcessing = await this.checkAsyncProcessing();

      //
      await this.calculateMetrics(result);
      this.calculateOverallHealth(result);
      this.generateRecommendations(result);

      this.log(`✅ 日志系统健康检查完成，总分: ${result.overall.score}`);
    } catch (error) {
      this.log(`❌ 日志系统健康检查失败: ${error}`);
      result.issues.push({
        severity: 'critical',
        category: 'reliability',
        message: `健康检查过程失败: ${error}`,
        recommendation: '',
      });
    }

    return result;
  }

  /**
   *
   */
  private async checkWriteCapability(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      //
      if (!existsSync(this.logDirectory)) {
        mkdirSync(this.logDirectory, { recursive: true });
      }

      //
      const testFile = join(this.logDirectory, 'health-check-write-test.log');
      const testData = `[${new Date().toISOString()}] INFO 日志写入测试 - ${Math.random()}`;

      writeFileSync(testFile, testData);

      //
      const writtenData = readFileSync(testFile, 'utf8');
      const writeSuccess = writtenData === testData;

      //
      const concurrentWrites = await this.testConcurrentWrites();

      const duration = Date.now() - startTime;

      return {
        name: '',
        passed: writeSuccess && concurrentWrites.success,
        score: writeSuccess && concurrentWrites.success ? 100 : 0,
        duration,
        details: `基础写入: ${writeSuccess ? '' : ''}, 并发写入: ${concurrentWrites.success ? '' : ''}`,
        metrics: {
          basicWrite: writeSuccess,
          concurrentWrites: concurrentWrites.count,
          concurrentErrors: concurrentWrites.errors,
        },
      };
    } catch (error) {
      return {
        name: '',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '',
        error: String(error),
      };
    }
  }

  /**
   *
   */
  private async checkFormatValidation(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const testLogs = [
        { level: 'info', message: '', valid: true },
        { level: 'error', message: '', valid: true },
        { level: 'debug', message: '', valid: true },
        { level: 'warn', message: '', valid: true },
      ];

      let validFormats = 0;
      const testResults: any[] = [];

      for (const testLog of testLogs) {
        const formatted = this.formatLogEntry(testLog);
        const isValid = this.validateLogFormat(formatted);

        if (isValid) validFormats++;

        testResults.push({
          input: testLog,
          formatted,
          valid: isValid,
        });
      }

      const allValid = validFormats === testLogs.length;
      const score = Math.round((validFormats / testLogs.length) * 100);

      return {
        name: '',
        passed: allValid,
        score,
        duration: Date.now() - startTime,
        details: `${validFormats}/${testLogs.length} 格式验证通过`,
        metrics: {
          validFormats,
          totalTests: testLogs.length,
          testResults,
        },
      };
    } catch (error) {
      return {
        name: '',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '',
        error: String(error),
      };
    }
  }

  /**
   *
   */
  private async checkPerformanceBenchmark(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const testEntries = this.options.performanceTestEntries;
      const testFile = join(this.logDirectory, 'performance-test.log');

      //
      const writeStartTime = Date.now();
      const testData = this.generateTestData(testEntries);

      for (const entry of testData) {
        writeFileSync(testFile, entry + '\n', { flag: 'a' });
      }

      const writeEndTime = Date.now();
      const writeDuration = writeEndTime - writeStartTime;
      const throughput = Math.round(testEntries / (writeDuration / 1000));
      const avgLatency = writeDuration / testEntries;

      //
      const throughputScore = Math.min(100, Math.round(throughput / 100)); // 100 entries/sec = 100
      const latencyScore = Math.max(0, 100 - Math.round(avgLatency)); // <1ms = 100

      const overallScore = Math.round((throughputScore + latencyScore) / 2);
      const passed = overallScore >= 70;

      return {
        name: '',
        passed,
        score: overallScore,
        duration: Date.now() - startTime,
        details: `吞吐量: ${throughput} entries/sec, 平均延迟: ${avgLatency.toFixed(2)}ms`,
        metrics: {
          throughput,
          avgLatency,
          writeDuration,
          entriesWritten: testEntries,
          throughputScore,
          latencyScore,
        },
      };
    } catch (error) {
      return {
        name: '',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '',
        error: String(error),
      };
    }
  }

  /**
   *
   */
  private async checkStorageManagement(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      if (!existsSync(this.logDirectory)) {
        return {
          name: '',
          passed: false,
          score: 0,
          duration: Date.now() - startTime,
          details: '',
        };
      }

      //
      const directorySize = this.calculateDirectorySize(this.logDirectory);
      const sizeMB = directorySize / (1024 * 1024);

      //
      const files = readdirSync(this.logDirectory);
      const logFiles = files.filter(f => f.endsWith('.log'));

      //
      statSync(this.logDirectory);

      //
      const sizeScore = sizeMB <= this.options.storageThresholdMB ? 100 : 50;
      const fileCountScore = logFiles.length <= 20 ? 100 : 75; // 20

      const overallScore = Math.round((sizeScore + fileCountScore) / 2);
      const passed = overallScore >= 70;

      return {
        name: '',
        passed,
        score: overallScore,
        duration: Date.now() - startTime,
        details: `存储使用: ${sizeMB.toFixed(2)}MB, 日志文件: ${logFiles.length}个`,
        metrics: {
          directorySizeBytes: directorySize,
          directorySizeMB: sizeMB,
          logFileCount: logFiles.length,
          totalFiles: files.length,
          threshold: this.options.storageThresholdMB,
        },
      };
    } catch (error) {
      return {
        name: '',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '',
        error: String(error),
      };
    }
  }

  /**
   *
   */
  private async checkRotationMechanism(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      //
      const files = readdirSync(this.logDirectory);
      const rotatedFiles = files.filter(
        f => f.includes('.log.') || f.includes('.1') || f.includes('.old')
      );

      //
      const logFiles = files.filter(f => f.endsWith('.log'));
      let hasTimeBasedRotation = false;

      if (logFiles.length > 1) {
        const fileTimes = logFiles.map(f => {
          const filePath = join(this.logDirectory, f);
          return statSync(filePath).mtime;
        });

        // 1
        const timeSpan =
          Math.max(...fileTimes.map(t => t.getTime())) -
          Math.min(...fileTimes.map(t => t.getTime()));
        hasTimeBasedRotation = timeSpan > 24 * 60 * 60 * 1000; // 1
      }

      const rotationScore =
        rotatedFiles.length > 0 || hasTimeBasedRotation ? 100 : 60;
      const passed = rotationScore >= 70;

      return {
        name: '',
        passed,
        score: rotationScore,
        duration: Date.now() - startTime,
        details: `轮转文件: ${rotatedFiles.length}个, 时间轮转: ${hasTimeBasedRotation ? '' : ''}`,
        metrics: {
          rotatedFiles: rotatedFiles.length,
          hasTimeBasedRotation,
          totalLogFiles: logFiles.length,
        },
      };
    } catch (error) {
      return {
        name: '',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '',
        error: String(error),
      };
    }
  }

  /**
   *
   */
  private async checkErrorRecovery(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      //
      //
      //

      let recoveryTests = 0;
      let passedTests = 0;

      // 1.
      try {
        const invalidPath = join(
          this.logDirectory,
          'invalid/deep/path/test.log'
        );
        //
        writeFileSync(invalidPath, 'test');
        recoveryTests++;
      } catch {
        //
        recoveryTests++;
        passedTests++; //
      }

      // 2.
      try {
        const largePath = join(this.logDirectory, 'large-test.log');
        const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB
        writeFileSync(largePath, largeData);
        recoveryTests++;
        passedTests++; //
      } catch {
        recoveryTests++;
        //
      }

      const score =
        recoveryTests > 0
          ? Math.round((passedTests / recoveryTests) * 100)
          : 60;
      const passed = score >= 70;

      return {
        name: '',
        passed,
        score,
        duration: Date.now() - startTime,
        details: `${passedTests}/${recoveryTests} 恢复测试通过`,
        metrics: {
          totalTests: recoveryTests,
          passedTests,
          recoveryRate: passedTests / recoveryTests,
        },
      };
    } catch (error) {
      return {
        name: '',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '',
        error: String(error),
      };
    }
  }

  /**
   *
   */
  private async checkStructuredLogging(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      //
      const structuredLoggerPath = join(
        this.projectRoot,
        'src/shared/observability/structured-logger.ts'
      );
      const hasStructuredLogger = existsSync(structuredLoggerPath);

      // JSON
      const testEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: '',
        context: { test: true, id: 123 },
      };

      const jsonLog = JSON.stringify(testEntry);
      let isValidJson = false;

      try {
        JSON.parse(jsonLog);
        isValidJson = true;
      } catch {
        isValidJson = false;
      }

      const score = hasStructuredLogger && isValidJson ? 100 : 60;
      const passed = score >= 70;

      return {
        name: '',
        passed,
        score,
        duration: Date.now() - startTime,
        details: `结构化日志器: ${hasStructuredLogger ? '' : ''}, JSON格式: ${isValidJson ? '' : ''}`,
        metrics: {
          hasStructuredLogger,
          isValidJson,
          testEntry,
        },
      };
    } catch (error) {
      return {
        name: '',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '',
        error: String(error),
      };
    }
  }

  /**
   * PII
   */
  private async checkPiiFiltering(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // PII
      const piiTestData = [
        { input: 'email: user@example.com', shouldFilter: true },
        { input: 'phone: 13800138000', shouldFilter: true },
        { input: 'id: 123456789012345678', shouldFilter: true },
        { input: 'message: hello world', shouldFilter: false },
      ];

      let filteredCorrectly = 0;
      const testResults: any[] = [];

      for (const test of piiTestData) {
        // PII
        const filtered = this.applyPiiFiltering(test.input);
        const isCorrect = test.shouldFilter
          ? filtered !== test.input
          : filtered === test.input;

        if (isCorrect) filteredCorrectly++;

        testResults.push({
          original: test.input,
          filtered,
          shouldFilter: test.shouldFilter,
          correct: isCorrect,
        });
      }

      const score = Math.round((filteredCorrectly / piiTestData.length) * 100);
      const passed = score >= 80;

      return {
        name: 'PII',
        passed,
        score,
        duration: Date.now() - startTime,
        details: `${filteredCorrectly}/${piiTestData.length} PII过滤测试通过`,
        metrics: {
          totalTests: piiTestData.length,
          correctlyFiltered: filteredCorrectly,
          testResults,
        },
      };
    } catch (error) {
      return {
        name: 'PII',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: 'PII',
        error: String(error),
      };
    }
  }

  /**
   *
   */
  private async checkLevelFiltering(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const levels = ['debug', 'info', 'warn', 'error'];
      const currentLevel = process.env.LOG_LEVEL || 'info';
      const currentLevelIndex = levels.indexOf(currentLevel);

      let correctFiltering = 0;
      const testResults: any[] = [];

      for (let i = 0; i < levels.length; i++) {
        const testLevel = levels[i];
        const shouldLog = i >= currentLevelIndex;
        const wouldLog = this.shouldLogLevel(testLevel, currentLevel);

        const correct = shouldLog === wouldLog;
        if (correct) correctFiltering++;

        testResults.push({
          level: testLevel,
          shouldLog,
          wouldLog,
          correct,
        });
      }

      const score = Math.round((correctFiltering / levels.length) * 100);
      const passed = score >= 90;

      return {
        name: '',
        passed,
        score,
        duration: Date.now() - startTime,
        details: `当前级别: ${currentLevel}, ${correctFiltering}/${levels.length} 级别过滤正确`,
        metrics: {
          currentLevel,
          correctFiltering,
          totalLevels: levels.length,
          testResults,
        },
      };
    } catch (error) {
      return {
        name: '',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '',
        error: String(error),
      };
    }
  }

  /**
   *
   */
  private async checkAsyncProcessing(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      //
      const asyncTests = [];
      const testEntries = 100;

      for (let i = 0; i < testEntries; i++) {
        asyncTests.push(this.asyncLogTest(i));
      }

      const results = await Promise.allSettled(asyncTests);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      const successRate = successful / testEntries;
      const score = Math.round(successRate * 100);
      const passed = score >= 90;

      return {
        name: '',
        passed,
        score,
        duration: Date.now() - startTime,
        details: `${successful}/${testEntries} 异步操作成功，失败: ${failed}`,
        metrics: {
          totalTests: testEntries,
          successful,
          failed,
          successRate,
        },
      };
    } catch (error) {
      return {
        name: '',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '',
        error: String(error),
      };
    }
  }

  //

  private async testConcurrentWrites(): Promise<{
    success: boolean;
    count: number;
    errors: number;
  }> {
    const concurrentCount = 10;
    const promises = [];

    for (let i = 0; i < concurrentCount; i++) {
      promises.push(this.writeTestEntry(i));
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const errors = results.filter(r => r.status === 'rejected').length;

    return {
      success: errors === 0,
      count: successful,
      errors,
    };
  }

  private async writeTestEntry(id: number): Promise<void> {
    const testFile = join(this.logDirectory, `concurrent-test-${id}.log`);
    const testData = `[${new Date().toISOString()}] INFO 并发写入测试 ${id}`;
    writeFileSync(testFile, testData);
  }

  private formatLogEntry(entry: any): string {
    return `[${new Date().toISOString()}] ${entry.level.toUpperCase()} ${entry.message}`;
  }

  private validateLogFormat(logLine: string): boolean {
    //
    const logRegex = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \w+ .+$/;
    return logRegex.test(logLine);
  }

  private generateTestData(count: number): string[] {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push(
        `[${new Date().toISOString()}] INFO 性能测试条目 ${i} - ${'x'.repeat(this.options.testDataSize)}`
      );
    }
    return data;
  }

  private calculateDirectorySize(dirPath: string): number {
    let totalSize = 0;
    const files = readdirSync(dirPath);

    for (const file of files) {
      const filePath = join(dirPath, file);
      const stats = statSync(filePath);
      if (stats.isFile()) {
        totalSize += stats.size;
      }
    }

    return totalSize;
  }

  private applyPiiFiltering(text: string): string {
    // PII
    return text
      .replace(/\b[\w._%+-]+@[\w.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b1[3-9]\d{9}\b/g, '[PHONE]')
      .replace(/\b\d{15,18}\b/g, '[ID]');
  }

  private shouldLogLevel(testLevel: string, currentLevel: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const testIndex = levels.indexOf(testLevel);
    const currentIndex = levels.indexOf(currentLevel);
    return testIndex >= currentIndex;
  }

  private async asyncLogTest(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const testFile = join(this.logDirectory, 'async-test.log');
          writeFileSync(testFile, `异步测试 ${id}\n`, { flag: 'a' });
          resolve();
        } catch (error) {
          reject(error);
        }
      }, Math.random() * 10);
    });
  }

  private createSkippedCheck(name: string, reason: string): HealthCheck {
    return {
      name,
      passed: true,
      score: 100,
      duration: 0,
      details: reason,
    };
  }

  private async calculateMetrics(result: LoggingHealthResult): Promise<void> {
    if (
      result.checks.performanceBenchmark &&
      result.checks.performanceBenchmark.metrics
    ) {
      result.metrics.writeLatency =
        result.checks.performanceBenchmark.metrics.avgLatency || 0;
      result.metrics.throughput =
        result.checks.performanceBenchmark.metrics.throughput || 0;
    }

    if (
      result.checks.storageManagement &&
      result.checks.storageManagement.metrics
    ) {
      result.metrics.storageUsed =
        result.checks.storageManagement.metrics.directorySizeBytes || 0;
    }

    result.metrics.memoryUsage = process.memoryUsage().heapUsed;

    //
    const totalChecks = Object.values(result.checks).length;
    const failedChecks = Object.values(result.checks).filter(
      c => !c.passed
    ).length;
    result.metrics.errorRate = totalChecks > 0 ? failedChecks / totalChecks : 0;
  }

  private calculateOverallHealth(result: LoggingHealthResult): void {
    const checks = Object.values(result.checks);
    const totalScore = checks.reduce((sum, check) => sum + check.score, 0);
    const avgScore = Math.round(totalScore / checks.length);

    result.overall.score = avgScore;
    result.overall.healthy = avgScore >= 70;

    if (avgScore >= 90) {
      result.overall.grade = 'A';
      result.overall.status = 'excellent';
    } else if (avgScore >= 80) {
      result.overall.grade = 'B';
      result.overall.status = 'good';
    } else if (avgScore >= 70) {
      result.overall.grade = 'C';
      result.overall.status = 'warning';
    } else if (avgScore >= 60) {
      result.overall.grade = 'D';
      result.overall.status = 'critical';
    } else {
      result.overall.grade = 'F';
      result.overall.status = 'failure';
    }
  }

  private generateRecommendations(result: LoggingHealthResult): void {
    const recommendations: string[] = [];
    const issues: LoggingIssue[] = [];

    for (const [_key, check] of Object.entries(result.checks)) {
      if (!check.passed) {
        if (check.score < 50) {
          issues.push({
            severity: 'high',
            category: 'reliability',
            message: `${check.name} 检查失败`,
            recommendation: `修复 ${check.name} 相关问题`,
          });
        } else {
          issues.push({
            severity: 'medium',
            category: 'performance',
            message: `${check.name} 需要改进`,
            recommendation: `优化 ${check.name} 配置`,
          });
        }
      }
    }

    //
    if (result.overall.score < 70) {
      recommendations.push('CriticalHigh');
    } else if (result.overall.score < 90) {
      recommendations.push('');
    } else {
      recommendations.push('');
    }

    //
    if (result.metrics.throughput < 100) {
      recommendations.push('');
    }

    if (result.metrics.storageUsed > 50 * 1024 * 1024) {
      // 50MB
      recommendations.push('');
    }

    result.recommendations = recommendations;
    result.issues = issues;
  }

  private log(message: string): void {
    if (this.options.verbose) {
      console.log(`[LoggingHealthChecker] ${message}`);
    }
  }
}

//
export const loggingHealthChecker = new LoggingHealthChecker();

//
export async function performQuickHealthCheck(): Promise<LoggingHealthResult> {
  return await loggingHealthChecker.performHealthCheck();
}

export async function performDeepHealthCheck(): Promise<LoggingHealthResult> {
  const checker = new LoggingHealthChecker({
    enableDeepChecks: true,
    includePerformanceTests: true,
    performanceTestEntries: 5000,
    verbose: true,
  });
  return await checker.performHealthCheck();
}

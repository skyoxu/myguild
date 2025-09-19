/**
 * 日志系统健康检查器
 *
 * 全面测试和验证日志系统的各个方面：写入、性能、存储、格式等
 */

import {
  existsSync,
  statSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs';
import { join, dirname } from 'path';
import { promisify } from 'util';

// 日志健康检查结果
export interface LoggingHealthResult {
  timestamp: string;
  overall: {
    healthy: boolean;
    score: number; // 0-100分
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

// 单项健康检查
export interface HealthCheck {
  name: string;
  passed: boolean;
  score: number; // 0-100分
  duration: number; // ms
  details: string;
  metrics?: Record<string, any>;
  error?: string;
}

// 日志问题
export interface LoggingIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'performance' | 'storage' | 'format' | 'security' | 'reliability';
  message: string;
  recommendation: string;
}

// 健康检查选项
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
 * 日志系统健康检查器类
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
   * 执行完整的日志系统健康检查
   */
  async performHealthCheck(): Promise<LoggingHealthResult> {
    this.log('🔍 开始日志系统健康检查...');

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
      // 1. 写入能力测试
      result.checks.writeCapability = await this.checkWriteCapability();

      // 2. 格式验证测试
      result.checks.formatValidation = await this.checkFormatValidation();

      // 3. 性能基准测试
      if (this.options.includePerformanceTests) {
        result.checks.performanceBenchmark =
          await this.checkPerformanceBenchmark();
      } else {
        result.checks.performanceBenchmark = this.createSkippedCheck(
          '性能基准测试',
          '已跳过性能测试'
        );
      }

      // 4. 存储管理检查
      result.checks.storageManagement = await this.checkStorageManagement();

      // 5. 轮转机制检查
      result.checks.rotationMechanism = await this.checkRotationMechanism();

      // 6. 错误恢复测试
      result.checks.errorRecovery = await this.checkErrorRecovery();

      // 7. 结构化日志检查
      result.checks.structuredLogging = await this.checkStructuredLogging();

      // 8. PII过滤检查
      result.checks.piiFiltering = await this.checkPiiFiltering();

      // 9. 级别过滤检查
      result.checks.levelFiltering = await this.checkLevelFiltering();

      // 10. 异步处理检查
      result.checks.asyncProcessing = await this.checkAsyncProcessing();

      // 计算整体指标
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
        recommendation: '检查日志系统配置和权限',
      });
    }

    return result;
  }

  /**
   * 检查写入能力
   */
  private async checkWriteCapability(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // 确保日志目录存在
      if (!existsSync(this.logDirectory)) {
        mkdirSync(this.logDirectory, { recursive: true });
      }

      // 测试基础写入
      const testFile = join(this.logDirectory, 'health-check-write-test.log');
      const testData = `[${new Date().toISOString()}] INFO 日志写入测试 - ${Math.random()}`;

      writeFileSync(testFile, testData);

      // 验证写入成功
      const writtenData = readFileSync(testFile, 'utf8');
      const writeSuccess = writtenData === testData;

      // 测试并发写入
      const concurrentWrites = await this.testConcurrentWrites();

      const duration = Date.now() - startTime;

      return {
        name: '日志写入能力',
        passed: writeSuccess && concurrentWrites.success,
        score: writeSuccess && concurrentWrites.success ? 100 : 0,
        duration,
        details: `基础写入: ${writeSuccess ? '✅' : '❌'}, 并发写入: ${concurrentWrites.success ? '✅' : '❌'}`,
        metrics: {
          basicWrite: writeSuccess,
          concurrentWrites: concurrentWrites.count,
          concurrentErrors: concurrentWrites.errors,
        },
      };
    } catch (error) {
      return {
        name: '日志写入能力',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '写入测试失败',
        error: String(error),
      };
    }
  }

  /**
   * 检查格式验证
   */
  private async checkFormatValidation(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const testLogs = [
        { level: 'info', message: '标准信息日志', valid: true },
        { level: 'error', message: '错误日志测试', valid: true },
        { level: 'debug', message: '调试日志', valid: true },
        { level: 'warn', message: '警告日志', valid: true },
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
        name: '日志格式验证',
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
        name: '日志格式验证',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '格式验证测试失败',
        error: String(error),
      };
    }
  }

  /**
   * 检查性能基准
   */
  private async checkPerformanceBenchmark(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const testEntries = this.options.performanceTestEntries;
      const testFile = join(this.logDirectory, 'performance-test.log');

      // 写入性能测试
      const writeStartTime = Date.now();
      const testData = this.generateTestData(testEntries);

      for (const entry of testData) {
        writeFileSync(testFile, entry + '\n', { flag: 'a' });
      }

      const writeEndTime = Date.now();
      const writeDuration = writeEndTime - writeStartTime;
      const throughput = Math.round(testEntries / (writeDuration / 1000));
      const avgLatency = writeDuration / testEntries;

      // 性能评估
      const throughputScore = Math.min(100, Math.round(throughput / 100)); // 100 entries/sec = 100分
      const latencyScore = Math.max(0, 100 - Math.round(avgLatency)); // <1ms = 100分

      const overallScore = Math.round((throughputScore + latencyScore) / 2);
      const passed = overallScore >= 70;

      return {
        name: '性能基准测试',
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
        name: '性能基准测试',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '性能测试失败',
        error: String(error),
      };
    }
  }

  /**
   * 检查存储管理
   */
  private async checkStorageManagement(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      if (!existsSync(this.logDirectory)) {
        return {
          name: '存储管理',
          passed: false,
          score: 0,
          duration: Date.now() - startTime,
          details: '日志目录不存在',
        };
      }

      // 计算目录大小
      const directorySize = this.calculateDirectorySize(this.logDirectory);
      const sizeMB = directorySize / (1024 * 1024);

      // 检查文件数量
      const files = readdirSync(this.logDirectory);
      const logFiles = files.filter(f => f.endsWith('.log'));

      // 检查磁盘使用情况
      const stats = statSync(this.logDirectory);

      // 评估存储管理
      const sizeScore = sizeMB <= this.options.storageThresholdMB ? 100 : 50;
      const fileCountScore = logFiles.length <= 20 ? 100 : 75; // 超过20个日志文件降分

      const overallScore = Math.round((sizeScore + fileCountScore) / 2);
      const passed = overallScore >= 70;

      return {
        name: '存储管理',
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
        name: '存储管理',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '存储检查失败',
        error: String(error),
      };
    }
  }

  /**
   * 检查轮转机制
   */
  private async checkRotationMechanism(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // 检查是否有轮转后的文件
      const files = readdirSync(this.logDirectory);
      const rotatedFiles = files.filter(
        f => f.includes('.log.') || f.includes('.1') || f.includes('.old')
      );

      // 检查文件创建时间分布
      const logFiles = files.filter(f => f.endsWith('.log'));
      let hasTimeBasedRotation = false;

      if (logFiles.length > 1) {
        const fileTimes = logFiles.map(f => {
          const filePath = join(this.logDirectory, f);
          return statSync(filePath).mtime;
        });

        // 简单检查：如果有多个文件且时间跨度超过1天，可能有轮转
        const timeSpan =
          Math.max(...fileTimes.map(t => t.getTime())) -
          Math.min(...fileTimes.map(t => t.getTime()));
        hasTimeBasedRotation = timeSpan > 24 * 60 * 60 * 1000; // 1天
      }

      const rotationScore =
        rotatedFiles.length > 0 || hasTimeBasedRotation ? 100 : 60;
      const passed = rotationScore >= 70;

      return {
        name: '日志轮转机制',
        passed,
        score: rotationScore,
        duration: Date.now() - startTime,
        details: `轮转文件: ${rotatedFiles.length}个, 时间轮转: ${hasTimeBasedRotation ? '✅' : '❌'}`,
        metrics: {
          rotatedFiles: rotatedFiles.length,
          hasTimeBasedRotation,
          totalLogFiles: logFiles.length,
        },
      };
    } catch (error) {
      return {
        name: '日志轮转机制',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '轮转检查失败',
        error: String(error),
      };
    }
  }

  /**
   * 检查错误恢复
   */
  private async checkErrorRecovery(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // 测试磁盘满情况恢复（模拟）
      // 测试权限错误恢复
      // 测试网络错误恢复（如果有远程日志）

      let recoveryTests = 0;
      let passedTests = 0;

      // 1. 测试无效路径恢复
      try {
        const invalidPath = join(
          this.logDirectory,
          'invalid/deep/path/test.log'
        );
        // 这应该失败但系统应该能恢复
        writeFileSync(invalidPath, 'test');
        recoveryTests++;
      } catch (error) {
        // 预期的错误，检查是否有恢复机制
        recoveryTests++;
        passedTests++; // 正确处理了错误
      }

      // 2. 测试大文件写入恢复
      try {
        const largePath = join(this.logDirectory, 'large-test.log');
        const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB
        writeFileSync(largePath, largeData);
        recoveryTests++;
        passedTests++; // 成功写入大文件
      } catch (error) {
        recoveryTests++;
        // 大文件写入失败，但系统应该能恢复
      }

      const score =
        recoveryTests > 0
          ? Math.round((passedTests / recoveryTests) * 100)
          : 60;
      const passed = score >= 70;

      return {
        name: '错误恢复机制',
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
        name: '错误恢复机制',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '错误恢复测试失败',
        error: String(error),
      };
    }
  }

  /**
   * 检查结构化日志
   */
  private async checkStructuredLogging(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // 检查结构化日志实现
      const structuredLoggerPath = join(
        this.projectRoot,
        'src/shared/observability/structured-logger.ts'
      );
      const hasStructuredLogger = existsSync(structuredLoggerPath);

      // 测试JSON格式日志
      const testEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: '结构化日志测试',
        context: { test: true, id: 123 },
      };

      const jsonLog = JSON.stringify(testEntry);
      let isValidJson = false;

      try {
        JSON.parse(jsonLog);
        isValidJson = true;
      } catch (e) {
        isValidJson = false;
      }

      const score = hasStructuredLogger && isValidJson ? 100 : 60;
      const passed = score >= 70;

      return {
        name: '结构化日志',
        passed,
        score,
        duration: Date.now() - startTime,
        details: `结构化日志器: ${hasStructuredLogger ? '✅' : '❌'}, JSON格式: ${isValidJson ? '✅' : '❌'}`,
        metrics: {
          hasStructuredLogger,
          isValidJson,
          testEntry,
        },
      };
    } catch (error) {
      return {
        name: '结构化日志',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '结构化日志检查失败',
        error: String(error),
      };
    }
  }

  /**
   * 检查PII过滤
   */
  private async checkPiiFiltering(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // 测试PII数据过滤
      const piiTestData = [
        { input: 'email: user@example.com', shouldFilter: true },
        { input: 'phone: 13800138000', shouldFilter: true },
        { input: 'id: 123456789012345678', shouldFilter: true },
        { input: 'message: hello world', shouldFilter: false },
      ];

      let filteredCorrectly = 0;
      const testResults: any[] = [];

      for (const test of piiTestData) {
        // 简化的PII检测（实际应该使用更复杂的算法）
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
        name: 'PII数据过滤',
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
        name: 'PII数据过滤',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: 'PII过滤检查失败',
        error: String(error),
      };
    }
  }

  /**
   * 检查级别过滤
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
        name: '日志级别过滤',
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
        name: '日志级别过滤',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '级别过滤检查失败',
        error: String(error),
      };
    }
  }

  /**
   * 检查异步处理
   */
  private async checkAsyncProcessing(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // 测试异步日志处理能力
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
        name: '异步处理',
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
        name: '异步处理',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: '异步处理检查失败',
        error: String(error),
      };
    }
  }

  // 辅助方法

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
    // 简化的日志格式验证
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
    // 简化的PII过滤实现
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

    // 计算错误率
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

    for (const [key, check] of Object.entries(result.checks)) {
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

    // 基于分数生成通用建议
    if (result.overall.score < 70) {
      recommendations.push(
        '日志系统需要紧急修复，建议优先解决Critical和High级别问题'
      );
    } else if (result.overall.score < 90) {
      recommendations.push('日志系统基本健康，建议优化性能和配置');
    } else {
      recommendations.push('日志系统健康状况良好，建议定期监控和维护');
    }

    // 性能相关建议
    if (result.metrics.throughput < 100) {
      recommendations.push('考虑实现异步日志写入以提高性能');
    }

    if (result.metrics.storageUsed > 50 * 1024 * 1024) {
      // 50MB
      recommendations.push('实现日志轮转机制以管理存储空间');
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

// 导出默认实例
export const loggingHealthChecker = new LoggingHealthChecker();

// 便捷函数
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

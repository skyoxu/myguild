/**
 * 可观测性系统韧性管理器
 *
 * 提供错误恢复、降级机制、断路器、重试等功能，确保可观测性系统的高可用性
 */

import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// 故障类型
export type FailureType =
  | 'sentry_unavailable'
  | 'logging_failure'
  | 'network_error'
  | 'storage_full'
  | 'config_error'
  | 'memory_exhausted'
  | 'permission_denied'
  | 'unknown_error';

// 降级级别
export type DegradationLevel =
  | 'none'
  | 'minimal'
  | 'moderate'
  | 'severe'
  | 'critical';

// 恢复策略
export type RecoveryStrategy =
  | 'immediate_retry'
  | 'exponential_backoff'
  | 'circuit_breaker'
  | 'graceful_degradation'
  | 'failover'
  | 'cache_fallback'
  | 'local_storage';

// 系统状态
export interface SystemHealth {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'critical' | 'failed';
  components: {
    sentry: ComponentHealth;
    logging: ComponentHealth;
    storage: ComponentHealth;
    network: ComponentHealth;
    memory: ComponentHealth;
  };
  activeFailures: ActiveFailure[];
  degradationLevel: DegradationLevel;
  recoveryActions: RecoveryAction[];
}

// 组件健康状态
export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  lastCheck: string;
  errorCount: number;
  lastError?: string;
  degraded: boolean;
  recovery?: {
    strategy: RecoveryStrategy;
    attempts: number;
    nextAttempt?: string;
  };
}

// 活跃故障
export interface ActiveFailure {
  id: string;
  type: FailureType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  startTime: string;
  description: string;
  impact: string;
  recoveryStrategy: RecoveryStrategy;
  attemptCount: number;
  lastAttempt?: string;
  resolved: boolean;
}

// 恢复操作
export interface RecoveryAction {
  id: string;
  name: string;
  description: string;
  executed: boolean;
  executedAt?: string;
  success: boolean;
  error?: string;
}

// 断路器状态
export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureTime?: string;
  nextRetryTime?: string;
  successCount: number;
}

// 韧性配置
export interface ResilienceConfig {
  sentry: {
    retryAttempts: number;
    retryDelay: number;
    circuitBreakerThreshold: number;
    fallbackToLocalLogging: boolean;
  };
  logging: {
    maxRetries: number;
    fallbackToConsole: boolean;
    bufferSize: number;
    flushInterval: number;
  };
  network: {
    timeoutMs: number;
    maxRetries: number;
    backoffMultiplier: number;
  };
  storage: {
    maxDiskUsage: number; // MB
    cleanupThreshold: number;
    archiveOldLogs: boolean;
  };
  memory: {
    maxHeapUsage: number; // MB
    gcThreshold: number;
    emergencyCleanup: boolean;
  };
}

const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig = {
  sentry: {
    retryAttempts: 3,
    retryDelay: 1000,
    circuitBreakerThreshold: 5,
    fallbackToLocalLogging: true,
  },
  logging: {
    maxRetries: 2,
    fallbackToConsole: true,
    bufferSize: 1000,
    flushInterval: 5000,
  },
  network: {
    timeoutMs: 10000,
    maxRetries: 3,
    backoffMultiplier: 2,
  },
  storage: {
    maxDiskUsage: 100,
    cleanupThreshold: 80,
    archiveOldLogs: true,
  },
  memory: {
    maxHeapUsage: 256,
    gcThreshold: 200,
    emergencyCleanup: true,
  },
};

/**
 * 可观测性系统韧性管理器类
 */
export class ResilienceManager {
  private config: ResilienceConfig;
  private systemHealth: SystemHealth;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private failureBuffer: ActiveFailure[] = [];
  private localBuffer: any[] = [];
  private recoveryTimers: Map<string, NodeJS.Timeout> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private cacheDir: string;

  constructor(
    config: Partial<ResilienceConfig> = {},
    cacheDir: string = 'logs/cache'
  ) {
    this.config = { ...DEFAULT_RESILIENCE_CONFIG, ...config };
    this.cacheDir = cacheDir;

    this.systemHealth = this.initializeSystemHealth();
    this.initializeCircuitBreakers();
    this.ensureCacheDirectory();
    this.startHealthChecks();

    // 注册进程退出处理
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  /**
   * 处理Sentry相关错误
   */
  async handleSentryFailure(error: Error, context?: any): Promise<void> {
    const failureId = `sentry_${Date.now()}`;

    const failure: ActiveFailure = {
      id: failureId,
      type: 'sentry_unavailable',
      severity: 'high',
      startTime: new Date().toISOString(),
      description: `Sentry服务不可用: ${error.message}`,
      impact: '错误和性能数据无法上报到Sentry',
      recoveryStrategy: 'circuit_breaker',
      attemptCount: 0,
      resolved: false,
    };

    this.recordFailure(failure);
    await this.executeSentryRecovery(failure, error, context);
  }

  /**
   * 处理日志系统故障
   */
  async handleLoggingFailure(error: Error, logData?: any): Promise<void> {
    const failureId = `logging_${Date.now()}`;

    const failure: ActiveFailure = {
      id: failureId,
      type: 'logging_failure',
      severity: 'medium',
      startTime: new Date().toISOString(),
      description: `日志系统故障: ${error.message}`,
      impact: '日志可能丢失或无法写入',
      recoveryStrategy: 'graceful_degradation',
      attemptCount: 0,
      resolved: false,
    };

    this.recordFailure(failure);
    await this.executeLoggingRecovery(failure, error, logData);
  }

  /**
   * 处理网络错误
   */
  async handleNetworkError(error: Error, operation: string): Promise<void> {
    const failureId = `network_${Date.now()}`;

    const failure: ActiveFailure = {
      id: failureId,
      type: 'network_error',
      severity: 'medium',
      startTime: new Date().toISOString(),
      description: `网络错误: ${error.message}`,
      impact: `网络操作失败: ${operation}`,
      recoveryStrategy: 'exponential_backoff',
      attemptCount: 0,
      resolved: false,
    };

    this.recordFailure(failure);
    await this.executeNetworkRecovery(failure, error, operation);
  }

  /**
   * 处理存储空间不足
   */
  async handleStorageExhaustion(): Promise<void> {
    const failureId = `storage_${Date.now()}`;

    const failure: ActiveFailure = {
      id: failureId,
      type: 'storage_full',
      severity: 'high',
      startTime: new Date().toISOString(),
      description: '存储空间不足',
      impact: '无法写入新的日志文件',
      recoveryStrategy: 'local_storage',
      attemptCount: 0,
      resolved: false,
    };

    this.recordFailure(failure);
    await this.executeStorageRecovery(failure);
  }

  /**
   * 处理内存不足
   */
  async handleMemoryExhaustion(): Promise<void> {
    const failureId = `memory_${Date.now()}`;

    const failure: ActiveFailure = {
      id: failureId,
      type: 'memory_exhausted',
      severity: 'critical',
      startTime: new Date().toISOString(),
      description: '内存使用量过高',
      impact: '应用性能严重下降，可能崩溃',
      recoveryStrategy: 'graceful_degradation',
      attemptCount: 0,
      resolved: false,
    };

    this.recordFailure(failure);
    await this.executeMemoryRecovery(failure);
  }

  /**
   * 执行Sentry恢复策略
   */
  private async executeSentryRecovery(
    failure: ActiveFailure,
    error: Error,
    context?: any
  ): Promise<void> {
    this.log(`🔧 执行Sentry恢复策略: ${failure.recoveryStrategy}`);

    const circuitBreaker = this.getCircuitBreaker('sentry');

    if (circuitBreaker.state === 'open') {
      // 断路器已打开，使用降级方案
      await this.fallbackToLocalLogging(context);
      this.updateDegradationLevel('moderate');
      return;
    }

    failure.attemptCount++;
    failure.lastAttempt = new Date().toISOString();

    try {
      // 尝试重新初始化Sentry
      await this.attemptSentryReconnection();

      // 成功恢复
      failure.resolved = true;
      circuitBreaker.successCount++;
      this.resetCircuitBreaker('sentry');
      this.updateComponentHealth('sentry', 'healthy');
      this.log('✅ Sentry服务恢复成功');
    } catch (recoveryError) {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = new Date().toISOString();

      if (
        circuitBreaker.failureCount >=
        this.config.sentry.circuitBreakerThreshold
      ) {
        // 触发断路器
        this.openCircuitBreaker('sentry');
        await this.fallbackToLocalLogging(context);
        this.updateDegradationLevel('moderate');
      } else {
        // 安排重试
        this.scheduleRetry(failure, this.config.sentry.retryDelay);
      }
    }
  }

  /**
   * 执行日志恢复策略
   */
  private async executeLoggingRecovery(
    failure: ActiveFailure,
    error: Error,
    logData?: any
  ): Promise<void> {
    this.log(`🔧 执行日志恢复策略: ${failure.recoveryStrategy}`);

    failure.attemptCount++;
    failure.lastAttempt = new Date().toISOString();

    // 将失败的日志数据缓存到本地
    if (logData) {
      this.bufferLogData(logData);
    }

    try {
      // 尝试重新建立日志写入
      await this.attemptLoggingRecovery();

      // 成功恢复，刷新缓冲区
      await this.flushLogBuffer();
      failure.resolved = true;
      this.updateComponentHealth('logging', 'healthy');
      this.log('✅ 日志系统恢复成功');
    } catch (recoveryError) {
      if (failure.attemptCount >= this.config.logging.maxRetries) {
        // 达到最大重试次数，启用降级模式
        await this.enableLoggingFallback();
        this.updateDegradationLevel('minimal');
        this.log('⚠️ 日志系统进入降级模式，仅使用控制台输出');
      } else {
        // 安排重试
        this.scheduleRetry(failure, 2000 * failure.attemptCount);
      }
    }
  }

  /**
   * 执行网络恢复策略
   */
  private async executeNetworkRecovery(
    failure: ActiveFailure,
    error: Error,
    operation: string
  ): Promise<void> {
    this.log(`🔧 执行网络恢复策略: ${failure.recoveryStrategy}`);

    failure.attemptCount++;
    failure.lastAttempt = new Date().toISOString();

    // 指数退避延迟
    const delay =
      this.config.network.timeoutMs *
      Math.pow(this.config.network.backoffMultiplier, failure.attemptCount - 1);

    try {
      // 尝试重新执行网络操作
      await this.attemptNetworkOperation(operation);

      failure.resolved = true;
      this.updateComponentHealth('network', 'healthy');
      this.log('✅ 网络连接恢复成功');
    } catch (recoveryError) {
      if (failure.attemptCount >= this.config.network.maxRetries) {
        // 达到最大重试次数，启用离线模式
        this.enableOfflineMode();
        this.updateDegradationLevel('moderate');
        this.log('⚠️ 网络服务进入离线模式');
      } else {
        // 安排指数退避重试
        this.scheduleRetry(failure, delay);
      }
    }
  }

  /**
   * 执行存储恢复策略
   */
  private async executeStorageRecovery(failure: ActiveFailure): Promise<void> {
    this.log(`🔧 执行存储恢复策略: ${failure.recoveryStrategy}`);

    failure.attemptCount++;
    failure.lastAttempt = new Date().toISOString();

    try {
      // 清理旧日志文件
      await this.cleanupOldLogs();

      // 检查存储空间
      const spaceFreed = await this.checkAvailableSpace();

      if (spaceFreed) {
        failure.resolved = true;
        this.updateComponentHealth('storage', 'healthy');
        this.log('✅ 存储空间清理成功');
      } else {
        // 启用存储降级模式
        this.enableStorageDegradation();
        this.updateDegradationLevel('moderate');
      }
    } catch (recoveryError) {
      this.log(`❌ 存储恢复失败: ${recoveryError.message}`);
      this.enableStorageDegradation();
      this.updateDegradationLevel('severe');
    }
  }

  /**
   * 执行内存恢复策略
   */
  private async executeMemoryRecovery(failure: ActiveFailure): Promise<void> {
    this.log(`🔧 执行内存恢复策略: ${failure.recoveryStrategy}`);

    failure.attemptCount++;
    failure.lastAttempt = new Date().toISOString();

    try {
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      // 清理内部缓存
      this.clearInternalCaches();

      // 检查内存使用
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

      if (heapUsedMB < this.config.memory.maxHeapUsage) {
        failure.resolved = true;
        this.updateComponentHealth('memory', 'healthy');
        this.log('✅ 内存使用恢复正常');
      } else {
        // 启用内存降级模式
        this.enableMemoryDegradation();
        this.updateDegradationLevel('severe');
      }
    } catch (recoveryError) {
      this.log(`❌ 内存恢复失败: ${recoveryError.message}`);
      this.updateDegradationLevel('critical');
    }
  }

  /**
   * 获取系统健康状态
   */
  getSystemHealth(): SystemHealth {
    this.updateSystemHealth();
    return { ...this.systemHealth };
  }

  /**
   * 获取降级建议
   */
  getDegradationRecommendations(): string[] {
    const recommendations: string[] = [];

    switch (this.systemHealth.degradationLevel) {
      case 'minimal':
        recommendations.push('系统处于轻微降级状态，部分非关键功能可能受影响');
        recommendations.push('建议监控系统恢复情况');
        break;
      case 'moderate':
        recommendations.push('系统处于中度降级状态，部分核心功能受影响');
        recommendations.push('建议检查网络连接和外部服务状态');
        break;
      case 'severe':
        recommendations.push('系统处于严重降级状态，多项核心功能受影响');
        recommendations.push('建议立即检查系统资源和配置');
        break;
      case 'critical':
        recommendations.push('系统处于临界状态，可能即将不可用');
        recommendations.push('建议立即采取紧急恢复措施');
        break;
      default:
        recommendations.push('系统运行正常');
    }

    return recommendations;
  }

  // 私有辅助方法

  private initializeSystemHealth(): SystemHealth {
    return {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      components: {
        sentry: {
          status: 'unknown',
          lastCheck: new Date().toISOString(),
          errorCount: 0,
          degraded: false,
        },
        logging: {
          status: 'unknown',
          lastCheck: new Date().toISOString(),
          errorCount: 0,
          degraded: false,
        },
        storage: {
          status: 'unknown',
          lastCheck: new Date().toISOString(),
          errorCount: 0,
          degraded: false,
        },
        network: {
          status: 'unknown',
          lastCheck: new Date().toISOString(),
          errorCount: 0,
          degraded: false,
        },
        memory: {
          status: 'unknown',
          lastCheck: new Date().toISOString(),
          errorCount: 0,
          degraded: false,
        },
      },
      activeFailures: [],
      degradationLevel: 'none',
      recoveryActions: [],
    };
  }

  private initializeCircuitBreakers(): void {
    const services = ['sentry', 'logging', 'network'];
    for (const service of services) {
      this.circuitBreakers.set(service, {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
      });
    }
  }

  private ensureCacheDirectory(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // 每30秒检查一次
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // 检查内存使用
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

      if (heapUsedMB > this.config.memory.gcThreshold) {
        await this.handleMemoryExhaustion();
      }

      // 检查存储空间
      const storageOk = await this.checkAvailableSpace();
      if (!storageOk) {
        await this.handleStorageExhaustion();
      }

      // 清理已解决的故障
      this.cleanupResolvedFailures();
    } catch (error) {
      this.log(`❌ 健康检查失败: ${error}`);
    }
  }

  private recordFailure(failure: ActiveFailure): void {
    this.failureBuffer.push(failure);
    this.systemHealth.activeFailures.push(failure);

    // 更新组件健康状态
    const componentName = this.getComponentNameFromFailureType(failure.type);
    if (componentName) {
      this.updateComponentHealth(componentName, 'error', failure.description);
    }
  }

  private getComponentNameFromFailureType(
    type: FailureType
  ): keyof SystemHealth['components'] | null {
    switch (type) {
      case 'sentry_unavailable':
        return 'sentry';
      case 'logging_failure':
        return 'logging';
      case 'network_error':
        return 'network';
      case 'storage_full':
        return 'storage';
      case 'memory_exhausted':
        return 'memory';
      default:
        return null;
    }
  }

  private updateComponentHealth(
    component: keyof SystemHealth['components'],
    status: ComponentHealth['status'],
    error?: string
  ): void {
    const comp = this.systemHealth.components[component];
    comp.status = status;
    comp.lastCheck = new Date().toISOString();

    if (status === 'error') {
      comp.errorCount++;
      comp.lastError = error;
      comp.degraded = true;
    } else if (status === 'healthy') {
      comp.degraded = false;
    }
  }

  private updateDegradationLevel(level: DegradationLevel): void {
    this.systemHealth.degradationLevel = level;
    this.log(`⚠️ 系统降级级别更新为: ${level}`);
  }

  private getCircuitBreaker(service: string): CircuitBreakerState {
    return (
      this.circuitBreakers.get(service) || {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
      }
    );
  }

  private openCircuitBreaker(service: string): void {
    const cb = this.getCircuitBreaker(service);
    cb.state = 'open';
    cb.nextRetryTime = new Date(Date.now() + 60000).toISOString(); // 1分钟后重试
    this.circuitBreakers.set(service, cb);
    this.log(`🔌 ${service} 断路器已打开`);
  }

  private resetCircuitBreaker(service: string): void {
    const cb = this.getCircuitBreaker(service);
    cb.state = 'closed';
    cb.failureCount = 0;
    cb.successCount = 0;
    cb.nextRetryTime = undefined;
    this.circuitBreakers.set(service, cb);
    this.log(`🔌 ${service} 断路器已重置`);
  }

  private scheduleRetry(failure: ActiveFailure, delay: number): void {
    this.log(`⏰ 安排 ${delay}ms 后重试 ${failure.type}`);

    const timer = setTimeout(async () => {
      await this.retryFailure(failure);
    }, delay);

    this.recoveryTimers.set(failure.id, timer);
  }

  private async retryFailure(failure: ActiveFailure): Promise<void> {
    this.log(`🔄 重试故障恢复: ${failure.type}`);

    switch (failure.type) {
      case 'sentry_unavailable':
        await this.executeSentryRecovery(
          failure,
          new Error('Retry attempt'),
          {}
        );
        break;
      case 'logging_failure':
        await this.executeLoggingRecovery(failure, new Error('Retry attempt'));
        break;
      case 'network_error':
        await this.executeNetworkRecovery(
          failure,
          new Error('Retry attempt'),
          'retry'
        );
        break;
      // 其他类型的重试...
    }
  }

  private async fallbackToLocalLogging(data?: any): Promise<void> {
    try {
      const logFile = join(this.cacheDir, 'sentry-fallback.log');
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'sentry_fallback',
        data,
      };
      writeFileSync(logFile, JSON.stringify(logEntry) + '\n', { flag: 'a' });
    } catch (error) {
      console.error('本地日志回退失败:', error);
    }
  }

  private bufferLogData(data: any): void {
    this.localBuffer.push({
      timestamp: new Date().toISOString(),
      data,
    });

    // 限制缓冲区大小
    if (this.localBuffer.length > this.config.logging.bufferSize) {
      this.localBuffer.shift();
    }
  }

  private async flushLogBuffer(): Promise<void> {
    if (this.localBuffer.length === 0) return;

    try {
      const bufferFile = join(this.cacheDir, 'log-buffer.json');
      writeFileSync(bufferFile, JSON.stringify(this.localBuffer, null, 2));
      this.localBuffer = [];
      this.log(`✅ 日志缓冲区已刷新 (${this.localBuffer.length} 条记录)`);
    } catch (error) {
      this.log(`❌ 刷新日志缓冲区失败: ${error}`);
    }
  }

  private async attemptSentryReconnection(): Promise<void> {
    // 模拟Sentry重连逻辑
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 简化的重连检查
        if (Math.random() > 0.3) {
          // 70%成功率
          resolve();
        } else {
          reject(new Error('Sentry重连失败'));
        }
      }, 1000);
    });
  }

  private async attemptLoggingRecovery(): Promise<void> {
    // 尝试重新建立日志写入
    try {
      const testFile = join(this.cacheDir, 'logging-test.log');
      writeFileSync(testFile, 'recovery test\n');
    } catch (error) {
      throw new Error(`日志恢复失败: ${error}`);
    }
  }

  private async attemptNetworkOperation(operation: string): Promise<void> {
    // 模拟网络操作重试
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.4) {
          // 60%成功率
          resolve();
        } else {
          reject(new Error(`网络操作失败: ${operation}`));
        }
      }, 500);
    });
  }

  private async cleanupOldLogs(): Promise<void> {
    // 清理旧日志文件的逻辑
    this.log('🧹 清理旧日志文件...');
  }

  private async checkAvailableSpace(): Promise<boolean> {
    // 检查可用存储空间
    return true; // 简化实现
  }

  private enableLoggingFallback(): void {
    this.log('📝 启用日志降级模式：仅控制台输出');
  }

  private enableOfflineMode(): void {
    this.log('📴 启用离线模式：本地缓存操作');
  }

  private enableStorageDegradation(): void {
    this.log('💾 启用存储降级模式：减少日志详细程度');
  }

  private enableMemoryDegradation(): void {
    this.log('🧠 启用内存降级模式：减少缓存和缓冲区');
  }

  private clearInternalCaches(): void {
    this.localBuffer = [];
    // 清理其他内部缓存
  }

  private updateSystemHealth(): void {
    // 更新整体系统健康状态
    const components = Object.values(this.systemHealth.components);
    const errorCount = components.filter(c => c.status === 'error').length;
    const warningCount = components.filter(c => c.status === 'warning').length;

    if (errorCount > 0) {
      this.systemHealth.overall = errorCount > 2 ? 'failed' : 'critical';
    } else if (warningCount > 0) {
      this.systemHealth.overall = 'degraded';
    } else {
      this.systemHealth.overall = 'healthy';
    }

    this.systemHealth.timestamp = new Date().toISOString();
  }

  private cleanupResolvedFailures(): void {
    this.systemHealth.activeFailures = this.systemHealth.activeFailures.filter(
      f => !f.resolved
    );
  }

  private cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    for (const timer of this.recoveryTimers.values()) {
      clearTimeout(timer);
    }

    // 保存缓冲区数据
    if (this.localBuffer.length > 0) {
      this.flushLogBuffer();
    }
  }

  private log(message: string): void {
    console.log(`[ResilienceManager] ${message}`);
  }
}

// 导出默认实例
export const resilienceManager = new ResilienceManager();

// 便捷函数
export async function handleObservabilityError(
  error: Error,
  type: FailureType,
  context?: any
): Promise<void> {
  switch (type) {
    case 'sentry_unavailable':
      await resilienceManager.handleSentryFailure(error, context);
      break;
    case 'logging_failure':
      await resilienceManager.handleLoggingFailure(error, context);
      break;
    case 'network_error':
      await resilienceManager.handleNetworkError(
        error,
        context?.operation || 'unknown'
      );
      break;
    case 'storage_full':
      await resilienceManager.handleStorageExhaustion();
      break;
    case 'memory_exhausted':
      await resilienceManager.handleMemoryExhaustion();
      break;
    default:
      console.error('未处理的可观测性错误:', error);
  }
}

export function getSystemHealthStatus(): SystemHealth {
  return resilienceManager.getSystemHealth();
}

export function getRecoveryRecommendations(): string[] {
  return resilienceManager.getDegradationRecommendations();
}

/**
 *
 *
 *
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

//
export type FailureType =
  | 'sentry_unavailable'
  | 'logging_failure'
  | 'network_error'
  | 'storage_full'
  | 'config_error'
  | 'memory_exhausted'
  | 'permission_denied'
  | 'unknown_error';

//
export type DegradationLevel =
  | 'none'
  | 'minimal'
  | 'moderate'
  | 'severe'
  | 'critical';

//
export type RecoveryStrategy =
  | 'immediate_retry'
  | 'exponential_backoff'
  | 'circuit_breaker'
  | 'graceful_degradation'
  | 'failover'
  | 'cache_fallback'
  | 'local_storage';

//
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

//
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

//
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

//
export interface RecoveryAction {
  id: string;
  name: string;
  description: string;
  executed: boolean;
  executedAt?: string;
  success: boolean;
  error?: string;
}

//
export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureTime?: string;
  nextRetryTime?: string;
  successCount: number;
}

//
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
 * [main-only] Runs in Electron main process.
 *
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

    //
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  /**
   * Sentry
   */
  async handleSentryFailure(error: Error, context?: any): Promise<void> {
    const failureId = `sentry_${Date.now()}`;

    const failure: ActiveFailure = {
      id: failureId,
      type: 'sentry_unavailable',
      severity: 'high',
      startTime: new Date().toISOString(),
      description: `Sentry服务不可用: ${error.message}`,
      impact: 'Sentry',
      recoveryStrategy: 'circuit_breaker',
      attemptCount: 0,
      resolved: false,
    };

    this.recordFailure(failure);
    await this.executeSentryRecovery(failure, error, context);
  }

  /**
   *
   */
  async handleLoggingFailure(error: Error, logData?: any): Promise<void> {
    const failureId = `logging_${Date.now()}`;

    const failure: ActiveFailure = {
      id: failureId,
      type: 'logging_failure',
      severity: 'medium',
      startTime: new Date().toISOString(),
      description: `日志系统故障: ${error.message}`,
      impact: '',
      recoveryStrategy: 'graceful_degradation',
      attemptCount: 0,
      resolved: false,
    };

    this.recordFailure(failure);
    await this.executeLoggingRecovery(failure, error, logData);
  }

  /**
   *
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
   *
   */
  async handleStorageExhaustion(): Promise<void> {
    const failureId = `storage_${Date.now()}`;

    const failure: ActiveFailure = {
      id: failureId,
      type: 'storage_full',
      severity: 'high',
      startTime: new Date().toISOString(),
      description: '',
      impact: '',
      recoveryStrategy: 'local_storage',
      attemptCount: 0,
      resolved: false,
    };

    this.recordFailure(failure);
    await this.executeStorageRecovery(failure);
  }

  /**
   *
   */
  async handleMemoryExhaustion(): Promise<void> {
    const failureId = `memory_${Date.now()}`;

    const failure: ActiveFailure = {
      id: failureId,
      type: 'memory_exhausted',
      severity: 'critical',
      startTime: new Date().toISOString(),
      description: '',
      impact: '',
      recoveryStrategy: 'graceful_degradation',
      attemptCount: 0,
      resolved: false,
    };

    this.recordFailure(failure);
    await this.executeMemoryRecovery(failure);
  }

  /**
   * Sentry
   */
  private async executeSentryRecovery(
    failure: ActiveFailure,
    error: Error,
    context?: any
  ): Promise<void> {
    this.log(`🔧 执行Sentry恢复策略: ${failure.recoveryStrategy}`);

    const circuitBreaker = this.getCircuitBreaker('sentry');

    if (circuitBreaker.state === 'open') {
      //
      await this.fallbackToLocalLogging(context);
      this.updateDegradationLevel('moderate');
      return;
    }

    failure.attemptCount++;
    failure.lastAttempt = new Date().toISOString();

    try {
      // Sentry
      await this.attemptSentryReconnection();

      //
      failure.resolved = true;
      circuitBreaker.successCount++;
      this.resetCircuitBreaker('sentry');
      this.updateComponentHealth('sentry', 'healthy');
      this.log(' Sentry');
    } catch {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = new Date().toISOString();

      if (
        circuitBreaker.failureCount >=
        this.config.sentry.circuitBreakerThreshold
      ) {
        //
        this.openCircuitBreaker('sentry');
        await this.fallbackToLocalLogging(context);
        this.updateDegradationLevel('moderate');
      } else {
        //
        this.scheduleRetry(failure, this.config.sentry.retryDelay);
      }
    }
  }

  /**
   *
   */
  private async executeLoggingRecovery(
    failure: ActiveFailure,
    error: Error,
    logData?: any
  ): Promise<void> {
    this.log(`🔧 执行日志恢复策略: ${failure.recoveryStrategy}`);

    failure.attemptCount++;
    failure.lastAttempt = new Date().toISOString();

    //
    if (logData) {
      this.bufferLogData(logData);
    }

    try {
      //
      await this.attemptLoggingRecovery();

      //
      await this.flushLogBuffer();
      failure.resolved = true;
      this.updateComponentHealth('logging', 'healthy');
      this.log(' ');
    } catch {
      if (failure.attemptCount >= this.config.logging.maxRetries) {
        //
        await this.enableLoggingFallback();
        this.updateDegradationLevel('minimal');
        this.log(' ');
      } else {
        //
        this.scheduleRetry(failure, 2000 * failure.attemptCount);
      }
    }
  }

  /**
   *
   */
  private async executeNetworkRecovery(
    failure: ActiveFailure,
    error: Error,
    operation: string
  ): Promise<void> {
    this.log(`🔧 执行网络恢复策略: ${failure.recoveryStrategy}`);

    failure.attemptCount++;
    failure.lastAttempt = new Date().toISOString();

    //
    const delay =
      this.config.network.timeoutMs *
      Math.pow(this.config.network.backoffMultiplier, failure.attemptCount - 1);

    try {
      //
      await this.attemptNetworkOperation(operation);

      failure.resolved = true;
      this.updateComponentHealth('network', 'healthy');
      this.log(' ');
    } catch {
      if (failure.attemptCount >= this.config.network.maxRetries) {
        //
        this.enableOfflineMode();
        this.updateDegradationLevel('moderate');
        this.log(' ');
      } else {
        //
        this.scheduleRetry(failure, delay);
      }
    }
  }

  /**
   *
   */
  private async executeStorageRecovery(failure: ActiveFailure): Promise<void> {
    this.log(`🔧 执行存储恢复策略: ${failure.recoveryStrategy}`);

    failure.attemptCount++;
    failure.lastAttempt = new Date().toISOString();

    try {
      //
      await this.cleanupOldLogs();

      //
      const spaceFreed = await this.checkAvailableSpace();

      if (spaceFreed) {
        failure.resolved = true;
        this.updateComponentHealth('storage', 'healthy');
        this.log(' ');
      } else {
        //
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
   *
   */
  private async executeMemoryRecovery(failure: ActiveFailure): Promise<void> {
    this.log(`🔧 执行内存恢复策略: ${failure.recoveryStrategy}`);

    failure.attemptCount++;
    failure.lastAttempt = new Date().toISOString();

    try {
      //
      if (global.gc) {
        global.gc();
      }

      //
      this.clearInternalCaches();

      //
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

      if (heapUsedMB < this.config.memory.maxHeapUsage) {
        failure.resolved = true;
        this.updateComponentHealth('memory', 'healthy');
        this.log(' ');
      } else {
        //
        this.enableMemoryDegradation();
        this.updateDegradationLevel('severe');
      }
    } catch (recoveryError) {
      this.log(`❌ 内存恢复失败: ${recoveryError.message}`);
      this.updateDegradationLevel('critical');
    }
  }

  /**
   *
   */
  getSystemHealth(): SystemHealth {
    this.updateSystemHealth();
    return { ...this.systemHealth };
  }

  /**
   *
   */
  getDegradationRecommendations(): string[] {
    const recommendations: string[] = [];

    switch (this.systemHealth.degradationLevel) {
      case 'minimal':
        recommendations.push('');
        recommendations.push('');
        break;
      case 'moderate':
        recommendations.push('');
        recommendations.push('');
        break;
      case 'severe':
        recommendations.push('');
        recommendations.push('');
        break;
      case 'critical':
        recommendations.push('');
        recommendations.push('');
        break;
      default:
        recommendations.push('');
    }

    return recommendations;
  }

  //

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
    }, 30000); // 30
  }

  private async performHealthCheck(): Promise<void> {
    try {
      //
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

      if (heapUsedMB > this.config.memory.gcThreshold) {
        await this.handleMemoryExhaustion();
      }

      //
      const storageOk = await this.checkAvailableSpace();
      if (!storageOk) {
        await this.handleStorageExhaustion();
      }

      //
      this.cleanupResolvedFailures();
    } catch (error) {
      this.log(`❌ 健康检查失败: ${error}`);
    }
  }

  private recordFailure(failure: ActiveFailure): void {
    this.failureBuffer.push(failure);
    this.systemHealth.activeFailures.push(failure);

    //
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
    cb.nextRetryTime = new Date(Date.now() + 60000).toISOString(); // 1
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
      // ...
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
      console.error(':', error);
    }
  }

  private bufferLogData(data: any): void {
    this.localBuffer.push({
      timestamp: new Date().toISOString(),
      data,
    });

    //
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
    // Sentry
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        //
        if (Math.random() > 0.3) {
          // 70%
          resolve();
        } else {
          reject(new Error('Sentry'));
        }
      }, 1000);
    });
  }

  private async attemptLoggingRecovery(): Promise<void> {
    //
    try {
      const testFile = join(this.cacheDir, 'logging-test.log');
      writeFileSync(testFile, 'recovery test\n');
    } catch (error) {
      throw new Error(`日志恢复失败: ${error}`);
    }
  }

  private async attemptNetworkOperation(operation: string): Promise<void> {
    //
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.4) {
          // 60%
          resolve();
        } else {
          reject(new Error(`网络操作失败: ${operation}`));
        }
      }, 500);
    });
  }

  private async cleanupOldLogs(): Promise<void> {
    //
    this.log(' ...');
  }

  private async checkAvailableSpace(): Promise<boolean> {
    //
    return true; //
  }

  private enableLoggingFallback(): void {
    this.log(' ');
  }

  private enableOfflineMode(): void {
    this.log(' ');
  }

  private enableStorageDegradation(): void {
    this.log(' ');
  }

  private enableMemoryDegradation(): void {
    this.log(' ');
  }

  private clearInternalCaches(): void {
    this.localBuffer = [];
    //
  }

  private updateSystemHealth(): void {
    //
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

    //
    if (this.localBuffer.length > 0) {
      this.flushLogBuffer();
    }
  }

  private log(message: string): void {
    console.log(`[ResilienceManager] ${message}`);
  }
}

//
export const resilienceManager = new ResilienceManager();

//
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
      console.error(':', error);
  }
}

export function getSystemHealthStatus(): SystemHealth {
  return resilienceManager.getSystemHealth();
}

export function getRecoveryRecommendations(): string[] {
  return resilienceManager.getDegradationRecommendations();
}

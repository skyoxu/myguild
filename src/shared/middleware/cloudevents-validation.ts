/**
 * CloudEvents实时验证中间件
 * 提供运行时事件格式验证和监控能力
 */

import type { CloudEvent } from '../contracts/cloudevents-core.js';
import { assertCe, isCloudEvent } from '../contracts/cloudevents-core.js';

export interface ValidationError {
  timestamp: string;
  error: string;
  originalEvent?: unknown;
  context?: string;
}

export interface ValidationStats {
  totalValidated: number;
  totalErrors: number;
  errorRate: number;
  lastError?: ValidationError;
}

/**
 * CloudEvents验证中间件类
 */
export class CloudEventsValidator {
  private static instance: CloudEventsValidator;
  private errors: ValidationError[] = [];
  private stats: ValidationStats = {
    totalValidated: 0,
    totalErrors: 0,
    errorRate: 0,
  };

  // 错误监听器
  private errorListeners: Array<(error: ValidationError) => void> = [];

  // 验证规则配置
  private config = {
    maxErrorHistory: 100,
    enableLogging: true,
    strictMode: false, // 严格模式下验证失败会抛出异常
    enableMetrics: true,
  };

  static getInstance(): CloudEventsValidator {
    if (!CloudEventsValidator.instance) {
      CloudEventsValidator.instance = new CloudEventsValidator();
    }
    return CloudEventsValidator.instance;
  }

  /**
   * 配置验证器
   */
  configure(options: Partial<typeof this.config>) {
    this.config = { ...this.config, ...options };
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 验证单个CloudEvent
   */
  validate(event: unknown, context?: string): event is CloudEvent {
    this.stats.totalValidated++;

    try {
      assertCe(event);
      return true;
    } catch (error) {
      const validationError: ValidationError = {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        originalEvent: event,
        context,
      };

      this.recordError(validationError);

      if (this.config.strictMode) {
        throw error;
      }

      return false;
    }
  }

  /**
   * 批量验证CloudEvents
   */
  validateBatch(
    events: unknown[],
    context?: string
  ): {
    valid: CloudEvent[];
    invalid: Array<{ event: unknown; error: string; index: number }>;
  } {
    const valid: CloudEvent[] = [];
    const invalid: Array<{ event: unknown; error: string; index: number }> = [];

    events.forEach((event, index) => {
      try {
        if (this.validate(event, `${context}[${index}]`)) {
          valid.push(event as CloudEvent);
        } else {
          invalid.push({
            event,
            error: 'Validation failed',
            index,
          });
        }
      } catch (error) {
        invalid.push({
          event,
          error: error instanceof Error ? error.message : String(error),
          index,
        });
      }
    });

    return { valid, invalid };
  }

  /**
   * 中间件函数 - 用于事件总线集成
   */
  middleware() {
    return (event: unknown, next: (validEvent: CloudEvent) => void) => {
      if (this.validate(event, 'middleware')) {
        next(event as CloudEvent);
      } else {
        if (this.config.enableLogging) {
          console.warn(
            '[CloudEvents] Invalid event blocked by middleware:',
            event
          );
        }
      }
    };
  }

  /**
   * 装饰器工厂 - 用于方法级别的事件验证
   */
  validateEvent(context?: string) {
    return (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) => {
      // 防御性检查：确保descriptor和value存在
      if (!descriptor || typeof descriptor.value !== 'function') {
        console.warn(
          `[CloudEvents] Cannot apply validateEvent decorator to ${propertyKey}: descriptor.value is not a function`
        );
        return descriptor;
      }

      const originalMethod = descriptor.value;

      descriptor.value = function (...args: any[]) {
        // 假设第一个参数是要验证的事件
        if (args.length > 0) {
          const validator = CloudEventsValidator.getInstance();
          if (
            !validator.validate(
              args[0],
              `${target.constructor.name}.${propertyKey}`
            )
          ) {
            if (validator.config.enableLogging) {
              console.warn(
                `[CloudEvents] Method ${propertyKey} received invalid event:`,
                args[0]
              );
            }
            if (validator.config.strictMode) {
              return;
            }
          }
        }

        return originalMethod.apply(this, args);
      };

      return descriptor;
    };
  }

  /**
   * Express.js风格中间件
   */
  expressMiddleware() {
    return (req: any, res: any, next: any) => {
      if (
        req.body &&
        req.headers['content-type']?.includes('application/cloudevents+json')
      ) {
        if (!this.validate(req.body, 'express-middleware')) {
          return res.status(400).json({
            error: 'Invalid CloudEvents format',
            details: this.getLastError(),
          });
        }
      }
      next();
    };
  }

  /**
   * 记录验证错误
   */
  private recordError(error: ValidationError) {
    this.stats.totalErrors++;
    this.stats.errorRate = this.stats.totalErrors / this.stats.totalValidated;
    this.stats.lastError = error;

    this.errors.push(error);
    if (this.errors.length > this.config.maxErrorHistory) {
      this.errors.shift();
    }

    // 通知错误监听器
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('[CloudEvents] Error in error listener:', e);
      }
    });

    if (this.config.enableLogging) {
      console.error('[CloudEvents] Validation error:', error);
    }
  }

  /**
   * 添加错误监听器
   */
  onError(listener: (error: ValidationError) => void) {
    this.errorListeners.push(listener);
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  /**
   * 获取验证统计信息
   */
  getStats(): ValidationStats {
    return { ...this.stats };
  }

  /**
   * 获取错误历史
   */
  getErrors(): ValidationError[] {
    return [...this.errors];
  }

  /**
   * 获取最后一个错误
   */
  getLastError(): ValidationError | undefined {
    return this.stats.lastError;
  }

  /**
   * 清除错误历史
   */
  clearErrors() {
    this.errors = [];
    this.stats.totalErrors = 0;
    this.stats.errorRate = this.stats.totalValidated > 0 ? 0 : 0;
    this.stats.lastError = undefined;
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalValidated: 0,
      totalErrors: 0,
      errorRate: 0,
    };
    this.clearErrors();
  }

  /**
   * 生成验证报告
   */
  generateReport(): {
    stats: ValidationStats;
    recentErrors: ValidationError[];
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    if (this.stats.errorRate > 0.1) {
      recommendations.push('错误率超过10%，建议检查事件生成逻辑');
    }

    if (this.stats.totalErrors > 0) {
      const errorTypes = new Map<string, number>();
      this.errors.forEach(error => {
        const type = error.error.split(':')[0];
        errorTypes.set(type, (errorTypes.get(type) || 0) + 1);
      });

      const mostCommonError = Array.from(errorTypes.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0];

      if (mostCommonError) {
        recommendations.push(
          `最常见错误: ${mostCommonError[0]} (${mostCommonError[1]}次)`
        );
      }
    }

    return {
      stats: this.getStats(),
      recentErrors: this.getErrors().slice(-10),
      recommendations,
    };
  }

  /**
   * 启用实时监控
   */
  startMonitoring(options?: {
    intervalMs?: number;
    logStats?: boolean;
    alertThreshold?: number;
  }) {
    const config = {
      intervalMs: 60000, // 1分钟
      logStats: false,
      alertThreshold: 0.05, // 5%错误率阈值
      ...options,
    };

    const interval = setInterval(() => {
      const stats = this.getStats();

      if (config.logStats) {
        console.log('[CloudEvents] Monitoring stats:', stats);
      }

      if (
        stats.errorRate > config.alertThreshold &&
        stats.totalValidated > 10
      ) {
        console.warn(
          `[CloudEvents] 警告: 错误率 ${(stats.errorRate * 100).toFixed(2)}% 超过阈值 ${(config.alertThreshold * 100).toFixed(2)}%`
        );
      }
    }, config.intervalMs);

    return () => clearInterval(interval);
  }
}

// 导出单例实例
export const cloudEventsValidator = CloudEventsValidator.getInstance();

// 便捷的全局方法
export const validateEvent = (event: unknown, context?: string) =>
  cloudEventsValidator.validate(event, context);

export const validateEvents = (events: unknown[], context?: string) =>
  cloudEventsValidator.validateBatch(events, context);

import React from 'react';

/**
 * React Hook for CloudEvents validation
 */
export function useCloudEventsValidation() {
  const [stats, setStats] = React.useState<ValidationStats>(
    cloudEventsValidator.getStats()
  );
  const [errors, setErrors] = React.useState<ValidationError[]>([]);

  React.useEffect(() => {
    const updateStats = () => {
      setStats(cloudEventsValidator.getStats());
      setErrors(cloudEventsValidator.getErrors().slice(-5)); // 最近5个错误
    };

    // 监听错误
    const unsubscribe = cloudEventsValidator.onError(updateStats);

    // 定期更新
    const interval = setInterval(updateStats, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return {
    stats,
    errors,
    validate: cloudEventsValidator.validate.bind(cloudEventsValidator),
    validateBatch:
      cloudEventsValidator.validateBatch.bind(cloudEventsValidator),
    clearErrors: cloudEventsValidator.clearErrors.bind(cloudEventsValidator),
  };
}

/**
 * Electron IPC验证中间件
 */
export function createIPCValidationMiddleware() {
  return {
    // 主进程端验证
    mainProcess: (ipcMain: any) => {
      const originalHandle = ipcMain.handle.bind(ipcMain);

      ipcMain.handle = (
        channel: string,
        listener: (event: any, ...args: any[]) => any
      ) => {
        if (channel.includes('cloudevents')) {
          const wrappedListener = (event: any, ...args: any[]) => {
            // 验证第一个参数如果是CloudEvent
            if (args.length > 0 && typeof args[0] === 'object') {
              if (!cloudEventsValidator.validate(args[0], `ipc:${channel}`)) {
                throw new Error(
                  `Invalid CloudEvent received on channel ${channel}`
                );
              }
            }
            return listener(event, ...args);
          };
          return originalHandle(channel, wrappedListener);
        }
        return originalHandle(channel, listener);
      };
    },

    // 渲染进程端验证
    rendererProcess: (ipcRenderer: any) => {
      const originalInvoke = ipcRenderer.invoke.bind(ipcRenderer);

      ipcRenderer.invoke = (channel: string, ...args: any[]) => {
        if (channel.includes('cloudevents') && args.length > 0) {
          if (
            !cloudEventsValidator.validate(args[0], `ipc-renderer:${channel}`)
          ) {
            return Promise.reject(
              new Error(`Invalid CloudEvent sent on channel ${channel}`)
            );
          }
        }
        return originalInvoke(channel, ...args);
      };
    },
  };
}

/**
 * 事件总线集成
 */
export function createEventBusValidator<
  T extends { on: Function; emit: Function },
>(eventBus: T): T {
  const originalEmit = eventBus.emit.bind(eventBus);

  (eventBus as any).emit = (eventName: string, event: unknown) => {
    if (eventName.startsWith('cloudevent:') || isCloudEvent(event)) {
      if (!cloudEventsValidator.validate(event, `eventbus:${eventName}`)) {
        const config = cloudEventsValidator.getConfig();
        if (config.enableLogging) {
          console.warn(
            `[CloudEvents] Invalid event blocked on ${eventName}:`,
            event
          );
        }
        if (config.strictMode) {
          throw new Error(`Invalid CloudEvent emitted on ${eventName}`);
        }
        return;
      }
    }

    return originalEmit(eventName, event);
  };

  return eventBus;
}

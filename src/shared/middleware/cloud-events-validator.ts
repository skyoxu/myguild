/**
 * CloudEvents 1.0 运行时验证中间件
 * 基于 CH04 系统上下文与事件流架构
 *
 * 功能：
 * - 运行时CloudEvents规范强制验证
 * - 事件发布性能监控
 * - 验证错误统计和报告
 * - 可配置的验证级别
 */

import type { BaseEvent } from '../contracts/events';

// ============================================================================
// 配置与类型定义
// ============================================================================

export interface ValidationConfig {
  /** 验证级别 */
  level: 'strict' | 'warning' | 'disabled';
  /** 是否启用性能监控 */
  enablePerformanceMonitoring: boolean;
  /** 是否记录验证统计 */
  enableStatistics: boolean;
  /** 最大事件处理延迟(ms) */
  maxProcessingDelay: number;
}

export interface ValidationError {
  code:
    | 'MISSING_FIELD'
    | 'INVALID_FORMAT'
    | 'INVALID_SPECVERSION'
    | 'INVALID_SOURCE';
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  processingTime: number;
  timestamp: string;
}

export interface ValidationStats {
  totalEvents: number;
  validEvents: number;
  invalidEvents: number;
  avgProcessingTime: number;
  errorsByType: Record<string, number>;
  lastValidation: string;
}

// 默认配置
const DEFAULT_CONFIG: ValidationConfig = {
  level: (process.env.CLOUDEVENTS_VALIDATION_LEVEL as any) || 'strict',
  enablePerformanceMonitoring: process.env.NODE_ENV !== 'production',
  enableStatistics: true,
  maxProcessingDelay: Number(process.env.CLOUDEVENTS_MAX_DELAY_MS || '10'),
};

// ============================================================================
// CloudEvents 验证器类
// ============================================================================

export class CloudEventsValidator {
  private config: ValidationConfig;
  private stats: ValidationStats;
  private processingTimes: number[] = [];

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      totalEvents: 0,
      validEvents: 0,
      invalidEvents: 0,
      avgProcessingTime: 0,
      errorsByType: {},
      lastValidation: new Date().toISOString(),
    };
  }

  /**
   * 验证CloudEvents 1.0事件
   */
  validate(event: BaseEvent): ValidationResult {
    const startTime = this.config.enablePerformanceMonitoring
      ? performance.now()
      : 0;
    const errors: ValidationError[] = [];

    if (this.config.level === 'disabled') {
      return {
        valid: true,
        errors: [],
        processingTime: 0,
        timestamp: new Date().toISOString(),
      };
    }

    // 验证必需字段
    const requiredFields: Array<keyof BaseEvent> = [
      'id',
      'source',
      'specversion',
      'type',
    ];
    for (const field of requiredFields) {
      if (!event[field]) {
        errors.push({
          code: 'MISSING_FIELD',
          field: field as string,
          message: `Required CloudEvents field '${field}' is missing`,
          severity: 'error',
        });
      }
    }

    // 验证 specversion
    if (event.specversion && event.specversion !== '1.0') {
      errors.push({
        code: 'INVALID_SPECVERSION',
        field: 'specversion',
        message: `Unsupported CloudEvents specversion '${event.specversion}', expected '1.0'`,
        severity: 'error',
      });
    }

    // 验证 source 格式 (应该是 URI 引用)
    if (event.source && typeof event.source === 'string') {
      if (!this.isValidSourceFormat(event.source)) {
        errors.push({
          code: 'INVALID_SOURCE',
          field: 'source',
          message: `Invalid source format '${event.source}', should be a URI reference`,
          severity: this.config.level === 'strict' ? 'error' : 'warning',
        });
      }
    }

    // 验证 time 格式 (RFC3339)
    if (event.time && typeof event.time === 'string') {
      if (!this.isValidRFC3339(event.time)) {
        errors.push({
          code: 'INVALID_FORMAT',
          field: 'time',
          message: `Invalid time format '${event.time}', should be RFC3339`,
          severity: this.config.level === 'strict' ? 'error' : 'warning',
        });
      }
    }

    // 性能监控
    let processingTime = 0;
    if (this.config.enablePerformanceMonitoring) {
      processingTime = performance.now() - startTime;
      this.updateProcessingStats(processingTime);

      if (processingTime > this.config.maxProcessingDelay) {
        console.warn(
          `⚠️  CloudEvents validation took ${processingTime.toFixed(2)}ms (> ${this.config.maxProcessingDelay}ms threshold)`
        );
      }
    }

    // 更新统计信息
    if (this.config.enableStatistics) {
      this.updateStats(errors);
    }

    const result: ValidationResult = {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      processingTime,
      timestamp: new Date().toISOString(),
    };

    // 错误处理
    if (!result.valid && this.config.level === 'strict') {
      const errorSummary = errors
        .filter(e => e.severity === 'error')
        .map(e => `${e.field}: ${e.message}`)
        .join('; ');

      throw new Error(`CloudEvents validation failed: ${errorSummary}`);
    }

    // 警告日志
    if (errors.length > 0 && this.config.level === 'warning') {
      console.warn(`⚠️  CloudEvents validation warnings:`, errors);
    }

    return result;
  }

  /**
   * 创建验证中间件函数
   */
  createMiddleware() {
    return (event: BaseEvent): BaseEvent => {
      this.validate(event);
      return event;
    };
  }

  /**
   * 获取验证统计信息
   */
  getStatistics(): ValidationStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStatistics(): void {
    this.stats = {
      totalEvents: 0,
      validEvents: 0,
      invalidEvents: 0,
      avgProcessingTime: 0,
      errorsByType: {},
      lastValidation: new Date().toISOString(),
    };
    this.processingTimes = [];
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private isValidSourceFormat(source: string): boolean {
    // 简单的URI引用格式检查
    // CloudEvents spec允许URI引用 (https://tools.ietf.org/html/rfc3986#section-4.1)
    try {
      // 允许相对URI和绝对URI
      return /^([a-zA-Z][a-zA-Z0-9+.-]*:|\/|[a-zA-Z0-9._~!$&'()*+,;=:@-])/u.test(
        source
      );
    } catch {
      return false;
    }
  }

  private isValidRFC3339(timeString: string): boolean {
    // RFC3339时间格式验证
    const rfc3339Regex =
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
    if (!rfc3339Regex.test(timeString)) {
      return false;
    }

    // 验证日期是否有效
    const date = new Date(timeString);
    return !isNaN(date.getTime());
  }

  private updateProcessingStats(processingTime: number): void {
    this.processingTimes.push(processingTime);

    // 保持最近1000个处理时间记录
    if (this.processingTimes.length > 1000) {
      this.processingTimes = this.processingTimes.slice(-500);
    }

    // 更新平均处理时间
    this.stats.avgProcessingTime =
      this.processingTimes.reduce((sum, time) => sum + time, 0) /
      this.processingTimes.length;
  }

  private updateStats(errors: ValidationError[]): void {
    this.stats.totalEvents++;

    if (errors.filter(e => e.severity === 'error').length === 0) {
      this.stats.validEvents++;
    } else {
      this.stats.invalidEvents++;
    }

    // 更新错误类型统计
    for (const error of errors) {
      this.stats.errorsByType[error.code] =
        (this.stats.errorsByType[error.code] || 0) + 1;
    }

    this.stats.lastValidation = new Date().toISOString();
  }
}

// ============================================================================
// 导出默认实例和工厂函数
// ============================================================================

// 单例验证器实例
export const defaultValidator = new CloudEventsValidator();

// 创建自定义验证器的工厂函数
export function createValidator(
  config?: Partial<ValidationConfig>
): CloudEventsValidator {
  return new CloudEventsValidator(config);
}

// 便捷的验证函数
export function validateCloudEvent(event: BaseEvent): ValidationResult {
  return defaultValidator.validate(event);
}

// 便捷的中间件创建函数
export function createValidationMiddleware(config?: Partial<ValidationConfig>) {
  const validator = config ? createValidator(config) : defaultValidator;
  return validator.createMiddleware();
}

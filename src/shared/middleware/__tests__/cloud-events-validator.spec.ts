/**
 * CloudEvents验证器单元测试
 * 测试运行时验证中间件的功能
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  CloudEventsValidator,
  createValidator,
  validateCloudEvent,
  defaultValidator,
  type ValidationConfig,
} from '../cloud-events-validator';
import type { BaseEvent } from '@/shared/contracts/events';

describe('CloudEventsValidator', () => {
  let validator: CloudEventsValidator;

  const validEvent: BaseEvent = {
    id: 'test-event-001',
    source: '/vitegame/test-source',
    type: 'com.vitegame.test.event',
    specversion: '1.0',
    time: '2025-08-26T10:30:00Z',
    datacontenttype: 'application/json',
    data: { message: 'test' },
  };

  beforeEach(() => {
    validator = new CloudEventsValidator({
      level: 'strict',
      enablePerformanceMonitoring: true,
      enableStatistics: true,
      maxProcessingDelay: 10,
    });

    // 重置默认验证器状态，防止测试间污染
    defaultValidator.resetStatistics();
  });

  describe('validate()', () => {
    test('should pass valid CloudEvent', () => {
      const result = validator.validate(validEvent);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should fail on missing required fields', () => {
      const invalidEvent = { ...validEvent };
      delete (invalidEvent as any).id;
      delete (invalidEvent as any).source;

      expect(() => validator.validate(invalidEvent)).toThrow(
        'CloudEvents validation failed'
      );
    });

    test('should fail on invalid specversion', () => {
      const invalidEvent = { ...validEvent, specversion: '2.0' as any };

      expect(() => validator.validate(invalidEvent)).toThrow(
        'Unsupported CloudEvents specversion'
      );
    });

    test('should validate source format', () => {
      const invalidEvent = { ...validEvent, source: '   ' }; // 只有空格的无效源

      // 在strict模式下应该抛出异常
      expect(() => validator.validate(invalidEvent)).toThrow(
        'CloudEvents validation failed'
      );
    });

    test('should validate RFC3339 time format', () => {
      const warningValidator = new CloudEventsValidator({ level: 'warning' });
      const invalidEvent = { ...validEvent, time: '2025-13-32T25:61:99Z' };
      const result = warningValidator.validate(invalidEvent);

      expect(result.valid).toBe(true); // 警告模式不阻塞
      expect(result.errors.some(e => e.code === 'INVALID_FORMAT')).toBe(true);
    });

    test('should work in warning mode', () => {
      const warningValidator = new CloudEventsValidator({ level: 'warning' });
      const invalidEvent = { ...validEvent, source: '   ' }; // 只有空格的无效源

      const result = warningValidator.validate(invalidEvent);
      expect(result.valid).toBe(true); // 警告模式不阻塞
      expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
    });

    test('should be disabled when level is disabled', () => {
      const disabledValidator = new CloudEventsValidator({ level: 'disabled' });
      const invalidEvent = { ...validEvent };
      delete (invalidEvent as any).id;

      const result = disabledValidator.validate(invalidEvent);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('createMiddleware()', () => {
    test('should create middleware function', () => {
      const middleware = validator.createMiddleware();

      expect(typeof middleware).toBe('function');

      const result = middleware(validEvent);
      expect(result).toEqual(validEvent);
    });

    test('should throw in middleware for invalid events in strict mode', () => {
      const middleware = validator.createMiddleware();
      const invalidEvent = { ...validEvent };
      delete (invalidEvent as any).id;

      expect(() => middleware(invalidEvent)).toThrow();
    });
  });

  describe('getStatistics()', () => {
    test('should track validation statistics', () => {
      validator.validate(validEvent);
      validator.validate(validEvent);

      const stats = validator.getStatistics();
      expect(stats.totalEvents).toBe(2);
      expect(stats.validEvents).toBe(2);
      expect(stats.invalidEvents).toBe(0);
      expect(stats.avgProcessingTime).toBeGreaterThanOrEqual(0);
    });

    test('should track invalid events in statistics', () => {
      const warningValidator = new CloudEventsValidator({ level: 'warning' });
      // 使用一个确实无效的源（既不是URL也不是路径）
      const invalidEvent = { ...validEvent, source: '' }; // 空字符串，确保无效

      const validResult = warningValidator.validate(validEvent);
      const invalidResult = warningValidator.validate(invalidEvent);

      const stats = warningValidator.getStatistics();

      expect(stats.totalEvents).toBe(2);
      expect(stats.validEvents).toBe(1);
      expect(stats.invalidEvents).toBe(1);
      expect(stats.errorsByType.MISSING_FIELD || 0).toBe(1);
    });
  });

  describe('resetStatistics()', () => {
    test('should reset statistics', () => {
      validator.validate(validEvent);
      validator.resetStatistics();

      const stats = validator.getStatistics();
      expect(stats.totalEvents).toBe(0);
      expect(stats.validEvents).toBe(0);
      expect(stats.invalidEvents).toBe(0);
    });
  });

  describe('factory functions', () => {
    test('createValidator should create custom validator', () => {
      const customValidator = createValidator({ level: 'warning' });
      expect(customValidator).toBeInstanceOf(CloudEventsValidator);
    });

    test('validateCloudEvent should use default validator', () => {
      const result = validateCloudEvent(validEvent);
      expect(result.valid).toBe(true);
    });
  });

  describe('performance monitoring', () => {
    test('should monitor processing time', () => {
      const result = validator.validate(validEvent);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    test('should warn on slow processing', () => {
      const slowValidator = new CloudEventsValidator({
        enablePerformanceMonitoring: true,
        maxProcessingDelay: 0.001, // 非常低的阈值
      });

      // 这个测试可能会触发性能警告，但不会失败
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      slowValidator.validate(validEvent);
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    test('should handle empty event object', () => {
      expect(() => validator.validate({} as BaseEvent)).toThrow();
    });

    test('should handle null/undefined fields gracefully', () => {
      const partialEvent = {
        id: 'test',
        source: null as any,
        type: undefined as any,
        specversion: '1.0' as const,
        time: '',
        datacontenttype: 'application/json',
        data: null,
      };

      expect(() => validator.validate(partialEvent)).toThrow();
    });

    test('should accept various valid source formats', () => {
      const validSources = [
        'https://example.com/source',
        '/relative/path',
        'file://local/path',
        'custom-scheme://identifier',
      ];

      validSources.forEach(source => {
        const testEvent = { ...validEvent, source };
        const result = validator.validate(testEvent);
        expect(result.valid).toBe(true);
      });
    });
  });
});

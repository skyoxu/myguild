/**
 * CloudEvents实时验证中间件测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CloudEventsValidator,
  cloudEventsValidator,
  validateEvent,
  validateEvents,
} from '../../../src/shared/middleware/cloudevents-validation.js';
import {
  mkEvent,
  CloudEvent,
} from '../../../src/shared/contracts/cloudevents-core.js';

describe('CloudEventsValidator', () => {
  let validator: CloudEventsValidator;

  beforeEach(() => {
    validator = new CloudEventsValidator();
    validator.resetStats();
  });

  describe('基本验证功能', () => {
    it('应该验证有效的CloudEvent', () => {
      const validEvent = mkEvent({
        source: 'app://test',
        type: 'test.event',
      });

      expect(validator.validate(validEvent)).toBe(true);

      const stats = validator.getStats();
      expect(stats.totalValidated).toBe(1);
      expect(stats.totalErrors).toBe(0);
      expect(stats.errorRate).toBe(0);
    });

    it('应该拒绝无效的CloudEvent', () => {
      const invalidEvent = {
        id: 'test-123',
        source: 'app://test',
        // 缺少必需的type和specversion字段
      };

      expect(validator.validate(invalidEvent)).toBe(false);

      const stats = validator.getStats();
      expect(stats.totalValidated).toBe(1);
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorRate).toBe(1);
      expect(stats.lastError).toBeDefined();
    });

    it('应该记录验证上下文', () => {
      const invalidEvent = { invalid: true };
      const context = 'test-context';

      validator.validate(invalidEvent, context);

      const lastError = validator.getLastError();
      expect(lastError?.context).toBe(context);
    });
  });

  describe('严格模式', () => {
    it('严格模式下应该抛出异常', () => {
      validator.configure({ strictMode: true });

      const invalidEvent = { invalid: true };

      expect(() => {
        validator.validate(invalidEvent);
      }).toThrow();
    });

    it('非严格模式下不应该抛出异常', () => {
      validator.configure({ strictMode: false });

      const invalidEvent = { invalid: true };

      expect(() => {
        validator.validate(invalidEvent);
      }).not.toThrow();
    });
  });

  describe('批量验证', () => {
    it('应该正确处理混合的有效和无效事件', () => {
      const validEvent = mkEvent({
        source: 'app://test',
        type: 'test.valid',
      });

      const invalidEvent = { invalid: true };

      const events = [validEvent, invalidEvent, validEvent];
      const result = validator.validateBatch(events, 'batch-test');

      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].index).toBe(1);
    });
  });

  describe('错误监听', () => {
    it('应该通知错误监听器', () => {
      const errorListener = vi.fn();
      const unsubscribe = validator.onError(errorListener);

      const invalidEvent = { invalid: true };
      validator.validate(invalidEvent, 'listener-test');

      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'listener-test',
          error: expect.any(String),
          timestamp: expect.any(String),
        })
      );

      unsubscribe();
    });

    it('应该能够取消错误监听', () => {
      const errorListener = vi.fn();
      const unsubscribe = validator.onError(errorListener);

      unsubscribe();

      validator.validate({ invalid: true });
      expect(errorListener).not.toHaveBeenCalled();
    });
  });

  describe('统计和报告', () => {
    it('应该生成正确的验证报告', () => {
      // 添加一些验证结果
      validator.validate(mkEvent({ source: 'app://test', type: 'test.valid' }));
      validator.validate({ invalid: true });
      validator.validate({ invalid: true });

      const report = validator.generateReport();

      expect(report.stats.totalValidated).toBe(3);
      expect(report.stats.totalErrors).toBe(2);
      expect(report.stats.errorRate).toBeCloseTo(2 / 3);
      expect(report.recommendations).toContain(
        '错误率超过10%，建议检查事件生成逻辑'
      );
    });

    it('应该限制错误历史长度', () => {
      validator.configure({ maxErrorHistory: 2 });

      // 添加3个错误
      validator.validate({ error: 1 });
      validator.validate({ error: 2 });
      validator.validate({ error: 3 });

      const errors = validator.getErrors();
      expect(errors).toHaveLength(2);
      // 应该保留最新的2个错误
      expect(errors[0].originalEvent).toEqual({ error: 2 });
      expect(errors[1].originalEvent).toEqual({ error: 3 });
    });
  });

  describe('中间件功能', () => {
    it('应该创建可用的中间件函数', () => {
      const middleware = validator.middleware();
      const nextFn = vi.fn();

      const validEvent = mkEvent({
        source: 'app://test',
        type: 'test.middleware',
      });

      middleware(validEvent, nextFn);
      expect(nextFn).toHaveBeenCalledWith(validEvent);
    });

    it('中间件应该阻止无效事件', () => {
      const middleware = validator.middleware();
      const nextFn = vi.fn();

      const invalidEvent = { invalid: true };

      middleware(invalidEvent, nextFn);
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('装饰器功能', () => {
    it('应该创建有效的方法装饰器', () => {
      const decorator = validator.validateEvent('test-decorator');

      class TestClass {
        @decorator
        testMethod(event: any) {
          return { processed: true };
        }
      }

      const instance = new TestClass();

      // 有效事件应该正常执行
      const validEvent = mkEvent({
        source: 'app://test',
        type: 'test.decorator',
      });

      const result = instance.testMethod(validEvent);
      expect(result).toEqual({ processed: true });
    });
  });

  describe('实时监控', () => {
    it('应该能够启动和停止监控', () => {
      vi.useFakeTimers();

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validator.configure({ enableLogging: true });

      // 创建高错误率场景
      for (let i = 0; i < 20; i++) {
        validator.validate({ invalid: i });
      }

      const stopMonitoring = validator.startMonitoring({
        intervalMs: 1000,
        alertThreshold: 0.05,
      });

      vi.advanceTimersByTime(1100);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('警告: 错误率')
      );

      stopMonitoring();
      consoleSpy.mockRestore();
      vi.useRealTimers();
    });
  });
});

describe('全局函数', () => {
  beforeEach(() => {
    cloudEventsValidator.resetStats();
  });

  describe('validateEvent', () => {
    it('应该使用全局验证器实例', () => {
      const validEvent = mkEvent({
        source: 'app://test',
        type: 'test.global',
      });

      expect(validateEvent(validEvent)).toBe(true);

      const stats = cloudEventsValidator.getStats();
      expect(stats.totalValidated).toBe(1);
    });
  });

  describe('validateEvents', () => {
    it('应该使用全局验证器进行批量验证', () => {
      const events = [
        mkEvent({ source: 'app://test', type: 'test.1' }),
        { invalid: true },
        mkEvent({ source: 'app://test', type: 'test.2' }),
      ];

      const result = validateEvents(events, 'global-batch');

      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(1);
    });
  });
});

describe('Express中间件集成', () => {
  it('应该创建Express中间件', () => {
    const middleware = cloudEventsValidator.expressMiddleware();

    // 模拟Express请求/响应对象
    const req = {
      headers: { 'content-type': 'application/cloudevents+json' },
      body: mkEvent({
        source: 'app://webhook',
        type: 'webhook.received',
      }),
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('应该拒绝无效的CloudEvents请求', () => {
    const middleware = cloudEventsValidator.expressMiddleware();

    const req = {
      headers: { 'content-type': 'application/cloudevents+json' },
      body: { invalid: true },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid CloudEvents format',
      details: expect.any(Object),
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('内存管理', () => {
  beforeEach(() => {
    cloudEventsValidator.resetStats();
    cloudEventsValidator.clearErrors();
  });

  it('应该能够清除错误历史', () => {
    cloudEventsValidator.validate({ invalid: 1 });
    cloudEventsValidator.validate({ invalid: 2 });

    expect(cloudEventsValidator.getErrors()).toHaveLength(2);

    cloudEventsValidator.clearErrors();

    expect(cloudEventsValidator.getErrors()).toHaveLength(0);
    expect(cloudEventsValidator.getStats().totalErrors).toBe(0);
  });

  it('应该能够重置所有统计信息', () => {
    cloudEventsValidator.validate(
      mkEvent({ source: 'app://test', type: 'test' })
    );
    cloudEventsValidator.validate({ invalid: true });

    const statsBeforeReset = cloudEventsValidator.getStats();
    expect(statsBeforeReset.totalValidated).toBeGreaterThan(0);

    cloudEventsValidator.resetStats();

    const statsAfterReset = cloudEventsValidator.getStats();
    expect(statsAfterReset.totalValidated).toBe(0);
    expect(statsAfterReset.totalErrors).toBe(0);
    expect(statsAfterReset.errorRate).toBe(0);
  });
});

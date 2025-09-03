/**
 * EventBus单元测试
 * 测试事件总线的发布/订阅功能和中间件集成
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EventBus,
  createEventBus,
  publishEvent,
  subscribeToEvent,
} from '../event-bus';
import type { DomainEvent, EventMiddleware } from '@/shared/contracts/events';

describe('EventBus', () => {
  let eventBus: EventBus;

  const validGameEvent: DomainEvent = {
    id: 'game-event-001',
    source: '/vitegame/game-engine',
    type: 'com.vitegame.game.started',
    specversion: '1.0',
    time: '2025-08-26T10:30:00Z',
    datacontenttype: 'application/json',
    data: { playerId: 'player123' },
  };

  beforeEach(() => {
    eventBus = new EventBus({
      enableDebugLogging: false,
      enableMiddleware: false, // 禁用默认中间件以专注测试中间件管理
      validation: { level: 'disabled' }, // 禁用验证以专注测试事件总线逻辑
    });
  });

  afterEach(() => {
    eventBus.destroy();
  });

  describe('publish()', () => {
    test('should publish event successfully', async () => {
      const handler = vi.fn();
      await eventBus.subscribe(validGameEvent.type, handler);

      await eventBus.publish(validGameEvent);

      expect(handler).toHaveBeenCalledWith(validGameEvent);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should apply middleware to events', async () => {
      const middleware: EventMiddleware = vi.fn(event => ({
        ...event,
        data: { ...event.data, processed: true },
      }));

      eventBus.addMiddleware(middleware);

      const handler = vi.fn();
      await eventBus.subscribe(validGameEvent.type, handler);

      await eventBus.publish(validGameEvent);

      expect(middleware).toHaveBeenCalledWith(validGameEvent);
      expect(handler).toHaveBeenCalledWith({
        ...validGameEvent,
        data: { ...validGameEvent.data, processed: true },
      });
    });

    test('should emit to wildcard listeners', async () => {
      const wildcardHandler = vi.fn();
      await eventBus.subscribeAll(wildcardHandler);

      await eventBus.publish(validGameEvent);

      expect(wildcardHandler).toHaveBeenCalledWith(validGameEvent);
    });

    test('should handle middleware errors', async () => {
      const faultyMiddleware: EventMiddleware = () => {
        throw new Error('Middleware error');
      };

      eventBus.addMiddleware(faultyMiddleware);

      await expect(eventBus.publish(validGameEvent)).rejects.toThrow(
        'Middleware error'
      );
    });

    test('should update publish count statistics', async () => {
      await eventBus.publish(validGameEvent);
      await eventBus.publish(validGameEvent);

      const stats = eventBus.getStats();
      expect(stats.publishCount).toBe(2);
    });
  });

  describe('subscribe()', () => {
    test('should subscribe to events successfully', async () => {
      const handler = vi.fn();

      await eventBus.subscribe(validGameEvent.type, handler);

      const stats = eventBus.getStats();
      expect(stats.subscriptionCount).toBe(1);
    });

    test('should handle multiple subscriptions to same event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      await eventBus.subscribe(validGameEvent.type, handler1);
      await eventBus.subscribe(validGameEvent.type, handler2);

      await eventBus.publish(validGameEvent);

      expect(handler1).toHaveBeenCalledWith(validGameEvent);
      expect(handler2).toHaveBeenCalledWith(validGameEvent);
    });

    test('should handle handler errors gracefully', async () => {
      const errorHandler = vi
        .fn()
        .mockRejectedValue(new Error('Handler error'));
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await eventBus.subscribe(validGameEvent.type, errorHandler);

      await eventBus.publish(validGameEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Event handler error'),
        'Handler error'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('unsubscribe()', () => {
    test('should unsubscribe from events', async () => {
      const handler = vi.fn();

      await eventBus.subscribe(validGameEvent.type, handler);
      eventBus.unsubscribe(validGameEvent.type, handler);

      await eventBus.publish(validGameEvent);

      expect(handler).not.toHaveBeenCalled();
    });

    test('should update subscription count', async () => {
      const handler = vi.fn();

      await eventBus.subscribe(validGameEvent.type, handler);
      expect(eventBus.getStats().subscriptionCount).toBe(1);

      eventBus.unsubscribe(validGameEvent.type, handler);
      expect(eventBus.getStats().subscriptionCount).toBe(0);
    });
  });

  describe('middleware management', () => {
    test('should add middleware', () => {
      const middleware: EventMiddleware = event => event;

      eventBus.addMiddleware(middleware);

      const stats = eventBus.getStats();
      expect(stats.middlewareCount).toBe(1);
    });

    test('should remove middleware', () => {
      const middleware: EventMiddleware = event => event;

      eventBus.addMiddleware(middleware);
      eventBus.removeMiddleware(middleware);

      const stats = eventBus.getStats();
      expect(stats.middlewareCount).toBe(0);
    });

    test('should clear all middlewares', () => {
      const middleware1: EventMiddleware = event => event;
      const middleware2: EventMiddleware = event => event;

      eventBus.addMiddleware(middleware1);
      eventBus.addMiddleware(middleware2);
      eventBus.clearMiddlewares();

      const stats = eventBus.getStats();
      expect(stats.middlewareCount).toBe(0);
    });

    test('should apply middleware in sequence', async () => {
      const middleware1: EventMiddleware = event => ({
        ...event,
        data: { ...event.data, step1: true },
      });

      const middleware2: EventMiddleware = event => ({
        ...event,
        data: { ...event.data, step2: true },
      });

      eventBus.addMiddleware(middleware1);
      eventBus.addMiddleware(middleware2);

      const handler = vi.fn();
      await eventBus.subscribe(validGameEvent.type, handler);

      await eventBus.publish(validGameEvent);

      expect(handler).toHaveBeenCalledWith({
        ...validGameEvent,
        data: { ...validGameEvent.data, step1: true, step2: true },
      });
    });
  });

  describe('getStats()', () => {
    test('should return accurate statistics', async () => {
      const handler = vi.fn();
      const middleware: EventMiddleware = event => event;

      eventBus.addMiddleware(middleware);
      await eventBus.subscribe(validGameEvent.type, handler);
      await eventBus.publish(validGameEvent);

      const stats = eventBus.getStats();

      expect(stats.publishCount).toBe(1);
      expect(stats.subscriptionCount).toBe(1);
      expect(stats.middlewareCount).toBe(1);
      expect(stats.maxListeners).toBeGreaterThan(0);
      expect(stats.eventNames).toContain(validGameEvent.type);
    });
  });

  describe('destroy()', () => {
    test('should clean up all resources', async () => {
      const handler = vi.fn();
      const middleware: EventMiddleware = event => event;

      eventBus.addMiddleware(middleware);
      await eventBus.subscribe(validGameEvent.type, handler);
      await eventBus.publish(validGameEvent);

      eventBus.destroy();

      const stats = eventBus.getStats();
      expect(stats.publishCount).toBe(0);
      expect(stats.subscriptionCount).toBe(0);
      expect(stats.middlewareCount).toBe(0);
      expect(stats.eventNames).toHaveLength(0);
    });
  });

  describe('configuration options', () => {
    test('should respect maxListeners setting', () => {
      const customEventBus = new EventBus({ maxListeners: 50 });

      const stats = customEventBus.getStats();
      expect(stats.maxListeners).toBe(50);

      customEventBus.destroy();
    });

    test('should enable/disable debug logging', () => {
      const debugEventBus = new EventBus({ enableDebugLogging: true });
      const consoleDebugSpy = vi
        .spyOn(console, 'debug')
        .mockImplementation(() => {});

      debugEventBus.publish(validGameEvent);

      expect(consoleDebugSpy).toHaveBeenCalled();

      consoleDebugSpy.mockRestore();
      debugEventBus.destroy();
    });

    test('should disable middleware when configured', () => {
      const noMiddlewareEventBus = new EventBus({ enableMiddleware: false });

      const stats = noMiddlewareEventBus.getStats();
      expect(stats.middlewareCount).toBe(0);

      noMiddlewareEventBus.destroy();
    });
  });
});

describe('factory functions', () => {
  describe('createEventBus()', () => {
    test('should create custom event bus', () => {
      const customBus = createEventBus({ maxListeners: 200 });

      expect(customBus).toBeInstanceOf(EventBus);
      expect(customBus.getStats().maxListeners).toBe(200);

      customBus.destroy();
    });
  });

  describe('publishEvent() and subscribeToEvent()', () => {
    test('should use default event bus instance', async () => {
      const handler = vi.fn();
      const testEvent = {
        id: 'test-event-001',
        source: '/vitegame/test-source',
        type: 'com.vitegame.test.event',
        specversion: '1.0',
        time: '2025-08-26T10:30:00Z',
        datacontenttype: 'application/json',
        data: { message: 'test' },
      };

      await subscribeToEvent(testEvent.type, handler);
      await publishEvent(testEvent);

      expect(handler).toHaveBeenCalledWith(testEvent);
    });
  });
});

describe('error handling', () => {
  let testEventBus: EventBus;
  const testEvent = {
    id: 'test-event-001',
    source: '/vitegame/test-source',
    type: 'com.vitegame.test.event',
    specversion: '1.0',
    time: '2025-08-26T10:30:00Z',
    datacontenttype: 'application/json',
    data: { message: 'test' },
  };

  beforeEach(() => {
    testEventBus = new EventBus({
      enableDebugLogging: false,
      validation: { level: 'disabled' },
    });
  });

  afterEach(() => {
    testEventBus.destroy();
  });

  test('should emit error events for publication failures', async () => {
    const errorHandler = vi.fn();
    const emitter = testEventBus.getEmitterForTesting();
    emitter.on('error', errorHandler);

    const faultyMiddleware: EventMiddleware = () => {
      throw new Error('Middleware failure');
    };

    testEventBus.addMiddleware(faultyMiddleware);

    await expect(testEventBus.publish(testEvent)).rejects.toThrow(
      'Middleware failure'
    );
    expect(errorHandler).toHaveBeenCalled();
  });

  test('should emit handler-error events', async () => {
    const handlerErrorListener = vi.fn();
    const emitter = testEventBus.getEmitterForTesting();
    emitter.on('handler-error', handlerErrorListener);

    const faultyHandler = vi
      .fn()
      .mockRejectedValue(new Error('Handler failure'));
    await testEventBus.subscribe(testEvent.type, faultyHandler);

    await testEventBus.publish(testEvent);

    expect(handlerErrorListener).toHaveBeenCalledWith({
      eventType: testEvent.type,
      event: testEvent,
      error: 'Handler failure',
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    });
  });
});

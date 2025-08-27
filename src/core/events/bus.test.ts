/*
 * Event Bus 单元测试
 * 演示 TDD 开发模式和测试最佳实践
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryEventBus } from './bus';
import type { EventBus } from './bus';
import type { AppEvent, EventHandler } from './types';

describe('InMemoryEventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
  });

  describe('事件发布 (publish)', () => {
    it('应该成功发布有效格式的事件', async () => {
      const event: AppEvent = { type: 'guild.create', name: 'Test Guild' };

      await expect(eventBus.publish(event)).resolves.not.toThrow();
    });

    it('应该拒绝无效格式的事件类型', async () => {
      const invalidEvent = { type: 'invalid_format', name: 'Test' } as any;

      await expect(eventBus.publish(invalidEvent)).rejects.toThrow(
        'Invalid event type: invalid_format'
      );
    });

    it('应该拒绝空事件类型', async () => {
      const emptyEvent = { type: '', name: 'Test' } as any;

      await expect(eventBus.publish(emptyEvent)).rejects.toThrow(
        'Invalid event type: '
      );
    });

    it('应该拒绝单段事件类型', async () => {
      const singleEvent = { type: 'guild', name: 'Test' } as any;

      await expect(eventBus.publish(singleEvent)).rejects.toThrow(
        'Invalid event type: guild'
      );
    });
  });

  describe('事件订阅 (subscribe)', () => {
    it('应该成功订阅事件并返回订阅对象', () => {
      const handler: EventHandler = vi.fn();

      const subscription = eventBus.subscribe('guild.create', handler);

      expect(subscription).toBeDefined();
      expect(subscription.unsubscribe).toBeTypeOf('function');
    });

    it('应该支持多个处理器订阅同一事件类型', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const event: AppEvent = { type: 'guild.create', name: 'Test Guild' };

      eventBus.subscribe('guild.create', handler1);
      eventBus.subscribe('guild.create', handler2);

      await eventBus.publish(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('应该按订阅顺序依次调用处理器 (FIFO)', async () => {
      const callOrder: number[] = [];
      const handler1 = vi.fn(() => callOrder.push(1));
      const handler2 = vi.fn(() => callOrder.push(2));
      const handler3 = vi.fn(() => callOrder.push(3));
      const event: AppEvent = { type: 'guild.create', name: 'Test Guild' };

      eventBus.subscribe('guild.create', handler1);
      eventBus.subscribe('guild.create', handler2);
      eventBus.subscribe('guild.create', handler3);

      await eventBus.publish(event);

      expect(callOrder).toEqual([1, 2, 3]);
    });
  });

  describe('事件处理器调用', () => {
    it('应该传递正确的事件数据给处理器', async () => {
      const handler = vi.fn();
      const event: AppEvent = {
        type: 'guild.rename',
        id: 'guild-123',
        name: 'New Name',
      };

      eventBus.subscribe('guild.rename', handler);
      await eventBus.publish(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('应该支持异步处理器', async () => {
      const asyncHandler = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const event: AppEvent = { type: 'guild.create', name: 'Async Guild' };

      eventBus.subscribe('guild.create', asyncHandler);
      await eventBus.publish(event);

      expect(asyncHandler).toHaveBeenCalledWith(event);
    });

    it('应该等待所有异步处理器完成', async () => {
      let completed = false;
      const slowHandler = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        completed = true;
      });
      const event: AppEvent = { type: 'guild.create', name: 'Slow Guild' };

      eventBus.subscribe('guild.create', slowHandler);
      await eventBus.publish(event);

      expect(completed).toBe(true);
    });
  });

  describe('取消订阅 (unsubscribe)', () => {
    it('应该能够取消订阅并停止接收事件', async () => {
      const handler = vi.fn();
      const event: AppEvent = { type: 'guild.create', name: 'Test Guild' };

      const subscription = eventBus.subscribe('guild.create', handler);
      subscription.unsubscribe();

      await eventBus.publish(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('应该只取消特定的订阅，不影响其他订阅', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const event: AppEvent = { type: 'guild.create', name: 'Test Guild' };

      const subscription1 = eventBus.subscribe('guild.create', handler1);
      eventBus.subscribe('guild.create', handler2);

      subscription1.unsubscribe();
      await eventBus.publish(event);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('应该安全处理重复取消订阅', () => {
      const handler = vi.fn();

      const subscription = eventBus.subscribe('guild.create', handler);

      expect(() => {
        subscription.unsubscribe();
        subscription.unsubscribe(); // 重复取消订阅
      }).not.toThrow();
    });
  });

  describe('清空事件总线 (clear)', () => {
    it('应该清空所有订阅', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const event1: AppEvent = { type: 'guild.create', name: 'Guild 1' };
      const event2: AppEvent = {
        type: 'inventory.add',
        itemId: 'item-1',
        qty: 5,
      };

      eventBus.subscribe('guild.create', handler1);
      eventBus.subscribe('inventory.add', handler2);

      eventBus.clear();

      await eventBus.publish(event1);
      await eventBus.publish(event2);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('类型安全', () => {
    it('应该正确处理不同事件类型', async () => {
      const guildHandler = vi.fn();
      const inventoryHandler = vi.fn();

      eventBus.subscribe('guild.create', guildHandler);
      eventBus.subscribe('inventory.add', inventoryHandler);

      const guildEvent: AppEvent = {
        type: 'guild.create',
        name: 'Type Safe Guild',
      };
      const inventoryEvent: AppEvent = {
        type: 'inventory.add',
        itemId: 'sword',
        qty: 1,
      };

      await eventBus.publish(guildEvent);
      await eventBus.publish(inventoryEvent);

      expect(guildHandler).toHaveBeenCalledWith(guildEvent);
      expect(guildHandler).not.toHaveBeenCalledWith(inventoryEvent);

      expect(inventoryHandler).toHaveBeenCalledWith(inventoryEvent);
      expect(inventoryHandler).not.toHaveBeenCalledWith(guildEvent);
    });
  });

  describe('错误处理', () => {
    it('应该处理处理器中的同步错误', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const event: AppEvent = { type: 'guild.create', name: 'Error Guild' };

      eventBus.subscribe('guild.create', errorHandler);

      await expect(eventBus.publish(event)).rejects.toThrow('Handler error');
    });

    it('应该处理处理器中的异步错误', async () => {
      const asyncErrorHandler = vi.fn(async () => {
        throw new Error('Async handler error');
      });
      const event: AppEvent = {
        type: 'guild.create',
        name: 'Async Error Guild',
      };

      eventBus.subscribe('guild.create', asyncErrorHandler);

      await expect(eventBus.publish(event)).rejects.toThrow(
        'Async handler error'
      );
    });
  });

  describe('性能特性', () => {
    it('应该能处理大量订阅者', async () => {
      const handlers = Array.from({ length: 1000 }, () => vi.fn());
      const event: AppEvent = {
        type: 'guild.create',
        name: 'Performance Guild',
      };

      handlers.forEach(handler => {
        eventBus.subscribe('guild.create', handler);
      });

      const startTime = Date.now();
      await eventBus.publish(event);
      const endTime = Date.now();

      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledWith(event);
      });

      // 性能断言：1000个处理器应该在100ms内完成
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('应该能处理快速连续发布', async () => {
      const handler = vi.fn();
      eventBus.subscribe('guild.create', handler);

      const events = Array.from({ length: 100 }, (_, i) => ({
        type: 'guild.create' as const,
        name: `Guild ${i}`,
      }));

      const startTime = Date.now();
      await Promise.all(events.map(event => eventBus.publish(event)));
      const endTime = Date.now();

      expect(handler).toHaveBeenCalledTimes(100);

      // 性能断言：100个事件应该在50ms内完成
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});

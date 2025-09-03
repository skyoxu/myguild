/**
 * 增强的事件总线系统
 * 支持React与Phaser之间的双向通信
 * 符合 CLAUDE.md 架构要求和事件驱动设计
 */

import type {
  GameDomainEvent,
  GameEventHandler,
  EnhancedGameEvent,
  GameEventMetadata,
} from '../contracts/events/GameEvents';
import { EventPriority } from '../contracts/events/GameEvents';

export interface EventSubscription {
  id: string;
  handler: GameEventHandler;
  priority: EventPriority;
  once?: boolean;
  context?: string; // 用于区分React或Phaser上下文
}

export interface EventBusOptions {
  maxListeners?: number;
  enableLogging?: boolean;
  enableMetrics?: boolean;
  queueSize?: number;
}

export class EventBus {
  private listeners: Map<string, EventSubscription[]> = new Map();
  private eventQueue: EnhancedGameEvent[] = [];
  private isProcessing = false;
  private subscriptionIdCounter = 0;
  private options: Required<EventBusOptions>;

  // 性能监控
  private metrics = {
    eventsPublished: 0,
    eventsProcessed: 0,
    averageProcessingTime: 0,
    lastEventTime: 0,
  };

  constructor(options: EventBusOptions = {}) {
    this.options = {
      maxListeners: options.maxListeners ?? 100,
      enableLogging:
        options.enableLogging ?? process.env.NODE_ENV === 'development',
      enableMetrics: options.enableMetrics ?? true,
      queueSize: options.queueSize ?? 1000,
    };
  }

  /**
   * 订阅事件
   */
  public subscribe<T extends GameDomainEvent>(
    eventType: T['type'],
    handler: GameEventHandler<T>,
    options: {
      priority?: EventPriority;
      once?: boolean;
      context?: string;
    } = {}
  ): string {
    const subscriptionId = `sub_${++this.subscriptionIdCounter}`;

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const eventListeners = this.listeners.get(eventType)!;

    // 检查监听器数量限制
    if (eventListeners.length >= this.options.maxListeners) {
      throw new Error(
        `Maximum listeners (${this.options.maxListeners}) exceeded for event: ${eventType}`
      );
    }

    const subscription: EventSubscription = {
      id: subscriptionId,
      handler: handler as GameEventHandler,
      priority: options.priority ?? EventPriority.NORMAL,
      once: options.once ?? false,
      context: options.context,
    };

    eventListeners.push(subscription);

    // 按优先级排序（高优先级在前）
    eventListeners.sort((a, b) => b.priority - a.priority);

    if (this.options.enableLogging) {
      console.log(
        `[EventBus] Subscribed to ${eventType} (ID: ${subscriptionId}, Context: ${options.context || 'unknown'})`
      );
    }

    return subscriptionId;
  }

  /**
   * 取消订阅
   */
  public unsubscribe(subscriptionId: string): boolean {
    for (const [eventType, subscriptions] of this.listeners.entries()) {
      const index = subscriptions.findIndex(sub => sub.id === subscriptionId);
      if (index !== -1) {
        subscriptions.splice(index, 1);

        // 如果没有监听器了，清理Map
        if (subscriptions.length === 0) {
          this.listeners.delete(eventType);
        }

        if (this.options.enableLogging) {
          console.log(
            `[EventBus] Unsubscribed from ${eventType} (ID: ${subscriptionId})`
          );
        }

        return true;
      }
    }
    return false;
  }

  /**
   * 取消指定事件类型的所有订阅
   */
  public unsubscribeAll(eventType: GameDomainEvent['type']): number {
    const subscriptions = this.listeners.get(eventType);
    if (subscriptions) {
      const count = subscriptions.length;
      this.listeners.delete(eventType);

      if (this.options.enableLogging) {
        console.log(
          `[EventBus] Unsubscribed all (${count}) listeners from ${eventType}`
        );
      }

      return count;
    }
    return 0;
  }

  /**
   * 发布事件（同步）
   */
  public publish(
    event: GameDomainEvent,
    metadata?: Partial<GameEventMetadata>
  ): void {
    const enhancedEvent: EnhancedGameEvent = {
      ...event,
      metadata: {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        source: metadata?.source || 'unknown',
        priority: metadata?.priority || EventPriority.NORMAL,
        persistent: metadata?.persistent || false,
        broadcast: metadata?.broadcast || true,
        ...metadata,
      },
    };

    this.metrics.eventsPublished++;

    if (this.options.enableLogging) {
      console.log(`[EventBus] Publishing event: ${event.type}`, enhancedEvent);
    }

    // 立即处理事件
    this.processEvent(enhancedEvent);
  }

  /**
   * 发布事件（异步队列）
   */
  public async publishAsync(
    event: GameDomainEvent,
    metadata?: Partial<GameEventMetadata>
  ): Promise<void> {
    const enhancedEvent: EnhancedGameEvent = {
      ...event,
      metadata: {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        source: metadata?.source || 'unknown',
        priority: metadata?.priority || EventPriority.NORMAL,
        persistent: metadata?.persistent || false,
        broadcast: metadata?.broadcast || true,
        ...metadata,
      },
    };

    // 检查队列大小
    if (this.eventQueue.length >= this.options.queueSize) {
      console.warn(
        `[EventBus] Event queue full (${this.options.queueSize}), dropping oldest event`
      );
      this.eventQueue.shift();
    }

    this.eventQueue.push(enhancedEvent);
    this.metrics.eventsPublished++;

    // 如果没有在处理，开始处理队列
    if (!this.isProcessing) {
      await this.processEventQueue();
    }
  }

  /**
   * 处理单个事件
   */
  private processEvent(event: EnhancedGameEvent): void {
    const startTime = performance.now();
    const subscriptions = this.listeners.get((event as any).type) || [];

    if (subscriptions.length === 0) {
      if (this.options.enableLogging) {
        console.warn(
          `[EventBus] No listeners for event: ${(event as any).type}`
        );
      }
      return;
    }

    // 处理所有订阅者
    const toRemove: string[] = [];

    for (const subscription of subscriptions) {
      try {
        const result = subscription.handler(event as any);

        // 处理异步处理器
        if (result instanceof Promise) {
          result.catch(error => {
            console.error(
              `[EventBus] Async handler error for ${(event as any).type}:`,
              error
            );
          });
        }

        // 标记一次性订阅以供移除
        if (subscription.once) {
          toRemove.push(subscription.id);
        }
      } catch (error) {
        console.error(
          `[EventBus] Handler error for ${(event as any).type}:`,
          error
        );
      }
    }

    // 移除一次性订阅
    toRemove.forEach(id => this.unsubscribe(id));

    // 更新性能指标
    if (this.options.enableMetrics) {
      const processingTime = performance.now() - startTime;
      this.metrics.eventsProcessed++;
      this.metrics.averageProcessingTime =
        (this.metrics.averageProcessingTime *
          (this.metrics.eventsProcessed - 1) +
          processingTime) /
        this.metrics.eventsProcessed;
      this.metrics.lastEventTime = Date.now();
    }
  }

  /**
   * 处理事件队列
   */
  private async processEventQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;

        // 按优先级处理
        if (event.metadata.priority >= EventPriority.HIGH) {
          this.processEvent(event);
        } else {
          // 低优先级事件可以在下一个微任务中处理
          await new Promise(resolve => setTimeout(resolve, 0));
          this.processEvent(event);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 获取事件监听器统计信息
   */
  public getListenerStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const [eventType, subscriptions] of this.listeners.entries()) {
      stats[eventType] = subscriptions.length;
    }

    return stats;
  }

  /**
   * 获取性能指标
   */
  public getMetrics() {
    return { ...this.metrics };
  }

  /**
   * 清理所有监听器和队列
   */
  public destroy(): void {
    this.listeners.clear();
    this.eventQueue.length = 0;
    this.isProcessing = false;

    if (this.options.enableLogging) {
      console.log('[EventBus] EventBus destroyed');
    }
  }

  /**
   * 检查是否有指定事件的监听器
   */
  public hasListeners(eventType: GameDomainEvent['type']): boolean {
    const subscriptions = this.listeners.get(eventType);
    return subscriptions ? subscriptions.length > 0 : false;
  }

  /**
   * 获取指定事件的监听器数量
   */
  public getListenerCount(eventType: GameDomainEvent['type']): number {
    const subscriptions = this.listeners.get(eventType);
    return subscriptions ? subscriptions.length : 0;
  }
}

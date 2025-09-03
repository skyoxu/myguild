/**
 * 事件总线实现 - 集成CloudEvents验证中间件
 * 基于 CH04 系统上下文与事件流架构
 *
 * 功能：
 * - CloudEvents 1.0规范事件发布/订阅
 * - 运行时验证中间件集成
 * - 性能监控和错误统计
 * - 跨进程事件通信支持
 */

import { EventEmitter } from 'events';
import type {
  DomainEvent,
  BaseEvent,
  EventPublisher,
  EventSubscriber,
  EventMiddleware,
} from '../contracts/events';
import {
  createValidationMiddleware,
  type ValidationConfig,
} from '../middleware/cloud-events-validator';

// ============================================================================
// 事件总线配置
// ============================================================================

export interface EventBusConfig {
  /** CloudEvents验证配置 */
  validation?: Partial<ValidationConfig>;
  /** 是否启用事件中间件 */
  enableMiddleware: boolean;
  /** 最大监听器数量 */
  maxListeners: number;
  /** 是否启用调试日志 */
  enableDebugLogging: boolean;
}

const DEFAULT_CONFIG: EventBusConfig = {
  validation: {
    level: (process.env.CLOUDEVENTS_VALIDATION_LEVEL as any) || 'strict',
    enablePerformanceMonitoring: process.env.NODE_ENV !== 'production',
  },
  enableMiddleware: true,
  maxListeners: Number(process.env.EVENT_BUS_MAX_LISTENERS || '100'),
  enableDebugLogging: process.env.DEBUG_EVENTS === 'true',
};

// ============================================================================
// 事件总线实现
// ============================================================================

export class EventBus implements EventPublisher, EventSubscriber {
  private emitter: EventEmitter;
  private middlewares: EventMiddleware[] = [];
  private config: EventBusConfig;
  private publishCount = 0;
  private subscriptionCount = 0;
  // 存储原始handler到wrapped handler的映射，用于正确的unsubscribe
  private handlerMap = new Map<string, Map<Function, Function>>();

  constructor(config: Partial<EventBusConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(this.config.maxListeners);

    // 默认添加CloudEvents验证中间件
    if (this.config.enableMiddleware) {
      this.addMiddleware(createValidationMiddleware(this.config.validation));
    }

    this.setupErrorHandling();
  }

  // ============================================================================
  // 公开API
  // ============================================================================

  /**
   * 发布事件
   */
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    try {
      // 应用中间件
      let processedEvent = event as BaseEvent;
      for (const middleware of this.middlewares) {
        processedEvent = middleware(processedEvent);
      }

      // 调试日志
      if (this.config.enableDebugLogging) {
        console.debug(`📤 Publishing event: ${event.type}`, {
          id: event.id,
          source: event.source,
          timestamp: event.time,
        });
      }

      // 发布到内部事件系统
      this.emitter.emit(event.type, processedEvent);
      this.emitter.emit('*', processedEvent); // 通配符监听

      this.publishCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (this.config.enableDebugLogging) {
        console.error(
          `❌ Failed to publish event ${event.type}:`,
          errorMessage
        );
      }

      // 发布错误事件
      this.emitter.emit('error', {
        event,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * 订阅事件
   */
  async subscribe<T extends DomainEvent>(
    eventType: T['type'],
    handler: (event: T) => Promise<void>
  ): Promise<void> {
    const wrappedHandler = async (event: T) => {
      try {
        if (this.config.enableDebugLogging) {
          console.debug(`📥 Handling event: ${eventType}`, {
            id: event.id,
            source: event.source,
          });
        }

        await handler(event);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        console.error(`❌ Event handler error for ${eventType}:`, errorMessage);

        // 发布处理错误事件
        this.emitter.emit('handler-error', {
          eventType,
          event,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
      }
    };

    // 存储原始handler到wrapped handler的映射
    if (!this.handlerMap.has(eventType)) {
      this.handlerMap.set(eventType, new Map());
    }
    this.handlerMap.get(eventType)!.set(handler, wrappedHandler);

    this.emitter.on(eventType, wrappedHandler);
    this.subscriptionCount++;

    if (this.config.enableDebugLogging) {
      console.debug(
        `🔔 Subscribed to event: ${eventType} (total subscriptions: ${this.subscriptionCount})`
      );
    }
  }

  /**
   * 订阅所有事件（通配符监听）
   */
  async subscribeAll(
    handler: (event: DomainEvent) => Promise<void>
  ): Promise<void> {
    await this.subscribe('*' as any, handler);
  }

  /**
   * 取消订阅
   */
  unsubscribe(eventType: string, handler: (...args: any[]) => void): void {
    // 使用映射获取对应的wrapped handler
    const eventHandlers = this.handlerMap.get(eventType);
    if (eventHandlers && eventHandlers.has(handler)) {
      const wrappedHandler = eventHandlers.get(handler)!;
      this.emitter.off(eventType, wrappedHandler);
      eventHandlers.delete(handler);
      
      // 如果该事件类型没有更多handler，清理映射
      if (eventHandlers.size === 0) {
        this.handlerMap.delete(eventType);
      }
    } else {
      // 回退到直接使用原始handler（用于向后兼容）
      this.emitter.off(eventType, handler);
    }
    
    this.subscriptionCount = Math.max(0, this.subscriptionCount - 1);

    if (this.config.enableDebugLogging) {
      console.debug(`🔕 Unsubscribed from event: ${eventType}`);
    }
  }

  /**
   * 添加中间件
   */
  addMiddleware(middleware: EventMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * 移除中间件
   */
  removeMiddleware(middleware: EventMiddleware): void {
    const index = this.middlewares.indexOf(middleware);
    if (index > -1) {
      this.middlewares.splice(index, 1);
    }
  }

  /**
   * 清除所有中间件
   */
  clearMiddlewares(): void {
    this.middlewares = [];
  }

  /**
   * 获取事件总线统计信息
   */
  getStats() {
    return {
      publishCount: this.publishCount,
      subscriptionCount: this.subscriptionCount,
      middlewareCount: this.middlewares.length,
      maxListeners: this.emitter.getMaxListeners(),
      eventNames: this.emitter.eventNames(),
    };
  }

  /**
   * 获取内部事件发射器（仅用于测试）
   */
  getEmitterForTesting(): EventEmitter {
    return this.emitter;
  }

  /**
   * 销毁事件总线
   */
  destroy(): void {
    this.emitter.removeAllListeners();
    this.middlewares = [];
    this.handlerMap.clear();
    this.publishCount = 0;
    this.subscriptionCount = 0;

    if (this.config.enableDebugLogging) {
      console.debug('🔥 EventBus destroyed');
    }
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private setupErrorHandling(): void {
    // 处理未捕获的事件处理器错误
    this.emitter.on('error', errorInfo => {
      console.error('💥 EventBus error:', errorInfo);
    });

    // 处理事件处理器错误
    this.emitter.on('handler-error', errorInfo => {
      console.warn('⚠️  Event handler error:', errorInfo);
    });

    // 监控内存使用
    if (this.config.enableDebugLogging && typeof process !== 'undefined') {
      setInterval(() => {
        const listenerCount = this.emitter
          .eventNames()
          .reduce(
            (total, eventName) => total + this.emitter.listenerCount(eventName),
            0
          );

        if (listenerCount > this.config.maxListeners * 0.8) {
          console.warn(
            `⚠️  EventBus approaching listener limit: ${listenerCount}/${this.config.maxListeners}`
          );
        }
      }, 30000); // 每30秒检查一次
    }
  }
}

// ============================================================================
// 工厂函数和默认实例
// ============================================================================

// 默认事件总线实例
export const eventBus = new EventBus();

// 创建自定义事件总线
export function createEventBus(config?: Partial<EventBusConfig>): EventBus {
  return new EventBus(config);
}

// 便捷的发布函数
export async function publishEvent<T extends DomainEvent>(
  event: T
): Promise<void> {
  return eventBus.publish(event);
}

// 便捷的订阅函数
export async function subscribeToEvent<T extends DomainEvent>(
  eventType: T['type'],
  handler: (event: T) => Promise<void>
): Promise<void> {
  return eventBus.subscribe(eventType, handler);
}

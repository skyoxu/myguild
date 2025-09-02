/**
 * 事件契约定义
 * 符合CloudEvents 1.0规范的事件类型系统
 */

/**
 * 基础事件接口
 */
export interface BaseEvent {
  specversion: '1.0';
  type: string;
  source: string;
  id: string;
  time: string;
  datacontenttype: string;
  data: unknown;
}

/**
 * 游戏域事件类型
 */
export interface GameEvent extends BaseEvent {
  type: `${string}.game.${string}`;
  source: '/vitegame/game-engine';
}

/**
 * UI域事件类型
 */
export interface UIEvent extends BaseEvent {
  type: `${string}.ui.${string}`;
  source: '/vitegame/ui-layer';
}

/**
 * 系统域事件类型
 */
export interface SystemEvent extends BaseEvent {
  type: `${string}.system.${string}`;
  source: '/vitegame/system';
}

/**
 * 联合事件类型
 */
export type DomainEvent = GameEvent | UIEvent | SystemEvent;

/**
 * 事件发布器接口
 */
export interface EventPublisher {
  publish<T extends DomainEvent>(event: T): Promise<void>;
}

/**
 * 事件中间件类型
 */
export type EventMiddleware = (event: BaseEvent) => BaseEvent;

/**
 * 事件订阅器接口
 */
export interface EventSubscriber {
  subscribe<T extends DomainEvent>(
    eventType: T['type'],
    handler: (event: T) => Promise<void>
  ): Promise<void>;
}

/**
 * 事件名称类型
 */
export type EventName = string;

/**
 * 事件优先级
 */
export type EventPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * 事件来源类型
 */
export type EventSource = string;

/**
 * 事件总线指标
 */
export interface EventBusMetrics {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  avgProcessingTime: number;
}

/**
 * 批处理结果
 */
export interface BatchResult {
  processed: number;
  failed: number;
  errors: Error[];
}

/**
 * 事件订阅
 */
export interface EventSubscription {
  id: string;
  eventType: string;
  handler: Function;
}

/**
 * 批处理配置
 */
export interface BatchConfig {
  batchSize: number;
  flushInterval: number;
  priorityThresholds: Record<EventPriority, number>;
}

/**
 * 默认批处理配置
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 100,
  flushInterval: 1000,
  priorityThresholds: {
    critical: 0,
    high: 10,
    normal: 50,
    low: 100,
  },
};

/**
 * 事件工具类
 */
export class EventUtils {
  /**
   * 验证事件名称格式
   */
  static isValidEventName(name: string): boolean {
    const pattern = /^[a-z][a-z0-9]*\.[a-z][a-z0-9]*\.[a-z][a-z0-9]*$/;
    return pattern.test(name) && !name.includes('..');
  }

  /**
   * 模式匹配
   */
  static matchesPattern(eventName: string, pattern: string): boolean {
    const regexPattern = pattern.replace(/\*/g, '[^.]*').replace(/\*\*/g, '.*');
    return new RegExp(`^${regexPattern}$`).test(eventName);
  }

  /**
   * 推断事件优先级
   */
  static inferPriority(eventType: string): EventPriority {
    // 默认返回normal，除非有特殊标识
    return 'normal';
  }

  /**
   * 创建事件
   */
  static createEvent<T extends DomainEvent>(options: {
    type: T['type'];
    source: T['source'];
    data: T['data'];
    id?: string;
    time?: string;
  }): T {
    return {
      specversion: '1.0',
      type: options.type,
      source: options.source,
      id: options.id || crypto.randomUUID(),
      time: options.time || new Date().toISOString(),
      datacontenttype: 'application/json',
      data: options.data,
    } as T;
  }
}

/**
 * 事件模式
 */
export class EventPatterns {
  static readonly GAME_EVENTS = 'game.**';
  static readonly UI_EVENTS = 'ui.**';
  static readonly SYSTEM_EVENTS = 'system.**';
  static readonly ERROR_EVENTS = '**.error.**';
}

/**
 * 优先级映射
 */
export class PriorityMapping {
  static readonly priorityThresholds = DEFAULT_BATCH_CONFIG.priorityThresholds;
}

/**
 * 事件总线错误基类
 */
export class EventBusError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'EventBusError';
  }
}

/**
 * 断路器打开错误
 */
export class CircuitBreakerOpenError extends EventBusError {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * 背压错误
 */
export class BackpressureError extends EventBusError {
  constructor(message: string) {
    super(message);
    this.name = 'BackpressureError';
  }
}

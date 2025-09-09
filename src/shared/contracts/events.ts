/**
 * 事件契约定义
 * 符合CloudEvents 1.0规范的事件类型系统
 */

/**
 * 基础事件接口 - 符合CloudEvents v1.0规范
 */
export interface BaseEvent {
  // CloudEvents v1.0 必需字段
  specversion: '1.0';
  type: string;
  source: string;
  id: string;

  // CloudEvents v1.0 可选字段
  time?: string; // RFC3339格式时间戳，可选
  datacontenttype?: string;
  dataschema?: string;
  subject?: string;
  data?: unknown;

  // 扩展属性（任何符合CloudEvents扩展规范的字段）
  [key: string]: any;
}

/**
 * 游戏域事件类型 - 简化类型约束以避免模板字符串冲突
 */
export interface GameEvent extends BaseEvent {
  type: string; // 移除模板字符串约束
  source: string; // 允许更灵活的source类型
}

/**
 * UI域事件类型
 */
export interface UIEvent extends BaseEvent {
  type: string; // 移除模板字符串约束
  source: string; // 允许更灵活的source类型
}

/**
 * 系统域事件类型
 */
export interface SystemEvent extends BaseEvent {
  type: string; // 移除模板字符串约束
  source: string; // 允许更灵活的source类型
}

/**
 * 安全全局初始化事件 - 用于Electron安全配置验证
 * 符合ADR-0004事件命名规约和可观测性要求
 */
export interface SecurityGlobalInitEvent extends BaseEvent {
  type: 'security.global.init';
  source: 'app://main';
  data: {
    readyAt: string;
    handlers: Array<
      'permissionCheck' | 'permissionRequest' | 'headers' | 'beforeRequest'
    >;
  };
}

/**
 * 联合事件类型
 */
export type DomainEvent =
  | GameEvent
  | UIEvent
  | SystemEvent
  | SecurityGlobalInitEvent;

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
export type EventPriority = 'low' | 'medium' | 'high' | 'critical';

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
  maxBatchSize: number; // 添加maxBatchSize字段以匹配测试
  flushInterval: number;
  priorityThresholds: Record<EventPriority, number>;
}

/**
 * 默认批处理配置
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 100,
  maxBatchSize: 50, // 最大批处理大小
  flushInterval: 16, // 16ms (约60fps)
  priorityThresholds: {
    critical: 0,
    high: 1, // 下一帧处理
    medium: 16, // 批量处理
    low: 100, // 空闲处理
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
    // 默认返回medium，除非有特殊标识
    return 'medium';
  }

  /**
   * 创建事件 - 符合CloudEvents v1.0规范，支持两种调用方式
   */
  static createEvent<T extends DomainEvent>(options: {
    type: string;
    source: string;
    data?: any;
    id?: string;
    time?: string;
    subject?: string;
    datacontenttype?: string;
    dataschema?: string;
    [key: string]: any;
  }): T;
  static createEvent<T extends DomainEvent>(
    type: string,
    source: string,
    data?: any,
    options?: {
      id?: string;
      time?: string;
      subject?: string;
      datacontenttype?: string;
      dataschema?: string;
      priority?: EventPriority;
      traceId?: string;
      sequenceId?: number;
      [key: string]: any;
    }
  ): T;
  static createEvent<T extends DomainEvent>(
    typeOrOptions:
      | string
      | {
          type: string;
          source: string;
          data?: any;
          id?: string;
          time?: string;
          subject?: string;
          datacontenttype?: string;
          dataschema?: string;
          [key: string]: any;
        },
    source?: string,
    data?: any,
    options?: {
      id?: string;
      time?: string;
      subject?: string;
      datacontenttype?: string;
      dataschema?: string;
      priority?: EventPriority;
      traceId?: string;
      sequenceId?: number;
      [key: string]: any;
    }
  ): T {
    // 判断是对象调用还是参数调用
    if (typeof typeOrOptions === 'object') {
      // 新的对象调用方式
      const opts = typeOrOptions;
      const event: BaseEvent = {
        // CloudEvents v1.0 必需字段
        specversion: '1.0',
        type: opts.type,
        source: opts.source,
        id: opts.id || crypto.randomUUID(),

        // CloudEvents v1.0 可选字段 - time字段默认自动生成
        time: opts.time || new Date().toISOString(),
        ...(opts.subject && { subject: opts.subject }),
        datacontenttype: opts.datacontenttype || 'application/json', // 默认内容类型
        ...(opts.dataschema && { dataschema: opts.dataschema }),
        ...(opts.data !== undefined && { data: opts.data }),
      };

      // 添加其他扩展属性
      Object.keys(opts).forEach(key => {
        if (
          ![
            'type',
            'source',
            'id',
            'time',
            'subject',
            'datacontenttype',
            'dataschema',
            'data',
          ].includes(key)
        ) {
          event[key] = opts[key];
        }
      });

      return event as T;
    }
    // 旧的参数调用方式 - 保持向后兼容性
    const type = typeOrOptions;
    const eventOptions = options || {};
    const event: BaseEvent = {
      // CloudEvents v1.0 必需字段
      specversion: '1.0',
      type,
      source: source!,
      id: eventOptions.id || crypto.randomUUID(),

      // CloudEvents v1.0 可选字段 - time字段默认自动生成
      time: eventOptions.time || new Date().toISOString(),
      ...(eventOptions.subject && { subject: eventOptions.subject }),
      datacontenttype: eventOptions.datacontenttype || 'application/json', // 默认内容类型
      ...(eventOptions.dataschema && { dataschema: eventOptions.dataschema }),
      ...(data !== undefined && { data }),
    };

    // 添加默认扩展属性（非CloudEvents v1.0标准，但用于向后兼容）
    event.priority = eventOptions.priority || 'medium';
    event.sequenceId = eventOptions.sequenceId || 0;
    event.timestamp = Date.now(); // 数字时间戳，补充ISO时间字符串
    if (eventOptions.traceId) {
      event.traceId = eventOptions.traceId;
    }

    // 添加其他自定义扩展属性
    Object.keys(eventOptions).forEach(key => {
      if (
        ![
          'id',
          'time',
          'subject',
          'datacontenttype',
          'dataschema',
          'priority',
          'sequenceId',
          'traceId',
        ].includes(key)
      ) {
        event[key] = eventOptions[key];
      }
    });

    return event as T;
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

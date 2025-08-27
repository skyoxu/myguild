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

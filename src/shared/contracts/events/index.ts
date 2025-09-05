/**
 * 应用事件类型定义
 * 符合 CLAUDE.md 事件命名规则：${DOMAIN_PREFIX}.<entity>.<action>
 */

import type { GameDomainEvent } from './GameEvents';

// 基础事件接口
export interface BaseEvent {
  type: string;
  data?: any;
  source?: string;
  timestamp?: Date;
  metadata?: {
    id?: string;
    priority?: number;
    persistent?: boolean;
    broadcast?: boolean;
  };
}

// 系统事件类型 - 简化设计，移除模板字符串约束
export interface SystemEvent extends BaseEvent {
  type: string;
}

// 应用事件类型
export type AppEvent =
  | { type: 'guild.create'; name: string }
  | { type: 'guild.rename'; id: string; name: string }
  | { type: 'inventory.add'; itemId: string; qty: number };

// 联合所有事件类型 - 统一为基础事件类型以避免类型冲突
export type DomainEvent = BaseEvent;

export type AppEventType = AppEvent['type'];

export type EventHandler<T extends DomainEvent = DomainEvent> = (
  e: T
) => void | Promise<void>;

// 类型别名支持
export type EventType = DomainEvent['type'];

// 导出游戏事件
export * from './GameEvents';

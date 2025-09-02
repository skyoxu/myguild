/**
 * 应用事件类型定义
 * 符合 CLAUDE.md 事件命名规则：${DOMAIN_PREFIX}.<entity>.<action>
 */

import type { GameDomainEvent } from './GameEvents';

// 系统事件类型
export type SystemEvent =
  | { type: `${string}.system.${string}`; data?: any }
  | { type: `${string}.ui.${string}`; data?: any }
  | { type: 'guild.ui.notification.shown'; data: { message: string; type: 'info' | 'success' | 'warning' | 'error' } };

// 应用事件类型 
export type AppEvent =
  | { type: 'guild.create'; name: string }
  | { type: 'guild.rename'; id: string; name: string }
  | { type: 'inventory.add'; itemId: string; qty: number };

// 联合所有事件类型
export type DomainEvent = GameDomainEvent | SystemEvent | AppEvent;

export type AppEventType = AppEvent['type'];

export type EventHandler<T extends DomainEvent = DomainEvent> = (
  e: T
) => void | Promise<void>;

// 类型别名支持
export type EventType = DomainEvent['type'];

// 导出游戏事件
export * from './GameEvents';

/**
 * 应用事件类型定义
 * 符合 CLAUDE.md 事件命名规则：${DOMAIN_PREFIX}.<entity>.<action>
 */

export type AppEvent =
  | { type: 'guild.create'; name: string }
  | { type: 'guild.rename'; id: string; name: string }
  | { type: 'inventory.add'; itemId: string; qty: number };

export type AppEventType = AppEvent['type'];

export type EventHandler<T extends AppEvent = AppEvent> = (
  e: T
) => void | Promise<void>;

// 别名支持
export type DomainEvent = AppEvent;
export type EventType = AppEventType;

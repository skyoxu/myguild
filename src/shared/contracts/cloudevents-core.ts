/**
 * CloudEvents 1.0规范核心实现 - ADR-0004
 * 基于COPY.md的就地可执行代码片段
 *
 * 提供符合CloudEvents 1.0标准的最小构造器、验证器与类型定义
 * 作为事件总线与IPC通信的基础契约
 */

// CloudEvents 1.0核心接口 - 必填字段
export interface CeBase {
  id: string; // 事件唯一标识符
  source: string; // 事件源标识（URI格式）
  type: string; // 事件类型（reverse DNS格式）
  specversion: '1.0'; // CloudEvents规范版本（固定1.0）
  time: string; // 事件时间戳（ISO 8601格式）
}

// 完整CloudEvent接口（包含可选字段）
export interface CloudEvent<T = unknown> extends CeBase {
  data?: T; // 事件负载数据
  datacontenttype?: string; // 数据内容类型
  dataschema?: string; // 数据模式URI
  subject?: string; // 事件主题
}

/**
 * CloudEvent构造器 - 自动填充必填字段
 * 基于COPY.md实现，添加类型安全与可选字段支持
 */
export function mkEvent<T = unknown>(
  e: Omit<CeBase, 'id' | 'time' | 'specversion'> & {
    data?: T;
    datacontenttype?: string;
    dataschema?: string;
    subject?: string;
  }
): CloudEvent<T> {
  return {
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    specversion: '1.0',
    ...e,
  };
}

/**
 * CloudEvent验证器 - 运行时类型断言
 * 基于COPY.md实现，确保事件符合CloudEvents 1.0规范
 */
export function assertCe(o: any): asserts o is CeBase {
  const required = ['id', 'source', 'type', 'specversion', 'time'];

  for (const field of required) {
    if (!o?.[field]) {
      throw new Error(`CloudEvent missing required field: ${field}`);
    }
  }

  if (o.specversion !== '1.0') {
    throw new Error(
      `Unsupported CloudEvents specversion: ${o.specversion}, expected '1.0'`
    );
  }

  // 验证时间格式（ISO 8601）
  if (typeof o.time === 'string' && isNaN(Date.parse(o.time))) {
    throw new Error(`Invalid time format: ${o.time}, expected ISO 8601`);
  }

  // 验证source格式（应该是URI）
  if (typeof o.source === 'string' && !isValidUri(o.source)) {
    console.warn(`CloudEvent source should be a valid URI: ${o.source}`);
  }
}

/**
 * URI格式验证辅助函数
 */
function isValidUri(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    // 简单的scheme检查作为fallback
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(str);
  }
}

// 应用级事件类型定义
export type AppEventType =
  | 'app.lifecycle.started'
  | 'app.lifecycle.stopped'
  | 'app.window.created'
  | 'app.window.closed'
  | 'game.scene.loaded'
  | 'game.scene.unloaded'
  | 'guild.member.joined'
  | 'guild.member.left';

// 事件源标识符常量
export const EVENT_SOURCES = {
  APP: 'app://vitegame/lifecycle',
  WINDOW: 'app://vitegame/window',
  GAME: 'app://vitegame/game-engine',
  GUILD: 'app://vitegame/guild-manager',
  IPC: 'ipc://vitegame/main-renderer',
} as const;

// 类型安全的事件工厂函数
export function createAppEvent<T = unknown>(
  type: AppEventType,
  source: keyof typeof EVENT_SOURCES,
  data?: T,
  options?: {
    subject?: string;
    datacontenttype?: string;
  }
): CloudEvent<T> {
  return mkEvent({
    type,
    source: EVENT_SOURCES[source],
    data,
    ...options,
  });
}

// 事件验证与类型保护
export function isCloudEvent(obj: unknown): obj is CloudEvent {
  try {
    assertCe(obj);
    return true;
  } catch {
    return false;
  }
}

// 特定类型事件的类型保护
export function isAppEvent(event: CloudEvent, type: AppEventType): boolean {
  return event.type === type;
}

// 批量事件验证
export function validateEvents(events: unknown[]): CloudEvent[] {
  const validEvents: CloudEvent[] = [];
  const errors: string[] = [];

  events.forEach((event, index) => {
    try {
      assertCe(event);
      validEvents.push(event as CloudEvent);
    } catch (error) {
      errors.push(
        `Event ${index}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  if (errors.length > 0) {
    throw new Error(`Event validation failed:\n${errors.join('\n')}`);
  }

  return validEvents;
}

// 事件序列化与反序列化
export function serializeEvent(event: CloudEvent): string {
  assertCe(event);
  return JSON.stringify(event);
}

export function deserializeEvent<T = unknown>(json: string): CloudEvent<T> {
  const event = JSON.parse(json);
  assertCe(event);
  return event as CloudEvent<T>;
}

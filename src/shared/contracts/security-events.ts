/**
 * 安全事件类型定义
 * 用于Electron主进程和渲染进程之间的安全事件通信
 */

export type SecurityEvent =
  | { type: 'NAV_BLOCKED'; url: string }
  | { type: 'POPUP_BLOCKED'; url: string };

/**
 * 安全事件处理器类型
 */
export type SecurityEventHandler = (event: SecurityEvent) => void;

/**
 * 安全事件发射器接口
 */
export interface SecurityEventEmitter {
  emit(event: SecurityEvent): void;
  on(handler: SecurityEventHandler): void;
  off(handler: SecurityEventHandler): void;
}

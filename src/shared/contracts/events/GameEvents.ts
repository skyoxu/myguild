/**
 * 游戏域事件定义
 * 符合 CLAUDE.md 事件命名规则：${DOMAIN_PREFIX}.<entity>.<action>
 */

import type { GameState } from '../../../ports/game-engine.port';

// 基础事件接口（避免循环依赖）
interface BaseEvent {
  source?: string;
  timestamp?: Date;
  metadata?: {
    id?: string;
    priority?: number;
    persistent?: boolean;
    broadcast?: boolean;
  };
}

export type GameDomainEvent =
  // 游戏生命周期事件
  | ({ type: 'game.engine.initialized'; data: { config: any } } & BaseEvent)
  | ({ type: 'game.engine.started'; data: { timestamp: Date } } & BaseEvent)
  | ({ type: 'game.engine.paused'; data: { timestamp: Date } } & BaseEvent)
  | ({ type: 'game.engine.resumed'; data: { timestamp: Date } } & BaseEvent)
  | ({
      type: 'game.engine.ended';
      data: { result: any; timestamp: Date };
    } & BaseEvent)

  // 游戏状态事件
  | ({
      type: 'game.state.updated';
      data: { gameState: GameState; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.state.changed';
      data: { gameState: GameState; previousState?: GameState };
    } & BaseEvent)
  | ({
      type: 'game.state.synchronized';
      data: { source: string; gameState: GameState };
    } & BaseEvent)

  // 游戏保存事件
  | ({
      type: 'game.save.created';
      data: { saveId: string; gameState: GameState };
    } & BaseEvent)
  | ({
      type: 'game.save.loaded';
      data: { saveId: string; gameState: GameState };
    } & BaseEvent)
  | ({ type: 'game.save.deleted'; data: { saveId: string } } & BaseEvent)
  | ({ type: 'game.autosave.enabled'; data: { interval: number } } & BaseEvent)
  | ({ type: 'game.autosave.disabled'; data: { timestamp: Date } } & BaseEvent)
  | ({
      type: 'game.autosave.completed';
      data: { saveId: string; timestamp: Date };
    } & BaseEvent)

  // 场景事件
  | ({
      type: 'game.scene.created';
      data: { sceneKey: string; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.scene.started';
      data: { sceneKey: string; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.scene.paused';
      data: { sceneKey: string; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.scene.resumed';
      data: { sceneKey: string; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.scene.stopped';
      data: { sceneKey: string; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.scene.transitioned';
      data: { from: string; to: string; timestamp: Date };
    } & BaseEvent)

  // 玩家操作事件
  | ({
      type: 'game.player.moved';
      data: { position: { x: number; y: number }; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.player.leveled';
      data: { level: number; previousLevel: number; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.player.scored';
      data: { score: number; increment: number; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.player.damaged';
      data: { health: number; damage: number; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.player.healed';
      data: { health: number; healing: number; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.level.completed';
      data: {
        level: number;
        result?: {
          score?: number;
          totalMoves?: number;
          duration?: number;
        };
        timestamp: Date;
      };
    } & BaseEvent)

  // 物品事件
  | ({
      type: 'game.inventory.added';
      data: { item: string; quantity: number; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.inventory.removed';
      data: { item: string; quantity: number; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.inventory.used';
      data: { item: string; quantity: number; effect?: string };
    } & BaseEvent)

  // UI交互事件
  | ({
      type: 'game.ui.menu.opened';
      data: { menuType: string; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.ui.menu.closed';
      data: { menuType: string; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.ui.button.clicked';
      data: { buttonId: string; context?: string };
    } & BaseEvent)
  | ({
      type: 'game.ui.notification.shown';
      data: { message: string; type: 'info' | 'warning' | 'error' | 'success' };
    } & BaseEvent)

  // 输入事件
  | ({
      type: 'game.input.keyboard';
      data: { key: string; action: 'keydown' | 'keyup'; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.input.mouse';
      data: {
        button: number;
        action: 'click' | 'down' | 'up';
        position: { x: number; y: number };
      };
    } & BaseEvent)

  // 错误事件
  | ({
      type: 'game.error';
      data: { error: string; context?: string; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.warning';
      data: { warning: string; context?: string; timestamp: Date };
    } & BaseEvent)

  // 性能监控事件
  | ({
      type: 'game.performance.fps';
      data: { fps: number; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'game.performance.memory';
      data: { used: number; total: number; timestamp: Date };
    } & BaseEvent)

  // React <-> Phaser 通信事件
  | ({ type: 'react.command.pause'; data: { timestamp: Date } } & BaseEvent)
  | ({ type: 'react.command.resume'; data: { timestamp: Date } } & BaseEvent)
  | ({
      type: 'react.command.save';
      data: { saveId?: string; timestamp: Date };
    } & BaseEvent)
  | ({
      type: 'react.command.load';
      data: { saveId: string; timestamp: Date };
    } & BaseEvent)
  | ({ type: 'react.command.restart'; data: { timestamp: Date } } & BaseEvent)
  | ({ type: 'phaser.response.ready'; data: { timestamp: Date } } & BaseEvent)
  | ({
      type: 'phaser.response.completed';
      data: { command: string; result?: any; timestamp: Date };
    } & BaseEvent);

export type GameEventType = GameDomainEvent['type'];

export type GameEventHandler<T extends GameDomainEvent = GameDomainEvent> = (
  event: T
) => void | Promise<void>;

// 事件优先级枚举
export enum EventPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

// 事件元数据接口
export interface GameEventMetadata {
  id: string;
  timestamp: Date;
  source: string;
  priority: EventPriority;
  persistent?: boolean; // 是否持久化事件
  broadcast?: boolean; // 是否广播到所有监听器
}

// 完整的游戏事件接口 - 使用交叉类型而非扩展联合类型
export type EnhancedGameEvent = GameDomainEvent & {
  metadata: GameEventMetadata;
};

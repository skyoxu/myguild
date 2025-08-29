/**
 * 游戏域事件定义
 * 符合 CLAUDE.md 事件命名规则：${DOMAIN_PREFIX}.<entity>.<action>
 */

import type { GameState } from '../../../ports/game-engine.port';

export type GameDomainEvent =
  // 游戏生命周期事件
  | { type: 'game.engine.initialized'; data: { config: any } }
  | { type: 'game.engine.started'; data: { timestamp: Date } }
  | { type: 'game.engine.paused'; data: { timestamp: Date } }
  | { type: 'game.engine.resumed'; data: { timestamp: Date } }
  | { type: 'game.engine.ended'; data: { result: any; timestamp: Date } }

  // 游戏状态事件
  | {
      type: 'game.state.updated';
      data: { gameState: GameState; timestamp: Date };
    }
  | {
      type: 'game.state.changed';
      data: { gameState: GameState; previousState?: GameState };
    }
  | {
      type: 'game.state.synchronized';
      data: { source: string; gameState: GameState };
    }

  // 游戏保存事件
  | {
      type: 'game.save.created';
      data: { saveId: string; gameState: GameState };
    }
  | { type: 'game.save.loaded'; data: { saveId: string; gameState: GameState } }
  | { type: 'game.save.deleted'; data: { saveId: string } }
  | { type: 'game.autosave.enabled'; data: { interval: number } }
  | { type: 'game.autosave.disabled'; data: { timestamp: Date } }
  | {
      type: 'game.autosave.completed';
      data: { saveId: string; timestamp: Date };
    }

  // 场景事件
  | { type: 'game.scene.created'; data: { sceneKey: string; timestamp: Date } }
  | { type: 'game.scene.started'; data: { sceneKey: string; timestamp: Date } }
  | { type: 'game.scene.paused'; data: { sceneKey: string; timestamp: Date } }
  | { type: 'game.scene.resumed'; data: { sceneKey: string; timestamp: Date } }
  | { type: 'game.scene.stopped'; data: { sceneKey: string; timestamp: Date } }
  | {
      type: 'game.scene.transitioned';
      data: { from: string; to: string; timestamp: Date };
    }

  // 玩家操作事件
  | {
      type: 'game.player.moved';
      data: { position: { x: number; y: number }; timestamp: Date };
    }
  | {
      type: 'game.player.leveled';
      data: { level: number; previousLevel: number; timestamp: Date };
    }
  | {
      type: 'game.player.scored';
      data: { score: number; increment: number; timestamp: Date };
    }
  | {
      type: 'game.player.damaged';
      data: { health: number; damage: number; timestamp: Date };
    }
  | {
      type: 'game.player.healed';
      data: { health: number; healing: number; timestamp: Date };
    }

  // 物品事件
  | {
      type: 'game.inventory.added';
      data: { item: string; quantity: number; timestamp: Date };
    }
  | {
      type: 'game.inventory.removed';
      data: { item: string; quantity: number; timestamp: Date };
    }
  | {
      type: 'game.inventory.used';
      data: { item: string; quantity: number; effect?: string };
    }

  // UI交互事件
  | { type: 'game.ui.menu.opened'; data: { menuType: string; timestamp: Date } }
  | { type: 'game.ui.menu.closed'; data: { menuType: string; timestamp: Date } }
  | {
      type: 'game.ui.button.clicked';
      data: { buttonId: string; context?: string };
    }
  | {
      type: 'game.ui.notification.shown';
      data: { message: string; type: 'info' | 'warning' | 'error' | 'success' };
    }

  // 输入事件
  | {
      type: 'game.input.keyboard';
      data: { key: string; action: 'keydown' | 'keyup'; timestamp: Date };
    }
  | {
      type: 'game.input.mouse';
      data: {
        button: number;
        action: 'click' | 'down' | 'up';
        position: { x: number; y: number };
      };
    }

  // 错误事件
  | {
      type: 'game.error';
      data: { error: string; context?: string; timestamp: Date };
    }
  | {
      type: 'game.warning';
      data: { warning: string; context?: string; timestamp: Date };
    }

  // 性能监控事件
  | { type: 'game.performance.fps'; data: { fps: number; timestamp: Date } }
  | {
      type: 'game.performance.memory';
      data: { used: number; total: number; timestamp: Date };
    }

  // React <-> Phaser 通信事件
  | { type: 'react.command.pause'; data: { timestamp: Date } }
  | { type: 'react.command.resume'; data: { timestamp: Date } }
  | { type: 'react.command.save'; data: { saveId?: string; timestamp: Date } }
  | { type: 'react.command.load'; data: { saveId: string; timestamp: Date } }
  | { type: 'react.command.restart'; data: { timestamp: Date } }
  | { type: 'phaser.response.ready'; data: { timestamp: Date } }
  | {
      type: 'phaser.response.completed';
      data: { command: string; result?: any; timestamp: Date };
    };

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

// 完整的游戏事件接口
export interface EnhancedGameEvent extends GameDomainEvent {
  metadata: GameEventMetadata;
}

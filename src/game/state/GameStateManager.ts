/**
 * 游戏状态管理器
 * 负责游戏状态的持久化、恢复和同步
 */

import type { GameState, GameConfig } from '../../ports/game-engine.port';
import type { DomainEvent } from '../../shared/contracts/events';

export interface SaveData {
  id: string;
  state: GameState;
  config: GameConfig;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
    checksum: string;
  };
  screenshot?: string;
}

export interface GameStateManagerOptions {
  storageKey?: string;
  maxSaves?: number;
  autoSaveInterval?: number;
  enableCompression?: boolean;
}

export class GameStateManager {
  private options: Required<GameStateManagerOptions>;
  private autoSaveTimer?: NodeJS.Timeout;
  private currentState: GameState | null = null;
  private currentConfig: GameConfig | null = null;
  private eventCallbacks: Set<(event: DomainEvent) => void> = new Set();

  constructor(options: GameStateManagerOptions = {}) {
    this.options = {
      storageKey: 'guild-manager-game',
      maxSaves: 10,
      autoSaveInterval: 30000, // 30秒
      enableCompression: true,
      ...options,
    };
  }

  /**
   * 设置当前游戏状态
   */
  setState(state: GameState, config?: GameConfig): void {
    this.currentState = { ...state };
    if (config) {
      this.currentConfig = { ...config };
    }

    this.publishEvent({
      type: 'game.state.manager.updated',
      source: 'game-state-manager',
      data: { state, config },
      timestamp: new Date(),
      time: new Date().toISOString(),
      id: `state-update-${Date.now()}`,
      specversion: '1.0',
      datacontenttype: 'application/json',
    });
  }

  /**
   * 获取当前游戏状态
   */
  getState(): GameState | null {
    return this.currentState ? { ...this.currentState } : null;
  }

  /**
   * 获取当前游戏配置
   */
  getConfig(): GameConfig | null {
    return this.currentConfig ? { ...this.currentConfig } : null;
  }

  /**
   * 保存游戏状态
   */
  async saveGame(name?: string, screenshot?: string): Promise<string> {
    if (!this.currentState || !this.currentConfig) {
      throw new Error('No game state to save');
    }

    const saveId = `${this.options.storageKey}-${Date.now()}`;
    const saveData: SaveData = {
      id: saveId,
      state: { ...this.currentState },
      config: { ...this.currentConfig },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        checksum: await this.calculateChecksum(this.currentState),
      },
      screenshot,
    };

    try {
      // 保存到本地存储
      await this.saveToBrowser(saveId, saveData);

      // 清理旧存档（保持最大数量限制）
      await this.cleanupOldSaves();

      this.publishEvent({
        type: 'game.save.created',
        source: 'game-state-manager',
        data: { saveId, saveData: { ...saveData, state: undefined } }, // 不包含完整状态
        timestamp: new Date(),
        time: new Date().toISOString(),
        id: `save-${Date.now()}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
      });

      return saveId;
    } catch (error) {
      this.publishEvent({
        type: 'game.save.failed',
        source: 'game-state-manager',
        data: { error: (error as Error).message },
        timestamp: new Date(),
        time: new Date().toISOString(),
        id: `save-error-${Date.now()}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
      });
      throw error;
    }
  }

  /**
   * 加载游戏状态
   */
  async loadGame(
    saveId: string
  ): Promise<{ state: GameState; config: GameConfig }> {
    try {
      const saveData = await this.loadFromBrowser(saveId);

      // 验证存档完整性
      const checksum = await this.calculateChecksum(saveData.state);
      if (checksum !== saveData.metadata.checksum) {
        throw new Error('Save file is corrupted');
      }

      // 更新当前状态
      this.currentState = { ...saveData.state };
      this.currentConfig = { ...saveData.config };

      this.publishEvent({
        type: 'game.save.loaded',
        source: 'game-state-manager',
        data: { saveId, state: this.currentState, config: this.currentConfig },
        timestamp: new Date(),
        time: new Date().toISOString(),
        id: `load-${Date.now()}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
      });

      return {
        state: { ...saveData.state },
        config: { ...saveData.config },
      };
    } catch (error) {
      this.publishEvent({
        type: 'game.save.load_failed',
        source: 'game-state-manager',
        data: { saveId, error: (error as Error).message },
        timestamp: new Date(),
        time: new Date().toISOString(),
        id: `load-error-${Date.now()}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
      });
      throw error;
    }
  }

  /**
   * 获取所有存档列表
   */
  async getSaveList(): Promise<SaveData[]> {
    try {
      const saves: SaveData[] = [];
      const keys = Object.keys(localStorage);

      for (const key of keys) {
        if (key.startsWith(this.options.storageKey)) {
          try {
            const saveData = await this.loadFromBrowser(key);
            saves.push(saveData);
          } catch (error) {
            console.warn(`Failed to load save: ${key}`, error);
          }
        }
      }

      // 按创建时间排序
      saves.sort(
        (a, b) =>
          new Date(b.metadata.createdAt).getTime() -
          new Date(a.metadata.createdAt).getTime()
      );

      return saves;
    } catch (error) {
      console.error('Failed to get save list:', error);
      return [];
    }
  }

  /**
   * 删除存档
   */
  async deleteSave(saveId: string): Promise<void> {
    try {
      localStorage.removeItem(saveId);

      this.publishEvent({
        type: 'game.save.deleted',
        source: 'game-state-manager',
        data: { saveId },
        timestamp: new Date(),
        time: new Date().toISOString(),
        id: `delete-${Date.now()}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
      });
    } catch (error) {
      this.publishEvent({
        type: 'game.save.delete_failed',
        source: 'game-state-manager',
        data: { saveId, error: (error as Error).message },
        timestamp: new Date(),
        time: new Date().toISOString(),
        id: `delete-error-${Date.now()}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
      });
      throw error;
    }
  }

  /**
   * 启用自动保存
   */
  enableAutoSave(): void {
    if (this.autoSaveTimer) {
      return; // 已经启用
    }

    this.autoSaveTimer = setInterval(async () => {
      if (this.currentState && this.currentConfig) {
        try {
          const saveId = await this.saveGame(`auto-save-${Date.now()}`);

          this.publishEvent({
            type: 'game.autosave.completed',
            source: 'game-state-manager',
            data: { saveId },
            timestamp: new Date(),
            time: new Date().toISOString(),
            id: `autosave-${Date.now()}`,
            specversion: '1.0',
            datacontenttype: 'application/json',
          });
        } catch (error) {
          this.publishEvent({
            type: 'game.autosave.failed',
            source: 'game-state-manager',
            data: { error: (error as Error).message },
            timestamp: new Date(),
            time: new Date().toISOString(),
            id: `autosave-error-${Date.now()}`,
            specversion: '1.0',
            datacontenttype: 'application/json',
          });
        }
      }
    }, this.options.autoSaveInterval);

    this.publishEvent({
      type: 'game.autosave.enabled',
      source: 'game-state-manager',
      data: { interval: this.options.autoSaveInterval },
      timestamp: new Date(),
      time: new Date().toISOString(),
      id: `autosave-enable-${Date.now()}`,
      specversion: '1.0',
      datacontenttype: 'application/json',
    });
  }

  /**
   * 禁用自动保存
   */
  disableAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;

      this.publishEvent({
        type: 'game.autosave.disabled',
        source: 'game-state-manager',
        data: {},
        timestamp: new Date(),
        time: new Date().toISOString(),
        id: `autosave-disable-${Date.now()}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
      });
    }
  }

  /**
   * 订阅事件
   */
  onEvent(callback: (event: DomainEvent) => void): void {
    this.eventCallbacks.add(callback);
  }

  /**
   * 取消订阅事件
   */
  offEvent(callback: (event: DomainEvent) => void): void {
    this.eventCallbacks.delete(callback);
  }

  /**
   * 销毁状态管理器
   */
  destroy(): void {
    this.disableAutoSave();
    this.eventCallbacks.clear();
    this.currentState = null;
    this.currentConfig = null;
  }

  /**
   * 保存到浏览器存储
   */
  private async saveToBrowser(key: string, data: SaveData): Promise<void> {
    const serialized = JSON.stringify(data);

    // 检查存储空间
    if (serialized.length > 5 * 1024 * 1024) {
      // 5MB限制
      throw new Error('Save data too large');
    }

    localStorage.setItem(key, serialized);
  }

  /**
   * 从浏览器存储加载
   */
  private async loadFromBrowser(key: string): Promise<SaveData> {
    const serialized = localStorage.getItem(key);
    if (!serialized) {
      throw new Error(`Save not found: ${key}`);
    }

    return JSON.parse(serialized);
  }

  /**
   * 清理旧存档
   */
  private async cleanupOldSaves(): Promise<void> {
    const saves = await this.getSaveList();

    if (saves.length > this.options.maxSaves) {
      const toDelete = saves.slice(this.options.maxSaves);

      for (const save of toDelete) {
        try {
          await this.deleteSave(save.id);
        } catch (error) {
          console.warn(`Failed to delete old save: ${save.id}`, error);
        }
      }
    }
  }

  /**
   * 计算校验和
   */
  private async calculateChecksum(state: GameState): Promise<string> {
    const stateStr = JSON.stringify(state, Object.keys(state).sort());

    // 简单的哈希函数（生产环境应使用更强的哈希算法）
    let hash = 0;
    for (let i = 0; i < stateStr.length; i++) {
      const char = stateStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }

    return hash.toString(16);
  }

  /**
   * 发布事件
   */
  private publishEvent(event: DomainEvent): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in state manager event callback:', error);
      }
    });
  }
}

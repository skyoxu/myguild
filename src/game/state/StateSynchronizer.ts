/**
 * 状态同步器
 * 负责在游戏引擎、场景和React组件之间同步状态
 */

import type { GameState } from '../../ports/game-engine.port';
import type { DomainEvent } from '../../shared/contracts/events';

export interface StateSource {
  id: string;
  getState(): GameState | null;
  setState(state: GameState): void;
}

export interface StateSynchronizerOptions {
  syncInterval?: number;
  conflictResolution?: 'latest' | 'priority' | 'merge';
  enableBidirectionalSync?: boolean;
}

export class StateSynchronizer {
  private sources: Map<string, StateSource> = new Map();
  private priorities: Map<string, number> = new Map();
  private lastStates: Map<string, GameState> = new Map();
  private syncTimer?: NodeJS.Timeout;
  private options: Required<StateSynchronizerOptions>;
  private eventCallbacks: Set<(event: DomainEvent) => void> = new Set();
  private isDestroyed = false;

  constructor(options: StateSynchronizerOptions = {}) {
    this.options = {
      syncInterval: 1000, // 1秒同步一次
      conflictResolution: 'latest',
      enableBidirectionalSync: true,
      ...options,
    };
  }

  /**
   * 注册状态源
   */
  registerSource(source: StateSource, priority: number = 0): void {
    if (this.isDestroyed) return;

    this.sources.set(source.id, source);
    this.priorities.set(source.id, priority);

    // 初始化状态快照
    const currentState = source.getState();
    if (currentState) {
      this.lastStates.set(source.id, { ...currentState });
    }

    this.publishEvent({
      type: 'state.synchronizer.source_registered',
      source: 'state-synchronizer',
      data: { sourceId: source.id, priority },
      timestamp: new Date(),
      time: new Date().toISOString(),
      id: `register-${Date.now()}`,
      specversion: '1.0',
      datacontenttype: 'application/json',
    });
  }

  /**
   * 取消注册状态源
   */
  unregisterSource(sourceId: string): void {
    if (this.isDestroyed) return;

    this.sources.delete(sourceId);
    this.priorities.delete(sourceId);
    this.lastStates.delete(sourceId);

    this.publishEvent({
      type: 'state.synchronizer.source_unregistered',
      source: 'state-synchronizer',
      data: { sourceId },
      timestamp: new Date(),
      time: new Date().toISOString(),
      id: `unregister-${Date.now()}`,
      specversion: '1.0',
      datacontenttype: 'application/json',
    });
  }

  /**
   * 开始同步
   */
  startSync(): void {
    if (this.isDestroyed || this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      this.performSync();
    }, this.options.syncInterval);

    this.publishEvent({
      type: 'state.synchronizer.started',
      source: 'state-synchronizer',
      data: { interval: this.options.syncInterval },
      timestamp: new Date(),
      time: new Date().toISOString(),
      id: `sync-start-${Date.now()}`,
      specversion: '1.0',
      datacontenttype: 'application/json',
    });
  }

  /**
   * 停止同步
   */
  stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;

      this.publishEvent({
        type: 'state.synchronizer.stopped',
        source: 'state-synchronizer',
        data: {},
        timestamp: new Date(),
        time: new Date().toISOString(),
        id: `sync-stop-${Date.now()}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
      });
    }
  }

  /**
   * 手动触发同步
   */
  sync(): void {
    if (this.isDestroyed) return;
    this.performSync();
  }

  /**
   * 强制设置所有源的状态
   */
  forceState(state: GameState, excludeSourceId?: string): void {
    if (this.isDestroyed) return;

    for (const [sourceId, source] of this.sources) {
      if (sourceId !== excludeSourceId) {
        try {
          source.setState(state);
          this.lastStates.set(sourceId, { ...state });
        } catch (error) {
          console.error(`Failed to set state for source ${sourceId}:`, error);
        }
      }
    }

    this.publishEvent({
      type: 'state.synchronizer.forced',
      source: 'state-synchronizer',
      data: { state, excludeSourceId },
      timestamp: new Date(),
      time: new Date().toISOString(),
      id: `force-${Date.now()}`,
      specversion: '1.0',
      datacontenttype: 'application/json',
    });
  }

  /**
   * 获取合并后的状态
   */
  getMergedState(): GameState | null {
    if (this.isDestroyed || this.sources.size === 0) return null;

    const states: Array<{
      sourceId: string;
      state: GameState;
      priority: number;
    }> = [];

    for (const [sourceId, source] of this.sources) {
      const state = source.getState();
      if (state) {
        states.push({
          sourceId,
          state,
          priority: this.priorities.get(sourceId) || 0,
        });
      }
    }

    if (states.length === 0) return null;
    if (states.length === 1) return { ...states[0].state };

    // 根据策略合并状态
    switch (this.options.conflictResolution) {
      case 'priority':
        return this.mergeByPriority(states);
      case 'latest':
        return this.mergeByTimestamp(states);
      case 'merge':
        return this.mergeFields(states);
      default:
        return states[0].state;
    }
  }

  /**
   * 订阅同步事件
   */
  onEvent(callback: (event: DomainEvent) => void): void {
    this.eventCallbacks.add(callback);
  }

  /**
   * 取消订阅同步事件
   */
  offEvent(callback: (event: DomainEvent) => void): void {
    this.eventCallbacks.delete(callback);
  }

  /**
   * 销毁同步器
   */
  destroy(): void {
    this.isDestroyed = true;
    this.stopSync();
    this.sources.clear();
    this.priorities.clear();
    this.lastStates.clear();
    this.eventCallbacks.clear();
  }

  /**
   * 执行同步操作
   */
  private performSync(): void {
    if (this.isDestroyed || this.sources.size === 0) return;

    const changedSources: string[] = [];
    const currentStates: Map<string, GameState> = new Map();

    // 检测状态变化
    for (const [sourceId, source] of this.sources) {
      const currentState = source.getState();
      if (currentState) {
        currentStates.set(sourceId, currentState);

        const lastState = this.lastStates.get(sourceId);
        if (!lastState || this.hasStateChanged(lastState, currentState)) {
          changedSources.push(sourceId);
          this.lastStates.set(sourceId, { ...currentState });
        }
      }
    }

    // 如果有变化，执行同步
    if (changedSources.length > 0) {
      this.synchronizeStates(changedSources, currentStates);
    }
  }

  /**
   * 同步状态到所有源
   */
  private synchronizeStates(
    changedSources: string[],
    currentStates: Map<string, GameState>
  ): void {
    // 确定权威状态
    const authoritativeState = this.determineAuthoritativeState(
      changedSources,
      currentStates
    );

    if (!authoritativeState) return;

    const { sourceId: authSourceId, state: authState } = authoritativeState;

    // 同步到其他源
    let syncedCount = 0;
    for (const [sourceId, source] of this.sources) {
      if (sourceId !== authSourceId && this.options.enableBidirectionalSync) {
        try {
          source.setState(authState);
          this.lastStates.set(sourceId, { ...authState });
          syncedCount++;
        } catch (error) {
          console.error(`Failed to sync state to source ${sourceId}:`, error);
        }
      }
    }

    if (syncedCount > 0) {
      this.publishEvent({
        type: 'state.synchronizer.synced',
        source: 'state-synchronizer',
        data: {
          authoritativeSource: authSourceId,
          syncedSources: Array.from(this.sources.keys()).filter(
            id => id !== authSourceId
          ),
          state: authState,
        },
        timestamp: new Date(),
        time: new Date().toISOString(),
        id: `sync-${Date.now()}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
      });
    }
  }

  /**
   * 确定权威状态
   */
  private determineAuthoritativeState(
    changedSources: string[],
    currentStates: Map<string, GameState>
  ): { sourceId: string; state: GameState } | null {
    const candidates = changedSources.map(sourceId => ({
      sourceId,
      state: currentStates.get(sourceId)!,
      priority: this.priorities.get(sourceId) || 0,
    }));

    switch (this.options.conflictResolution) {
      case 'priority':
        return candidates.reduce((best, current) =>
          current.priority > best.priority ? current : best
        );

      case 'latest':
        return candidates.reduce((best, current) =>
          current.state.timestamp > best.state.timestamp ? current : best
        );

      case 'merge':
        // 对于合并策略，使用优先级最高的作为基础
        const highest = candidates.reduce((best, current) =>
          current.priority > best.priority ? current : best
        );
        return highest;

      default:
        return candidates[0] || null;
    }
  }

  /**
   * 按优先级合并状态
   */
  private mergeByPriority(
    states: Array<{ sourceId: string; state: GameState; priority: number }>
  ): GameState {
    return states.sort((a, b) => b.priority - a.priority)[0].state;
  }

  /**
   * 按时间戳合并状态
   */
  private mergeByTimestamp(
    states: Array<{ sourceId: string; state: GameState; priority: number }>
  ): GameState {
    return states.sort(
      (a, b) => b.state.timestamp.getTime() - a.state.timestamp.getTime()
    )[0].state;
  }

  /**
   * 字段级合并状态
   */
  private mergeFields(
    states: Array<{ sourceId: string; state: GameState; priority: number }>
  ): GameState {
    const baseState = states[0].state;
    const mergedState: GameState = { ...baseState };

    // 为每个字段选择最新的值
    for (const { state } of states) {
      Object.keys(state).forEach(key => {
        const stateKey = key as keyof GameState;
        if (state.timestamp > mergedState.timestamp) {
          (mergedState as any)[stateKey] = state[stateKey];
        }
      });
    }

    return mergedState;
  }

  /**
   * 检查状态是否发生变化
   */
  private hasStateChanged(oldState: GameState, newState: GameState): boolean {
    // 简单的深度比较（生产环境可能需要更高效的比较方法）
    return JSON.stringify(oldState) !== JSON.stringify(newState);
  }

  /**
   * 发布事件
   */
  private publishEvent(event: DomainEvent): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in synchronizer event callback:', error);
      }
    });
  }
}

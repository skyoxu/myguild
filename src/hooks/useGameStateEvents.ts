/**
 * 游戏状态事件集成Hook
 * 结合useGameEvents和useGameState，提供完整的事件与状态管理集成
 */

import { useCallback, useEffect, useRef } from 'react';
import { useGameEvents } from './useGameEvents';
import { useGameState } from '../contexts/GameStateContext';
import type { GameState } from '../ports/game-engine.port';
import type { GameDomainEvent } from '../shared/contracts/events/GameEvents';

export interface UseGameStateEventsOptions {
  context?: string;
  autoSync?: boolean; // 自动同步EventBus事件到State
  enableAutoSave?: boolean; // 启用自动保存
  syncInterval?: number; // 状态同步间隔（毫秒）
}

export function useGameStateEvents(options: UseGameStateEventsOptions = {}) {
  const {
    context = 'game-state-events',
    autoSync = true,
    enableAutoSave = false,
    syncInterval = 1000,
  } = options;

  const gameEvents = useGameEvents({ context });
  const {
    gameState,
    updateGameState,
    saveGame,
    loadGame,
    enableAutoSave: enableContextAutoSave,
    disableAutoSave: disableContextAutoSave,
    syncStates,
  } = useGameState();

  const lastSyncTime = useRef<number>(Date.now());
  const autoSaveEnabled = useRef<boolean>(enableAutoSave);

  // 自动启用/禁用自动保存
  useEffect(() => {
    if (enableAutoSave && !autoSaveEnabled.current) {
      enableContextAutoSave();
      autoSaveEnabled.current = true;
    } else if (!enableAutoSave && autoSaveEnabled.current) {
      disableContextAutoSave();
      autoSaveEnabled.current = false;
    }
  }, [enableAutoSave, enableContextAutoSave, disableContextAutoSave]);

  // 监听Phaser的状态更新事件并同步到Context
  useEffect(() => {
    if (!autoSync) return;

    const subscriptions = gameEvents.onGameStateChange(event => {
      const { gameState: newState } = event.data;
      const now = Date.now();

      // 节流同步，避免过于频繁的更新
      if (now - lastSyncTime.current >= syncInterval) {
        updateGameState(newState);
        lastSyncTime.current = now;
      }
    });

    return () => {
      subscriptions.forEach(subId => gameEvents.unsubscribe(subId));
    };
  }, [gameEvents, updateGameState, autoSync, syncInterval]);

  // 监听Context状态变化并同步到其他状态源
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      syncStates();
    }, 100); // 短延迟防抖

    return () => clearTimeout(timeoutId);
  }, [gameState, syncStates]);

  // 增强的命令发送方法，同时更新Context状态
  const sendCommandWithStateUpdate = useCallback(
    async (
      command: 'pause' | 'resume' | 'save' | 'load' | 'restart',
      data?: any
    ): Promise<void> => {
      try {
        switch (command) {
          case 'save':
            // 先保存Context状态，再通知Phaser
            const saveId = await saveGame();
            if (saveId) {
              gameEvents.sendCommandToPhaser('save', { saveId });
            }
            break;

          case 'load':
            // 先从Context加载，再通知Phaser
            if (data?.saveId) {
              const success = await loadGame(data.saveId);
              if (success) {
                gameEvents.sendCommandToPhaser('load', data);
              }
            }
            break;

          default:
            // 其他命令直接转发
            gameEvents.sendCommandToPhaser(command, data);
            break;
        }
      } catch (error) {
        console.error(`Failed to execute command ${command}:`, error);
        gameEvents.publish({
          type: 'game.error',
          data: {
            error: (error as Error).message,
            context: `command-${command}`,
            timestamp: new Date(),
          },
        });
      }
    },
    [gameEvents, saveGame, loadGame]
  );

  // 智能状态更新：合并本地更新和远程更新
  const smartUpdateGameState = useCallback(
    (
      stateUpdates: Partial<GameState>,
      source: 'local' | 'remote' = 'local'
    ): void => {
      if (!gameState) return;

      const updatedState: GameState = {
        ...gameState,
        ...stateUpdates,
        timestamp: new Date(),
      };

      // 本地更新：直接更新Context并发布事件
      if (source === 'local') {
        updateGameState(updatedState);

        // 发布状态更新事件
        gameEvents.publish({
          type: 'game.state.updated',
          data: { gameState: updatedState, timestamp: new Date() },
        });
      }
      // 远程更新：仅更新Context（避免循环）
      else {
        updateGameState(updatedState);
      }
    },
    [gameState, updateGameState, gameEvents]
  );

  // 批量状态更新
  const batchUpdateGameState = useCallback(
    (updates: Array<{ path: keyof GameState; value: any }>): void => {
      if (!gameState) return;

      const newState = { ...gameState };
      updates.forEach(({ path, value }) => {
        (newState as any)[path] = value;
      });

      newState.timestamp = new Date();
      updateGameState(newState);
    },
    [gameState, updateGameState]
  );

  // 游戏状态快照
  const createStateSnapshot = useCallback((): GameState | null => {
    return gameState ? { ...gameState } : null;
  }, [gameState]);

  // 恢复状态快照
  const restoreStateSnapshot = useCallback(
    (snapshot: GameState): void => {
      updateGameState(snapshot);
      syncStates();
    },
    [updateGameState, syncStates]
  );

  return {
    // 基础事件系统
    ...gameEvents,

    // 当前状态
    gameState,

    // 增强的命令系统
    sendCommand: sendCommandWithStateUpdate,
    sendCommandToPhaser: gameEvents.sendCommandToPhaser,

    // 智能状态更新
    updateState: smartUpdateGameState,
    batchUpdateState: batchUpdateGameState,

    // 状态快照
    createSnapshot: createStateSnapshot,
    restoreSnapshot: restoreStateSnapshot,

    // 状态管理
    saveGame,
    loadGame,
    syncStates,

    // 实用工具
    isStateReady: !!gameState,
    lastSyncTime: lastSyncTime.current,
  };
}

/**
 * 游戏状态变化监听Hook
 * 专门用于监听和响应游戏状态的特定变化
 */
export function useGameStateWatcher<T extends keyof GameState>(
  field: T,
  callback: (
    newValue: GameState[T],
    oldValue: GameState[T],
    fullState: GameState
  ) => void,
  dependencies: any[] = []
) {
  const { gameState } = useGameState();
  const lastValueRef = useRef<GameState[T] | undefined>(
    gameState ? gameState[field] : undefined
  );

  useEffect(() => {
    if (!gameState) return;

    const currentValue = gameState[field];
    const lastValue = lastValueRef.current;

    if (lastValue !== undefined && currentValue !== lastValue) {
      callback(currentValue, lastValue, gameState);
    }

    lastValueRef.current = currentValue;
  }, [gameState, field, callback, ...dependencies]);
}

/**
 * 游戏状态性能监控Hook
 */
export function useGameStatePerformance() {
  const { gameState } = useGameState();
  const metricsRef = useRef({
    updateCount: 0,
    lastUpdate: Date.now(),
    averageUpdateInterval: 0,
  });

  useEffect(() => {
    if (!gameState) return;

    const now = Date.now();
    const metrics = metricsRef.current;

    metrics.updateCount++;
    const interval = now - metrics.lastUpdate;
    metrics.averageUpdateInterval =
      (metrics.averageUpdateInterval + interval) /
      Math.min(metrics.updateCount, 100);
    metrics.lastUpdate = now;
  }, [gameState]);

  return {
    updateCount: metricsRef.current.updateCount,
    averageUpdateInterval: metricsRef.current.averageUpdateInterval,
    lastUpdate: metricsRef.current.lastUpdate,
  };
}

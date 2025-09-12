/**
 * 游戏状态上下文
 * 提供React组件与游戏状态管理系统的直接集成
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import type { ReactNode } from 'react';
import type { GameState, GameConfig } from '../ports/game-engine.port';
import type { SaveData } from '../game/state/GameStateManager';
import { GameStateManager } from '../game/state/GameStateManager';
import {
  StateSynchronizer,
  type StateSource,
} from '../game/state/StateSynchronizer';
import type { DomainEvent } from '../shared/contracts/events';
import { useGameEvents } from '../hooks/useGameEvents';

export interface GameStateContextValue {
  // 当前游戏状态
  gameState: GameState | null;
  gameConfig: GameConfig | null;

  // 存档管理
  saveFiles: SaveData[];
  isLoadingSaves: boolean;

  // 状态管理操作
  saveGame: () => Promise<string | null>;
  loadGame: (saveId: string) => Promise<boolean>;
  deleteSave: (saveId: string) => Promise<boolean>;
  refreshSaveList: () => Promise<void>;

  // 状态更新
  updateGameState: (newState: Partial<GameState>) => void;
  resetGameState: () => void;

  // 自动保存控制
  enableAutoSave: () => void;
  disableAutoSave: () => void;
  isAutoSaveEnabled: boolean;

  // 状态同步控制
  registerStateSource: (source: StateSource, priority?: number) => void;
  unregisterStateSource: (sourceId: string) => void;
  syncStates: () => void;
}

const GameStateContext = createContext<GameStateContextValue | undefined>(
  undefined
);

export interface GameStateProviderProps {
  children: ReactNode;
  stateManagerOptions?: {
    storageKey?: string;
    maxSaves?: number;
    autoSaveInterval?: number;
    enableCompression?: boolean;
  };
  synchronizerOptions?: {
    syncInterval?: number;
    conflictResolution?: 'latest' | 'priority' | 'merge';
    enableBidirectionalSync?: boolean;
  };
}

export function GameStateProvider({
  children,
  stateManagerOptions = {},
  synchronizerOptions = {},
}: GameStateProviderProps) {
  // 状态管理器和同步器实例
  const [stateManager] = useState(
    () =>
      new GameStateManager({
        storageKey: 'guild-manager-game',
        maxSaves: 20,
        autoSaveInterval: 30000,
        enableCompression: true,
        ...stateManagerOptions,
      })
  );

  const [stateSynchronizer] = useState(
    () =>
      new StateSynchronizer({
        syncInterval: 500, // 更高频率同步以确保React UI响应性
        conflictResolution: 'priority',
        enableBidirectionalSync: true,
        ...synchronizerOptions,
      })
  );

  // React状态
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [saveFiles, setSaveFiles] = useState<SaveData[]>([]);
  const [isLoadingSaves, setIsLoadingSaves] = useState(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(false);

  // EventBus集成
  const gameEvents = useGameEvents({ context: 'game-state-context' });

  // React状态源实现
  const reactStateSource = useMemo<StateSource>(
    () => ({
      id: 'react-ui',
      getState: () => gameState,
      setState: (state: GameState) => {
        setGameState({ ...state });
        setGameConfig(stateManager.getConfig() || null);
      },
    }),
    [gameState, stateManager]
  );

  // 监听状态管理器事件
  useEffect(() => {
    const handleStateManagerEvent = (event: DomainEvent) => {
      switch (event.type) {
        case 'game.state.updated':
          if (
            event.data &&
            typeof event.data === 'object' &&
            'gameState' in event.data &&
            typeof event.data.gameState === 'object' &&
            event.data.gameState !== null
          ) {
            setGameState({ ...(event.data.gameState as GameState) });
          }
          break;

        case 'game.save.created':
        case 'game.save.loaded':
        case 'game.save.deleted':
          // 刷新存档列表
          refreshSaveList();
          break;

        case 'game.autosave.enabled':
          setIsAutoSaveEnabled(true);
          break;

        case 'game.autosave.disabled':
          setIsAutoSaveEnabled(false);
          break;
      }
    };

    stateManager.onEvent(handleStateManagerEvent);
    stateSynchronizer.onEvent(handleStateManagerEvent);

    return () => {
      stateManager.offEvent(handleStateManagerEvent);
      stateSynchronizer.offEvent(handleStateManagerEvent);
    };
  }, [stateManager, stateSynchronizer]);

  // 监听游戏引擎状态更新
  useEffect(() => {
    const subscriptions = gameEvents.onGameStateChange(event => {
      const { gameState: updatedState } = event.data;
      stateManager.setState(updatedState);
    });

    return () => {
      subscriptions.forEach(subId => gameEvents.unsubscribe(subId));
    };
  }, [gameEvents, stateManager]);

  // 注册React作为状态源
  useEffect(() => {
    stateSynchronizer.registerSource(reactStateSource, 5); // 中等优先级
    stateSynchronizer.startSync();

    return () => {
      stateSynchronizer.unregisterSource('react-ui');
      stateSynchronizer.stopSync();
    };
  }, [stateSynchronizer, reactStateSource]);

  // 保存游戏
  const saveGame = useCallback(async (): Promise<string | null> => {
    try {
      if (!gameState || !gameConfig) {
        console.warn('No game state or config to save');
        return null;
      }

      stateManager.setState(gameState, gameConfig);
      const saveId = await stateManager.saveGame();

      // 通过EventBus通知其他组件
      gameEvents.publish({
        type: 'game.save.created',
        data: { saveId, gameState },
        source: '/vitegame/game-engine',
        timestamp: new Date(),
      });

      return saveId;
    } catch (error) {
      console.error('Failed to save game:', error);
      gameEvents.publish({
        type: 'game.error',
        data: {
          error: (error as Error).message,
          context: 'context-save',
          timestamp: new Date(),
        },
        source: '/vitegame/game-engine',
        timestamp: new Date(),
      });
      return null;
    }
  }, [gameState, gameConfig, stateManager, gameEvents]);

  // 加载游戏
  const loadGame = useCallback(
    async (saveId: string): Promise<boolean> => {
      try {
        const { state, config: _config } = await stateManager.loadGame(saveId);

        // 强制同步到所有状态源
        stateSynchronizer.forceState(state);

        // 通过EventBus通知游戏引擎
        gameEvents.sendCommandToPhaser('load', { saveId });

        return true;
      } catch (error) {
        console.error('Failed to load game:', error);
        gameEvents.publish({
          type: 'game.error',
          data: {
            error: (error as Error).message,
            context: 'context-load',
            timestamp: new Date(),
          },
          source: '/vitegame/game-engine',
          timestamp: new Date(),
        });
        return false;
      }
    },
    [stateManager, stateSynchronizer, gameEvents]
  );

  // 删除存档
  const deleteSave = useCallback(
    async (saveId: string): Promise<boolean> => {
      try {
        await stateManager.deleteSave(saveId);
        return true;
      } catch (error) {
        console.error('Failed to delete save:', error);
        return false;
      }
    },
    [stateManager]
  );

  // 刷新存档列表
  const refreshSaveList = useCallback(async (): Promise<void> => {
    try {
      setIsLoadingSaves(true);
      const saves = await stateManager.getSaveList();
      setSaveFiles(saves);
    } catch (error) {
      console.error('Failed to refresh save list:', error);
      setSaveFiles([]);
    } finally {
      setIsLoadingSaves(false);
    }
  }, [stateManager]);

  // 更新游戏状态
  const updateGameState = useCallback(
    (newState: Partial<GameState>): void => {
      if (!gameState) return;

      const updatedState: GameState = {
        ...gameState,
        ...newState,
        timestamp: new Date(),
      };

      setGameState(updatedState);
      stateManager.setState(updatedState, gameConfig || undefined);
    },
    [gameState, gameConfig, stateManager]
  );

  // 重置游戏状态
  const resetGameState = useCallback((): void => {
    const initialState: GameState = {
      id: `game-${Date.now()}`,
      level: 1,
      score: 0,
      health: 100,
      inventory: [],
      position: { x: 400, y: 300 },
      timestamp: new Date(),
    };

    setGameState(initialState);
    stateManager.setState(initialState, gameConfig || undefined);
    stateSynchronizer.forceState(initialState);
  }, [gameConfig, stateManager, stateSynchronizer]);

  // 启用自动保存
  const enableAutoSave = useCallback((): void => {
    stateManager.enableAutoSave();
  }, [stateManager]);

  // 禁用自动保存
  const disableAutoSave = useCallback((): void => {
    stateManager.disableAutoSave();
  }, [stateManager]);

  // 注册状态源
  const registerStateSource = useCallback(
    (source: StateSource, priority: number = 0): void => {
      stateSynchronizer.registerSource(source, priority);
    },
    [stateSynchronizer]
  );

  // 取消注册状态源
  const unregisterStateSource = useCallback(
    (sourceId: string): void => {
      stateSynchronizer.unregisterSource(sourceId);
    },
    [stateSynchronizer]
  );

  // 手动同步状态
  const syncStates = useCallback((): void => {
    stateSynchronizer.sync();
  }, [stateSynchronizer]);

  // 初始化存档列表
  useEffect(() => {
    refreshSaveList();
  }, [refreshSaveList]);

  // 清理资源
  useEffect(() => {
    return () => {
      stateManager.destroy();
      stateSynchronizer.destroy();
    };
  }, [stateManager, stateSynchronizer]);

  const contextValue: GameStateContextValue = {
    gameState,
    gameConfig,
    saveFiles,
    isLoadingSaves,
    saveGame,
    loadGame,
    deleteSave,
    refreshSaveList,
    updateGameState,
    resetGameState,
    enableAutoSave,
    disableAutoSave,
    isAutoSaveEnabled,
    registerStateSource,
    unregisterStateSource,
    syncStates,
  };

  return (
    <GameStateContext.Provider value={contextValue}>
      {children}
    </GameStateContext.Provider>
  );
}

/**
 * 使用游戏状态上下文的Hook
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useGameState(): GameStateContextValue {
  const context = useContext(GameStateContext);
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
}

/**
 * 可选：专门用于存档管理的Hook
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSaveManager() {
  const {
    saveFiles,
    isLoadingSaves,
    saveGame,
    loadGame,
    deleteSave,
    refreshSaveList,
  } = useGameState();

  return {
    saveFiles,
    isLoadingSaves,
    saveGame,
    loadGame,
    deleteSave,
    refreshSaveList,
  };
}

/**
 * 可选：专门用于状态同步的Hook
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useStateSynchronizer() {
  const { registerStateSource, unregisterStateSource, syncStates, gameState } =
    useGameState();

  return {
    registerStateSource,
    unregisterStateSource,
    syncStates,
    currentState: gameState,
  };
}

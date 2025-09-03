/**
 * Phaser游戏画布组件 - 使用新的游戏引擎架构
 * 符合 CLAUDE.md 技术栈要求：Phaser 3 WebGL渲染 & 场景管理
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { GameEngineAdapter } from '../game/GameEngineAdapter';
import type { GameState, GameConfig } from '../ports/game-engine.port';
import type { DomainEvent } from '../shared/contracts/events';
import type { GameDomainEvent } from '../shared/contracts/events/GameEvents';
import { useGameEvents } from '../hooks/useGameEvents';

interface GameCanvasProps {
  width?: number;
  height?: number;
  className?: string;
  onGameEvent?: (event: DomainEvent) => void;
  onGameStateChange?: (state: GameState) => void;
  autoStart?: boolean;
}

export function GameCanvas({
  width = 800,
  height = 600,
  className = '',
  onGameEvent,
  onGameStateChange,
  autoStart = true,
}: GameCanvasProps) {
  const gameEngineRef = useRef<GameEngineAdapter | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 使用EventBus进行React-Phaser通信
  const gameEvents = useGameEvents({
    context: 'game-canvas',
    enableAutoCleanup: true,
  });

  // 处理游戏事件
  const handleGameEvent = useCallback(
    (event: DomainEvent) => {
      console.log('Game Event:', event);

      // 只处理游戏域事件
      if (!event.type.startsWith('game.') && !event.type.startsWith('phaser.') && !event.type.startsWith('react.')) {
        return;
      }

      const gameEvent = event as unknown as GameDomainEvent;

      // 更新游戏状态
      if (
        gameEvent.type === 'game.state.updated' ||
        gameEvent.type === 'game.state.changed'
      ) {
        const { gameState: newState } = gameEvent.data.gameState 
          ? { gameState: gameEvent.data.gameState }
          : gameEvent.data as { gameState: GameState };
        setGameState(newState);
        onGameStateChange?.(newState);
      }

      // 处理错误事件
      if (gameEvent.type === 'game.error' && gameEvent.data && 'error' in gameEvent.data) {
        setError((gameEvent.data as any).error);
      } else if (gameEvent.type === 'game.warning' && gameEvent.data && 'warning' in gameEvent.data) {
        console.warn('Game warning:', (gameEvent.data as any).warning);
      }

      // 转发事件给父组件
      onGameEvent?.(event);
    },
    [onGameEvent, onGameStateChange]
  );

  // 初始化游戏引擎
  useEffect(() => {
    if (!canvasRef.current) return;

    const initGame = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 创建游戏引擎实例
        const gameEngine = new GameEngineAdapter();
        gameEngineRef.current = gameEngine;

        // 设置游戏容器
        gameEngine.setContainer(canvasRef.current!);

        // 订阅游戏事件
        gameEngine.onGameEvent(handleGameEvent);

        // 初始化游戏配置
        const gameConfig: GameConfig = {
          maxLevel: 50,
          initialHealth: 100,
          scoreMultiplier: 1.0,
          autoSave: true,
          difficulty: 'medium',
        };

        // 初始化游戏
        const initialState = await gameEngine.initializeGame(gameConfig);
        setGameState(initialState);

        // 自动开始游戏
        if (autoStart) {
          await gameEngine.startGame();
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize game:', error);
        setError((error as Error).message);
        setIsLoading(false);
      }
    };

    initGame();

    // 清理函数
    return () => {
      if (gameEngineRef.current) {
        gameEngineRef.current.destroy();
        gameEngineRef.current = null;
      }
    };
  }, [width, height, autoStart, handleGameEvent]);

  // 使用EventBus监听游戏状态变化
  useEffect(() => {
    const subscriptions = gameEvents.onGameStateChange(event => {
      console.log('Game state changed via EventBus:', event);
      setGameState(event.data.gameState);
      onGameStateChange?.(event.data.gameState);
    });

    return () => {
      subscriptions.forEach(subId => gameEvents.unsubscribe(subId));
    };
  }, [gameEvents, onGameStateChange]);

  // 监听游戏错误事件
  useEffect(() => {
    const subscriptions = gameEvents.onGameError(event => {
      console.error('Game error via EventBus:', event);
      setError(event.data.error);
    });

    return () => {
      subscriptions.forEach(subId => gameEvents.unsubscribe(subId));
    };
  }, [gameEvents]);

  // 监听Phaser响应
  useEffect(() => {
    const subscriptions = gameEvents.onPhaserResponse(event => {
      console.log('Phaser response:', event);
      if (event.type === 'phaser.response.ready') {
        console.log('Phaser engine is ready');
      }
    });

    return () => {
      subscriptions.forEach(subId => gameEvents.unsubscribe(subId));
    };
  }, [gameEvents]);

  // 游戏控制函数 - 现在使用EventBus命令
  const pauseGame = useCallback(() => {
    gameEvents.sendCommandToPhaser('pause');
  }, [gameEvents]);

  const resumeGame = useCallback(() => {
    gameEvents.sendCommandToPhaser('resume');
  }, [gameEvents]);

  const saveGame = useCallback(() => {
    gameEvents.sendCommandToPhaser('save');
  }, [gameEvents]);

  const loadGame = useCallback(
    (saveId: string) => {
      gameEvents.sendCommandToPhaser('load', { saveId });
    },
    [gameEvents]
  );

  const restartGame = useCallback(() => {
    gameEvents.sendCommandToPhaser('restart');
  }, [gameEvents]);

  // 渲染加载状态
  if (isLoading) {
    return (
      <div
        className={`game-canvas loading ${className}`}
        style={{
          width,
          height,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          border: '2px solid #3182ce',
          borderRadius: '8px',
          backgroundColor: '#1a202c',
        }}
      >
        <div style={{ color: '#ffffff', fontSize: '18px' }}>
          正在加载游戏引擎...
        </div>
      </div>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <div
        className={`game-canvas error ${className}`}
        style={{
          width,
          height,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          border: '2px solid #ef4444',
          borderRadius: '8px',
          backgroundColor: '#1a202c',
          padding: '20px',
        }}
      >
        <div
          style={{ color: '#ef4444', fontSize: '18px', marginBottom: '10px' }}
        >
          游戏引擎初始化失败
        </div>
        <div
          style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`game-canvas ${className}`}
      style={{
        position: 'relative',
        border: '2px solid #3182ce',
        borderRadius: '8px',
        padding: '10px',
        backgroundColor: '#1a202c',
      }}
    >
      <div
        ref={canvasRef}
        style={{
          width,
          height,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />

      {/* 游戏状态显示（可选） */}
      {gameState && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#ffffff',
            padding: '10px',
            borderRadius: '5px',
            fontSize: '12px',
            minWidth: '150px',
          }}
        >
          <div>分数: {gameState.score}</div>
          <div>等级: {gameState.level}</div>
          <div>生命值: {gameState.health}</div>
        </div>
      )}

      {/* 游戏控制按钮（开发时可见） */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          display: 'flex',
          gap: '10px',
        }}
      >
        <button
          onClick={pauseGame}
          style={{
            padding: '5px 10px',
            backgroundColor: '#3182ce',
            color: '#ffffff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          暂停
        </button>
        <button
          onClick={resumeGame}
          style={{
            padding: '5px 10px',
            backgroundColor: '#059669',
            color: '#ffffff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          继续
        </button>
        <button
          onClick={saveGame}
          style={{
            padding: '5px 10px',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          保存
        </button>
        <button
          onClick={restartGame}
          style={{
            padding: '5px 10px',
            backgroundColor: '#f59e0b',
            color: '#ffffff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          重启
        </button>
      </div>
    </div>
  );
}

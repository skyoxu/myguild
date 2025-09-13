/**
 * Phaser游戏画布组件 - 使用新的游戏引擎架构
 * 符合 CLAUDE.md 技术栈要求：Phaser 3 WebGL渲染 & 场景管理
 */

import { useRef, useEffect, useState, useCallback, useTransition } from 'react';
import { GameEngineAdapter } from '../game/GameEngineAdapter';
import type { GameState, GameConfig } from '../ports/game-engine.port';
import type { DomainEvent } from '../shared/contracts/events';
import type { GameDomainEvent } from '../shared/contracts/events/GameEvents';
import { useGameEvents } from '../hooks/useGameEvents';
import { createComputationWorker } from '@/shared/workers/workerBridge';
import './GameCanvas.css';
import { scheduleNonBlocking } from '@/shared/performance/idle';
import { startTransaction } from '@/shared/observability/sentry-perf';

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
  const [isPending, startTransition] = useTransition();
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [interactionDone, setInteractionDone] = useState(false);

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
      if (
        !event.type.startsWith('game.') &&
        !event.type.startsWith('phaser.') &&
        !event.type.startsWith('react.')
      ) {
        return;
      }

      const gameEvent = event as unknown as GameDomainEvent;

      // 更新游戏状态（使用并发更新降级避免阻塞交互）
      if (
        gameEvent.type === 'game.state.updated' ||
        gameEvent.type === 'game.state.changed'
      ) {
        const { gameState: newState } = gameEvent.data.gameState
          ? { gameState: gameEvent.data.gameState }
          : (gameEvent.data as { gameState: GameState });
        startTransition(() => {
          setGameState(newState);
          onGameStateChange?.(newState);
        });
      }

      // 处理错误事件
      if (
        gameEvent.type === 'game.error' &&
        gameEvent.data &&
        'error' in gameEvent.data
      ) {
        setError((gameEvent.data as any).error);
      } else if (
        gameEvent.type === 'game.warning' &&
        gameEvent.data &&
        'warning' in gameEvent.data
      ) {
        // 非关键日志放入空闲帧，避免阻塞交互
        scheduleNonBlocking(() => {
          console.warn('Game warning:', (gameEvent.data as any).warning);
        });
      }

      // 转发事件给父组件（非关键路径亦延后）
      if (onGameEvent) {
        scheduleNonBlocking(() => onGameEvent(event));
      }
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
      if (event.type === 'game.error' && 'error' in event.data) {
        setError(event.data.error);
      } else if (event.type === 'game.warning' && 'warning' in event.data) {
        setError(event.data.warning);
      }
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
        style={{ width, height }}
      >
        <div className="game-canvas__loading-text">正在加载游戏引擎...</div>
      </div>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <div
        className={`game-canvas error ${className}`}
        style={{ width, height }}
      >
        <div className="game-canvas__error-title">游戏引擎初始化失败</div>
        <div className="game-canvas__error-details">{error}</div>
      </div>
    );
  }

  return (
    <div className={`game-canvas ${className}`}>
      <div
        ref={canvasRef}
        className="game-canvas__content"
        style={{ width, height }}
      />

      {/* 游戏状态显示（可选） */}
      {gameState && (
        <div className="game-canvas__status-panel">
          <div>分数: {gameState.score}</div>
          <div>等级: {gameState.level}</div>
          <div>生命值: {gameState.health}</div>
        </div>
      )}

      {/* 游戏控制按钮（开发时可见） */}
      <div className="game-canvas__controls">
        <button
          onClick={pauseGame}
          className="game-canvas__control-btn game-canvas__control-btn--pause"
        >
          暂停
        </button>
        <button
          onClick={resumeGame}
          className="game-canvas__control-btn game-canvas__control-btn--resume"
        >
          继续
        </button>
        <button
          onClick={saveGame}
          className="game-canvas__control-btn game-canvas__control-btn--save"
        >
          保存
        </button>
        <button
          onClick={restartGame}
          className="game-canvas__control-btn game-canvas__control-btn--restart"
        >
          重启
        </button>
        <button
          data-testid="test-button"
          disabled={interactionLoading}
          onClick={async () => {
            try {
              setInteractionLoading(true);
              const txn = await startTransaction(
                'interaction:test_button',
                'ui.action'
              );
              if (typeof performance !== 'undefined' && performance.mark) {
                performance.mark('test_button_click_start');
              }
              await new Promise(r =>
                requestAnimationFrame(() => requestAnimationFrame(r))
              );
              const { heavyTask, terminate } = createComputationWorker();
              await heavyTask(5_000_000);
              terminate();
              setInteractionDone(true);
              if (
                typeof performance !== 'undefined' &&
                performance.mark &&
                performance.measure
              ) {
                performance.mark('response_indicator_visible');
                performance.measure(
                  'test_button_latency',
                  'test_button_click_start',
                  'response_indicator_visible'
                );
              }
              txn.finish();
            } catch (e) {
              console.error('worker heavyTask failed', e);
            } finally {
              setInteractionLoading(false);
              setTimeout(() => setInteractionDone(false), 60);
            }
          }}
          className="game-canvas__control-btn game-canvas__control-btn--test"
        >
          {interactionLoading ? '处理中…' : '测试交互(Worker)'}
        </button>
      </div>

      {interactionDone && (
        <div
          data-testid="response-indicator"
          aria-live="polite"
          style={{ position: 'absolute', top: -9999, left: -9999 }}
        >
          done
        </div>
      )}
    </div>
  );
}

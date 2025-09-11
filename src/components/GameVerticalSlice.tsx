/**
 * 游戏竖切组件 - 端到端验证组件
 * 整合 React UI → Phaser TestScene → 事件处理 → 数据持久化 → 可观测性
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { GameEngineAdapter } from '../game/GameEngineAdapter';
import type { GameConfig } from '../ports/game-engine.port';
import type { DomainEvent } from '../shared/contracts/events';
import type { GameDomainEvent } from '../shared/contracts/events/GameEvents';
import { useGameEvents } from '../hooks/useGameEvents';
import { useWebVitals } from '../hooks/useWebVitals';

interface VerticalSliceState {
  phase: 'ready' | 'initializing' | 'playing' | 'completed' | 'error';
  testStartTime?: Date;
  testEndTime?: Date;
  levelResult?: any;
  totalMoves?: number;
  score?: number;
  error?: string;
  events: GameDomainEvent[];
}

interface GameVerticalSliceProps {
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  className?: string;
  autoStart?: boolean;
}

export function GameVerticalSlice({
  onComplete,
  onError,
  className = '',
  autoStart = false,
}: GameVerticalSliceProps) {
  const gameEngineRef = useRef<GameEngineAdapter | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [sliceState, setSliceState] = useState<VerticalSliceState>({
    phase: 'ready',
    events: [],
  });

  // Web Vitals监控 - 测试性能指标
  const webVitals = useWebVitals({
    enabled: true,
    componentName: 'GameVerticalSlice',
    trackRender: true,
    trackInteractions: true,
    collectorConfig: {
      enabled: true,
      sentryEnabled: true,
      batchSize: 3,
      flushInterval: 5000, // 5秒快速上报用于测试
    },
  });

  // 游戏事件系统
  const gameEvents = useGameEvents({
    context: 'vertical-slice',
    enableAutoCleanup: true,
  });

  /**
   * 处理游戏事件 - 竖切的核心事件流
   */
  const handleGameEvent = useCallback(
    (event: DomainEvent) => {
      console.log('🎮 Vertical Slice Event:', event);

      // 只处理游戏域事件
      if (!event.type.startsWith('game.')) {
        return;
      }

      const gameEvent = event as unknown as GameDomainEvent;

      // 记录所有事件用于调试和验证
      setSliceState(prev => ({
        ...prev,
        events: [...prev.events, gameEvent],
      }));

      // 处理关键事件
      switch (gameEvent.type) {
        case 'game.scene.created':
          if (gameEvent.data.sceneKey === 'TestScene') {
            console.log('✅ TestScene创建成功');
            webVitals.recordCustomEvent('test_scene_created');
          }
          break;

        case 'game.player.moved':
          // 追踪玩家移动
          setSliceState(prev => ({
            ...prev,
            totalMoves: (prev.totalMoves || 0) + 1,
          }));
          break;

        case 'game.level.completed':
          // 关键事件：关卡完成
          console.log('🎉 Level Completed!', gameEvent.data);
          webVitals.recordCustomEvent('level_completed', {
            score: gameEvent.data.result?.score,
            moves: gameEvent.data.result?.totalMoves,
            duration: gameEvent.data.result?.duration,
          });

          setSliceState(prev => ({
            ...prev,
            phase: 'completed',
            testEndTime: new Date(),
            levelResult: gameEvent.data.result,
            score: gameEvent.data.result?.score,
          }));

          // 触发数据持久化（下一步实现）
          handleLevelPersistence(gameEvent.data.result);
          break;

        case 'game.scene.stopped':
          if (gameEvent.data.sceneKey === 'TestScene') {
            console.log('🏁 TestScene停止，竖切测试完成');
          }
          break;

        case 'game.error':
          console.error('❌ 游戏错误:', gameEvent.data);
          setSliceState(prev => ({
            ...prev,
            phase: 'error',
            error: gameEvent.data.error,
          }));
          onError?.(gameEvent.data.error);
          break;
      }

      // 发布到Sentry进行可观测性
      if (window.electronAPI) {
        window.electronAPI.reportEvent?.({
          type: 'game_event',
          data: {
            eventType: gameEvent.type,
            source: gameEvent.source,
            timestamp: gameEvent.timestamp,
          },
        });
      }
    },
    [webVitals, onError]
  );

  /**
   * 处理关卡结果持久化
   */
  const handleLevelPersistence = useCallback(
    async (result: any) => {
      try {
        console.log('💾 开始数据持久化...');
        webVitals.startTiming('data_persistence');

        // 动态导入 LevelResultService
        const { LevelResultService } = await import(
          '../services/LevelResultService'
        );
        const levelService = new LevelResultService({
          enableBackup: true,
          backupInterval: 10000, // 10秒快速测试
          fallbackToLocalStorage: true,
        });

        // 构建完整的关卡结果数据
        const levelCompletionData = {
          levelId: 'test-level-1',
          playerId: `player-${Date.now()}`,
          startTime: sliceState.testStartTime || new Date(),
          endTime: sliceState.testEndTime || new Date(),
          duration: result.duration || 0,
          score: result.score || 0,
          totalMoves: result.totalMoves || 0,
          completionReason: result.completionReason || 'goal_reached',
          gameEvents: sliceState.events,
          metadata: {
            version: '1.0.0',
            testType: 'vertical-slice' as const,
            webVitals: {
              testDuration: sliceState.testEndTime
                ? sliceState.testEndTime.getTime() -
                  (sliceState.testStartTime?.getTime() || 0)
                : 0,
            },
            sessionId: `session-${Date.now()}`,
          },
        };

        // 保存到持久化服务
        const saveResult =
          await levelService.saveLevelResult(levelCompletionData);

        if (saveResult.success) {
          console.log('✅ 数据持久化完成, ID:', saveResult.data);

          // 获取统计信息
          const statsResult = await levelService.getStats();
          if (statsResult.success) {
            console.log('📊 持久化统计:', statsResult.data);
          }

          const persistenceData = {
            testId: saveResult.data,
            timestamp: new Date().toISOString(),
            result: levelCompletionData,
            stats: statsResult.data,
          };

          webVitals.endTiming('data_persistence');
          onComplete?.(persistenceData);

          // 清理服务资源
          levelService.dispose();
        } else {
          throw new Error(saveResult.error || 'Unknown persistence error');
        }
      } catch (error) {
        console.error('❌ 数据持久化失败:', error);
        webVitals.recordError(error as Error, 'data_persistence');
        setSliceState(prev => ({
          ...prev,
          error: `数据持久化失败: ${(error as Error).message}`,
        }));
      }
    },
    [sliceState, webVitals, onComplete]
  );

  /**
   * 初始化游戏引擎和TestScene
   */
  const initializeGameEngine = useCallback(async () => {
    if (!canvasRef.current || gameEngineRef.current) return;

    try {
      setSliceState(prev => ({ ...prev, phase: 'initializing' }));
      webVitals.startTiming('game_engine_init');

      const gameConfig: GameConfig = {
        maxLevel: 50,
        initialHealth: 100,
        scoreMultiplier: 1.0,
        autoSave: true,
        difficulty: 'medium',
      };

      // 创建游戏引擎适配器
      gameEngineRef.current = new GameEngineAdapter();

      // 设置游戏容器
      gameEngineRef.current.setContainer(canvasRef.current);

      // 注册事件监听
      gameEngineRef.current.onGameEvent(handleGameEvent);

      // 初始化引擎
      await gameEngineRef.current.initializeGame(gameConfig);

      // 直接启动TestScene
      await gameEngineRef.current.startGame();

      // 切换到TestScene
      const sceneManager = (gameEngineRef.current as any).sceneManager;
      if (sceneManager && sceneManager.game) {
        sceneManager.game.scene.start('TestScene');
        sceneManager.game.scene.stop('MenuScene');
      }

      console.log('✅ 游戏引擎初始化完成，TestScene已启动');
      webVitals.endTiming('game_engine_init');

      setSliceState(prev => ({
        ...prev,
        phase: 'playing',
        testStartTime: new Date(),
      }));
    } catch (error) {
      console.error('❌ 游戏引擎初始化失败:', error);
      webVitals.recordError(error as Error, 'game_engine_init');
      setSliceState(prev => ({
        ...prev,
        phase: 'error',
        error: (error as Error).message,
      }));
      onError?.((error as Error).message);
    }
  }, [handleGameEvent, webVitals, onError]);

  /**
   * 清理游戏引擎
   */
  const cleanupGameEngine = useCallback(() => {
    if (gameEngineRef.current) {
      try {
        gameEngineRef.current.destroy();
        gameEngineRef.current = null;
        console.log('✅ 游戏引擎已清理');
      } catch (error) {
        console.error('❌ 游戏引擎清理失败:', error);
      }
    }
  }, []);

  /**
   * 重置测试
   */
  const resetTest = useCallback(() => {
    cleanupGameEngine();
    setSliceState({
      phase: 'ready',
      events: [],
    });
  }, [cleanupGameEngine]);

  /**
   * 手动开始测试
   */
  const startTest = useCallback(() => {
    webVitals.recordCustomEvent('vertical_slice_start');
    initializeGameEngine();
  }, [initializeGameEngine, webVitals]);

  // 自动启动
  useEffect(() => {
    if (autoStart) {
      const timer = setTimeout(startTest, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoStart, startTest]);

  // 清理效果
  useEffect(() => {
    return () => {
      cleanupGameEngine();
    };
  }, [cleanupGameEngine]);

  /**
   * 渲染阶段UI
   */
  const renderPhaseUI = () => {
    switch (sliceState.phase) {
      case 'ready':
        return (
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              🚀 游戏竖切测试
            </h2>
            <p className="text-gray-300 mb-6">
              端到端验证：React → Phaser → 事件 → 持久化 → 可观测性
            </p>
            <button
              onClick={startTest}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              开始测试
            </button>
          </div>
        );

      case 'initializing':
        return (
          <div className="text-center p-8">
            <h2 className="text-xl font-bold text-white mb-4">
              ⚡ 初始化中...
            </h2>
            <div className="animate-pulse text-blue-400">
              正在启动游戏引擎和TestScene
            </div>
          </div>
        );

      case 'playing':
        return (
          <div className="p-4 bg-gray-800 rounded-t-lg">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">
                🎮 测试进行中
              </h3>
              <div className="text-sm text-gray-300">
                移动次数: {sliceState.totalMoves || 0}
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              提示：使用WASD移动蓝色精灵到右上角绿色区域完成测试
            </div>
          </div>
        );

      case 'completed':
        return (
          <div className="p-6 bg-green-800 rounded-t-lg">
            <h2 className="text-xl font-bold text-white mb-4">🎉 测试完成！</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-green-200">
                分数: {sliceState.score || 0}
              </div>
              <div className="text-green-200">
                移动次数: {sliceState.levelResult?.totalMoves || 0}
              </div>
              <div className="text-green-200">
                用时:{' '}
                {sliceState.levelResult?.duration
                  ? Math.round(sliceState.levelResult.duration / 1000) + '秒'
                  : 'N/A'}
              </div>
              <div className="text-green-200">
                事件数: {sliceState.events.length}
              </div>
            </div>
            <button
              onClick={resetTest}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              重新测试
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="p-6 bg-red-800 rounded-t-lg">
            <h2 className="text-xl font-bold text-white mb-4">❌ 测试失败</h2>
            <div className="text-red-200 text-sm mb-4">{sliceState.error}</div>
            <button
              onClick={resetTest}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              重试
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`game-vertical-slice ${className}`}>
      {renderPhaseUI()}

      {/* 游戏画布区域 */}
      {(sliceState.phase === 'playing' || sliceState.phase === 'completed') && (
        <div
          ref={canvasRef}
          className="game-canvas-container border border-gray-600 w-[800px] h-[600px]"
        />
      )}

      {/* 调试信息（开发时显示）*/}
      {process.env.NODE_ENV === 'development' &&
        sliceState.events.length > 0 && (
          <details className="mt-4 p-4 bg-gray-900 rounded text-xs">
            <summary className="text-white cursor-pointer">
              调试信息 ({sliceState.events.length} 个事件)
            </summary>
            <div className="mt-2 max-h-40 overflow-y-auto text-gray-300">
              {sliceState.events.slice(-10).map((event, index) => (
                <div key={index} className="mb-1">
                  <span className="text-blue-400">{event.type}</span>
                  {' - '}
                  <span className="text-yellow-400">{event.source}</span>
                  {event.data && (
                    <span className="text-gray-500 ml-2">
                      {JSON.stringify(event.data).substring(0, 100)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
    </div>
  );
}

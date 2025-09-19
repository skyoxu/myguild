/**
 * 游戏界面组件
 * 整合所有游戏相关的UI组件，提供完整的游戏界面
 */

import { useState, useCallback, useEffect } from 'react';
import { useGameEvents } from '../../hooks/useGameEvents';
import { GameStateProvider } from '../../contexts/GameStateContext';
import { GameCanvas } from '../GameCanvas';
import { GameStatusPanel } from './GameStatusPanel';
import { GameControlPanel } from './GameControlPanel';
import { GameNotifications } from './GameNotifications';
import { GameSaveManager } from './GameSaveManager';
import { GameSettingsPanel } from './GameSettingsPanel';
import GuildManager from '../guild/GuildManager';
import '../guild/GuildManager.css';
import type { GameSettings } from './GameSettingsPanel';
import type { GameState } from '../../ports/game-engine.port';
import type { DomainEvent } from '../../shared/contracts/events';
import './GameInterface.css';

interface GameInterfaceProps {
  className?: string;
  width?: number;
  height?: number;
  showDebugInfo?: boolean;
}

export function GameInterface({
  className = '',
  width = 800,
  height = 600,
  showDebugInfo = process.env.NODE_ENV === 'development',
}: GameInterfaceProps) {
  // 游戏状态
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI面板状态
  const [showSaveManager, setShowSaveManager] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStatusPanel, setShowStatusPanel] = useState(true);
  const [showControlPanel, setShowControlPanel] = useState(true);
  const [showNotifications, setShowNotifications] = useState(true);
  const [showGuildManager, setShowGuildManager] = useState(true);

  // 设置状态
  const [gameSettings, setGameSettings] = useState<Partial<GameSettings>>({
    ui: {
      theme: 'dark' as const,
      language: 'zh-CN',
      showAdvancedStats: false,
      notificationPosition: 'top-right' as const,
    },
    gameplay: {
      difficulty: 'medium' as const,
      autoSave: true,
      autoSaveInterval: 300,
      showNotifications: true,
      showTutorials: true,
    },
  });

  const gameEvents = useGameEvents({
    context: 'game-interface',
  });

  // 处理游戏事件
  const handleGameEvent = useCallback((event: DomainEvent) => {
    console.log('Game Interface Event:', event.type, event);

    // 可以根据需要处理特定事件
    if (event.type.includes('game.engine.started')) {
      setIsGameRunning(true);
      setError(null);
    } else if (event.type.includes('game.engine.paused')) {
      setIsGameRunning(false);
    } else if (event.type.includes('game.engine.resumed')) {
      setIsGameRunning(true);
    } else if (event.type.includes('game.engine.ended')) {
      setIsGameRunning(false);
    } else if (
      event.type.includes('game.error') &&
      event.data &&
      typeof event.data === 'object' &&
      'error' in event.data
    ) {
      setError((event.data as { error: string }).error);
    }
  }, []);

  // 处理游戏状态变化
  const handleGameStateChange = useCallback((state: GameState) => {
    setGameState(state);
  }, []);

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 阻止在输入框中触发快捷键
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (event.code) {
        case 'Escape':
          event.preventDefault();
          if (showSaveManager) {
            setShowSaveManager(false);
          } else if (showSettings) {
            setShowSettings(false);
          } else {
            // 发送暂停/继续命令
            gameEvents.sendCommandToPhaser(isGameRunning ? 'pause' : 'resume');
          }
          break;

        case 'F5':
          event.preventDefault();
          gameEvents.sendCommandToPhaser('save');
          break;

        case 'F9':
          event.preventDefault();
          setShowSaveManager(true);
          break;

        case 'F10':
          event.preventDefault();
          setShowSettings(true);
          break;

        case 'Tab':
          event.preventDefault();
          setShowStatusPanel(!showStatusPanel);
          break;

        case 'KeyH':
          if (event.ctrlKey) {
            event.preventDefault();
            setShowControlPanel(!showControlPanel);
          }
          break;

        case 'KeyN':
          if (event.ctrlKey) {
            event.preventDefault();
            setShowNotifications(!showNotifications);
          }
          break;

        case 'KeyG':
          event.preventDefault();
          setShowGuildManager(!showGuildManager);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    gameEvents,
    isGameRunning,
    showSaveManager,
    showSettings,
    showStatusPanel,
    showControlPanel,
    showNotifications,
    showGuildManager,
  ]);

  // 监听Phaser响应以更新运行状态
  useEffect(() => {
    const subscriptions = gameEvents.onPhaserResponse(event => {
      if (event.type === 'phaser.response.completed') {
        const { command } = event.data;
        switch (command) {
          case 'pause':
            setIsGameRunning(false);
            break;
          case 'resume':
          case 'load':
          case 'restart':
            setIsGameRunning(true);
            break;
        }
      }
    });

    return () => {
      subscriptions.forEach(subId => gameEvents.unsubscribe(subId));
    };
  }, [gameEvents]);

  return (
    <GameStateProvider
      stateManagerOptions={{
        storageKey: 'guild-manager-game',
        maxSaves: 20,
        autoSaveInterval: 30000,
        enableCompression: true,
      }}
      synchronizerOptions={{
        syncInterval: 500,
        conflictResolution: 'priority',
        enableBidirectionalSync: true,
      }}
    >
      <div
        className={`game-interface ${className}`}
        data-testid="game-interface"
      >
        {/* 主游戏画布 */}
        {!showGuildManager && (
          <GameCanvas
            width={width}
            height={height}
            onGameEvent={handleGameEvent}
            onGameStateChange={handleGameStateChange}
            className="main-game-canvas"
          />
        )}

        {/* Guild Manager界面 */}
        {showGuildManager && <GuildManager isVisible={showGuildManager} />}

        {/* 游戏状态面板 */}
        {showStatusPanel && (
          <GameStatusPanel
            gameState={gameState}
            showDetailed={gameSettings.ui.showAdvancedStats}
            position="top-right"
          />
        )}

        {/* 游戏控制面板 */}
        {showControlPanel && (
          <GameControlPanel
            position="bottom"
            showAdvanced={showDebugInfo}
            onSaveSuccess={() => {
              console.log('Game saved successfully');
            }}
            onLoadRequest={() => setShowSaveManager(true)}
            onError={setError}
          />
        )}

        {/* 游戏通知系统 */}
        {showNotifications && gameSettings.gameplay?.showNotifications && (
          <GameNotifications
            position={
              gameSettings.ui?.notificationPosition === 'top-left' ||
              gameSettings.ui?.notificationPosition === 'bottom-left'
                ? 'top-center'
                : (gameSettings.ui?.notificationPosition as
                    | 'top-center'
                    | 'top-right'
                    | 'bottom-center'
                    | 'bottom-right')
            }
            maxNotifications={5}
          />
        )}

        {/* 设置按钮（右上角） */}
        <button
          onClick={() => setShowSettings(true)}
          className="game-interface__settings-btn"
          title="打开设置 (F10)"
        >
          ⚙️
        </button>

        {/* 存档管理按钮 */}
        <button
          onClick={() => setShowSaveManager(true)}
          className="game-interface__save-manager-btn"
          title="管理存档 (F9)"
        >
          📁
        </button>

        {/* Guild Manager切换按钮 */}
        <button
          onClick={() => setShowGuildManager(!showGuildManager)}
          className="game-interface__guild-manager-btn"
          title="公会管理器 (G)"
        >
          🏰
        </button>

        {/* 调试信息面板 */}
        {showDebugInfo && (
          <div className="game-interface__debug-panel">
            <div className="game-interface__debug-title">调试信息</div>

            <div>状态: {isGameRunning ? '运行中' : '已暂停'}</div>
            <div>FPS: {typeof window !== 'undefined' ? '60' : '0'}</div>
            <div>
              内存:{' '}
              {typeof performance !== 'undefined' && (performance as any).memory
                ? `${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB`
                : 'N/A'}
            </div>

            {gameState && (
              <div className="game-interface__debug-state">
                <div>等级: {gameState.level}</div>
                <div>分数: {gameState.score}</div>
                <div>生命: {gameState.health}</div>
                {gameState.position && (
                  <div>
                    位置: ({Math.round(gameState.position.x)},{' '}
                    {Math.round(gameState.position.y)})
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="game-interface__debug-error">错误: {error}</div>
            )}

            <div className="game-interface__debug-shortcuts">
              F10: 设置 | F9: 存档 | ESC: 暂停 | TAB: 状态面板
            </div>
          </div>
        )}

        {/* 存档管理器 */}
        <GameSaveManager
          isVisible={showSaveManager}
          onClose={() => setShowSaveManager(false)}
          onSaveSelected={() => setShowSaveManager(false)}
          onError={setError}
        />

        {/* 设置面板 */}
        <GameSettingsPanel
          isVisible={showSettings}
          onClose={() => setShowSettings(false)}
          onSettingsChange={(settings: Partial<GameSettings>) => {
            setGameSettings((prevSettings: Partial<GameSettings>) => ({
              ...prevSettings,
              ...settings,
              ui: { ...prevSettings.ui, ...settings.ui },
              gameplay: { ...prevSettings.gameplay, ...settings.gameplay },
            }));
            // 这里可以应用设置到游戏中
            console.log('Settings updated:', settings);
          }}
        />

        {/* 错误显示 */}
        {error && (
          <div className="game-interface__error-overlay">
            <div className="game-interface__error-icon">⚠️ 错误</div>
            <div className="game-interface__error-message">{error}</div>
            <button
              onClick={() => setError(null)}
              className="game-interface__error-close-btn"
            >
              关闭
            </button>
          </div>
        )}

        {/* 加载遮罩（可选） */}
        {!gameState && !error && (
          <div className="game-interface__loading-overlay">
            <div className="game-interface__loading-content">
              <div className="game-interface__loading-icon">🎮</div>
              <div className="game-interface__loading-title">
                初始化游戏引擎...
              </div>
              <div className="game-interface__loading-subtitle">请稍候</div>
            </div>
          </div>
        )}
      </div>
    </GameStateProvider>
  );
}

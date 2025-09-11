/**
 * 游戏控制面板组件
 * 提供游戏控制按钮和快捷功能
 */

import { useState, useCallback, useEffect } from 'react';
import { useGameEvents } from '../../hooks/useGameEvents';
import { useGameState } from '../../contexts/GameStateContext';
import './GameControlPanel.css';

interface GameControlPanelProps {
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showAdvanced?: boolean;
  onSaveSuccess?: (saveId: string) => void;
  onLoadRequest?: () => void;
  onError?: (error: string) => void;
}

export function GameControlPanel({
  className = '',
  position = 'bottom',
  showAdvanced = false,
  onSaveSuccess,
  onLoadRequest,
  onError,
}: GameControlPanelProps) {
  const [isGameRunning, setIsGameRunning] = useState(true);
  const [lastSaveId, setLastSaveId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const gameEvents = useGameEvents({
    context: 'game-control-panel',
  });

  // 使用统一的状态管理
  const { saveGame: saveGameState } = useGameState();

  // 监听Phaser响应
  useEffect(() => {
    const subscriptions = gameEvents.onPhaserResponse(event => {
      setIsProcessing(false);

      if (event.type === 'phaser.response.completed') {
        const { command, result } = event.data;

        switch (command) {
          case 'pause':
            setIsGameRunning(false);
            break;
          case 'resume':
            setIsGameRunning(true);
            break;
          case 'save':
            if (result?.saveId) {
              setLastSaveId(result.saveId);
              onSaveSuccess?.(result.saveId);
            }
            break;
          case 'load':
            setIsGameRunning(true);
            break;
          case 'restart':
            setIsGameRunning(true);
            setLastSaveId(null);
            break;
        }
      }
    });

    return () => {
      subscriptions.forEach(subId => gameEvents.unsubscribe(subId));
    };
  }, [gameEvents, onSaveSuccess]);

  // 监听游戏错误
  useEffect(() => {
    const subscriptions = gameEvents.onGameError(event => {
      setIsProcessing(false);
      const errorData = event.data as { error?: string; message?: string };
      onError?.(errorData.error || errorData.message || '发生未知错误');
    });

    return () => {
      subscriptions.forEach(subId => gameEvents.unsubscribe(subId));
    };
  }, [gameEvents, onError]);

  // 控制函数
  const handlePause = useCallback(() => {
    if (isProcessing) return;
    setIsProcessing(true);
    gameEvents.sendCommandToPhaser('pause');
  }, [gameEvents, isProcessing]);

  const handleResume = useCallback(() => {
    if (isProcessing) return;
    setIsProcessing(true);
    gameEvents.sendCommandToPhaser('resume');
  }, [gameEvents, isProcessing]);

  const handleSave = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // 使用Context进行保存，同时也通过EventBus通知Phaser
      const saveId = await saveGameState();
      if (saveId) {
        setLastSaveId(saveId);
        onSaveSuccess?.(saveId);
      }
      gameEvents.sendCommandToPhaser('save');
    } catch (error) {
      console.error('Failed to save game:', error);
      onError?.((error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, saveGameState, gameEvents, onSaveSuccess, onError]);

  const handleLoad = useCallback(() => {
    onLoadRequest?.();
  }, [onLoadRequest]);

  const handleRestart = useCallback(() => {
    if (isProcessing) return;
    if (!confirm('确定要重新开始游戏吗？当前进度将丢失。')) return;

    setIsProcessing(true);
    gameEvents.sendCommandToPhaser('restart');
  }, [gameEvents, isProcessing]);

  const handleQuickSave = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // 快速保存也使用Context
      const saveId = await saveGameState();
      if (saveId) {
        setLastSaveId(saveId);
      }
      gameEvents.sendCommandToPhaser('save');
    } catch (error) {
      console.error('Failed to quick save:', error);
      onError?.((error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, saveGameState, gameEvents, onError]);

  const handleQuickLoad = useCallback(() => {
    if (!lastSaveId) return;
    if (isProcessing) return;

    setIsProcessing(true);
    gameEvents.sendCommandToPhaser('load', { saveId: lastSaveId });
  }, [gameEvents, lastSaveId, isProcessing]);

  return (
    <div
      className={`game-control-panel position-${position} ${className}`}
      data-testid="game-control-panel"
    >
      {/* 主要控制按钮 */}
      <div className="control-main-section">
        {/* 暂停/继续按钮 */}
        <button
          onClick={isGameRunning ? handlePause : handleResume}
          disabled={isProcessing}
          className={`control-btn primary ${isGameRunning ? 'pause' : 'resume'}`}
          title={isGameRunning ? '暂停游戏' : '继续游戏'}
        >
          {isProcessing ? '⏳' : isGameRunning ? '⏸️ 暂停' : '▶️ 继续'}
        </button>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={isProcessing}
          className="control-btn secondary"
          title="保存游戏"
        >
          {isProcessing ? '💾...' : '💾 保存'}
        </button>

        {/* 加载按钮 */}
        <button
          onClick={handleLoad}
          disabled={isProcessing}
          className="control-btn secondary"
          title="加载存档"
        >
          📂 加载
        </button>

        {/* 重启按钮 */}
        <button
          onClick={handleRestart}
          disabled={isProcessing}
          className="control-btn danger"
          title="重新开始游戏"
        >
          🔄 重启
        </button>
      </div>

      {/* 高级控制（可选） */}
      {showAdvanced && (
        <div className="control-advanced-section">
          <span className="status-label">快捷操作:</span>

          {/* 快速保存 */}
          <button
            onClick={handleQuickSave}
            disabled={isProcessing}
            className="control-btn small quick-save"
            title="快速保存 (F5)"
          >
            F5 快存
          </button>

          {/* 快速加载 */}
          <button
            onClick={handleQuickLoad}
            disabled={isProcessing || !lastSaveId}
            className={`control-btn small quick-load ${!lastSaveId ? 'disabled' : ''}`}
            title={lastSaveId ? '快速加载 (F9)' : '暂无快速存档'}
          >
            F9 快读
          </button>

          {/* 状态指示器 */}
          <div className="status-indicator-section">
            <div
              className={`status-dot ${
                isProcessing
                  ? 'processing'
                  : isGameRunning
                    ? 'running'
                    : 'paused'
              }`}
            />
            <span className="status-text">
              {isProcessing ? '处理中' : isGameRunning ? '运行中' : '已暂停'}
            </span>
          </div>
        </div>
      )}

      {/* 键盘提示 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dev-hints">ESC: 暂停 | F5: 快存 | F9: 快读</div>
      )}
    </div>
  );
}

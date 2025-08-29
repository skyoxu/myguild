/**
 * 游戏控制面板组件
 * 提供游戏控制按钮和快捷功能
 */

import { useState, useCallback, useEffect } from 'react';
import { useGameEvents } from '../../hooks/useGameEvents';
import { useGameState } from '../../contexts/GameStateContext';

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

  // 获取面板样式
  const getPanelStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      backdropFilter: 'blur(6px)',
      borderRadius: '12px',
      padding: '16px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      zIndex: 1001,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    };

    switch (position) {
      case 'top':
        return {
          ...baseStyle,
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          ...baseStyle,
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          ...baseStyle,
          left: '20px',
          top: '50%',
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          ...baseStyle,
          right: '20px',
          top: '50%',
          transform: 'translateY(-50%)',
        };
      default:
        return baseStyle;
    }
  };

  const buttonStyle = {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500' as const,
    transition: 'all 0.2s ease',
    disabled: isProcessing,
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#3b82f6',
    color: '#ffffff',
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#e5e7eb',
    border: '1px solid rgba(255, 255, 255, 0.3)',
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#ef4444',
    color: '#ffffff',
  };


  return (
    <div
      className={`game-control-panel ${className}`}
      style={getPanelStyle()}
      data-testid="game-control-panel"
    >
      {/* 主要控制按钮 */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* 暂停/继续按钮 */}
        <button
          onClick={isGameRunning ? handlePause : handleResume}
          disabled={isProcessing}
          style={{
            ...primaryButtonStyle,
            backgroundColor: isGameRunning ? '#f59e0b' : '#22c55e',
            opacity: isProcessing ? 0.6 : 1,
          }}
          title={isGameRunning ? '暂停游戏' : '继续游戏'}
        >
          {isProcessing ? '⏳' : isGameRunning ? '⏸️ 暂停' : '▶️ 继续'}
        </button>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={isProcessing}
          style={{
            ...secondaryButtonStyle,
            opacity: isProcessing ? 0.6 : 1,
          }}
          title="保存游戏"
        >
          {isProcessing ? '💾...' : '💾 保存'}
        </button>

        {/* 加载按钮 */}
        <button
          onClick={handleLoad}
          disabled={isProcessing}
          style={{
            ...secondaryButtonStyle,
            opacity: isProcessing ? 0.6 : 1,
          }}
          title="加载存档"
        >
          📂 加载
        </button>

        {/* 重启按钮 */}
        <button
          onClick={handleRestart}
          disabled={isProcessing}
          style={{
            ...dangerButtonStyle,
            opacity: isProcessing ? 0.6 : 1,
          }}
          title="重新开始游戏"
        >
          🔄 重启
        </button>
      </div>

      {/* 高级控制（可选） */}
      {showAdvanced && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            fontSize: '12px',
          }}
        >
          <span style={{ color: '#94a3b8', marginRight: '8px' }}>
            快捷操作:
          </span>

          {/* 快速保存 */}
          <button
            onClick={handleQuickSave}
            disabled={isProcessing}
            style={{
              ...buttonStyle,
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: 'rgba(59, 130, 246, 0.3)',
              color: '#93c5fd',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              opacity: isProcessing ? 0.6 : 1,
            }}
            title="快速保存 (F5)"
          >
            F5 快存
          </button>

          {/* 快速加载 */}
          <button
            onClick={handleQuickLoad}
            disabled={isProcessing || !lastSaveId}
            style={{
              ...buttonStyle,
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: lastSaveId
                ? 'rgba(34, 197, 94, 0.3)'
                : 'rgba(156, 163, 175, 0.3)',
              color: lastSaveId ? '#86efac' : '#9ca3af',
              border: `1px solid rgba(${lastSaveId ? '34, 197, 94' : '156, 163, 175'}, 0.5)`,
              opacity: isProcessing || !lastSaveId ? 0.6 : 1,
            }}
            title={lastSaveId ? '快速加载 (F9)' : '暂无快速存档'}
          >
            F9 快读
          </button>

          {/* 状态指示器 */}
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isProcessing
                  ? '#f59e0b'
                  : isGameRunning
                    ? '#22c55e'
                    : '#ef4444',
                transition: 'background-color 0.3s ease',
              }}
            />
            <span style={{ color: '#94a3b8', fontSize: '10px' }}>
              {isProcessing ? '处理中' : isGameRunning ? '运行中' : '已暂停'}
            </span>
          </div>
        </div>
      )}

      {/* 键盘提示 */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '10px',
            color: '#6b7280',
            textAlign: 'center',
          }}
        >
          ESC: 暂停 | F5: 快存 | F9: 快读
        </div>
      )}
    </div>
  );
}

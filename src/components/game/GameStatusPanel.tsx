/**
 * 游戏状态面板组件
 * 显示玩家生命值、分数、等级等信息
 */

import { useState } from 'react';
import { useGameEvents } from '../../hooks/useGameEvents';
import { useGameState } from '../../contexts/GameStateContext';
import type { GameState } from '../../ports/game-engine.port';

interface GameStatusPanelProps {
  gameState?: GameState | null;
  className?: string;
  showDetailed?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function GameStatusPanel({
  gameState: initialGameState,
  className = '',
  showDetailed = false,
  position = 'top-right',
}: GameStatusPanelProps) {
  const [isVisible, setIsVisible] = useState(true);

  // 使用统一的状态管理
  const { gameState: contextGameState } = useGameState();

  // 优先使用Context中的状态，回退到初始状态
  const gameState = contextGameState || initialGameState;


  // 计算健康百分比
  const healthPercentage = gameState
    ? Math.max(0, (gameState.health / 100) * 100)
    : 0;

  // 获取健康状态颜色
  const getHealthColor = () => {
    if (healthPercentage >= 70) return '#22c55e'; // 绿色
    if (healthPercentage >= 30) return '#f59e0b'; // 黄色
    return '#ef4444'; // 红色
  };

  // 获取位置样式
  const getPositionStyle = () => {
    const baseStyle = { position: 'absolute' as const, zIndex: 1000 };

    switch (position) {
      case 'top-left':
        return { ...baseStyle, top: '20px', left: '20px' };
      case 'top-right':
        return { ...baseStyle, top: '20px', right: '20px' };
      case 'bottom-left':
        return { ...baseStyle, bottom: '20px', left: '20px' };
      case 'bottom-right':
        return { ...baseStyle, bottom: '20px', right: '20px' };
      default:
        return { ...baseStyle, top: '20px', right: '20px' };
    }
  };

  // 切换显示状态
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  if (!gameState) {
    return null;
  }

  return (
    <div
      className={`game-status-panel ${className}`}
      style={{
        ...getPositionStyle(),
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: '#ffffff',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(4px)',
        fontFamily: 'monospace',
        fontSize: '14px',
        minWidth: '200px',
        userSelect: 'none',
        transition: 'all 0.3s ease',
        opacity: isVisible ? 1 : 0.7,
        transform: isVisible ? 'scale(1)' : 'scale(0.95)',
      }}
      data-testid="game-status-panel"
    >
      {/* 可折叠按钮 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isVisible ? '8px' : '0px',
        }}
      >
        <span
          style={{ fontWeight: 'bold', fontSize: '12px', color: '#94a3b8' }}
        >
          游戏状态
        </span>
        <button
          onClick={toggleVisibility}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '2px 4px',
          }}
          title={isVisible ? '折叠' : '展开'}
        >
          {isVisible ? '−' : '+'}
        </button>
      </div>

      {/* 主要状态信息 */}
      {isVisible && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* 生命值条 */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}
            >
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>生命值</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {gameState.health}/100
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${healthPercentage}%`,
                  height: '100%',
                  backgroundColor: getHealthColor(),
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* 分数和等级 */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>分数</div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#fbbf24',
                }}
              >
                {gameState.score.toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>等级</div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#3b82f6',
                }}
              >
                {gameState.level}
              </div>
            </div>
          </div>

          {/* 详细信息（可选） */}
          {showDetailed && (
            <>
              {/* 物品栏 */}
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    marginBottom: '4px',
                  }}
                >
                  物品栏 ({gameState.inventory?.length || 0})
                </div>
                {gameState.inventory && gameState.inventory.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      flexWrap: 'wrap',
                      maxWidth: '180px',
                    }}
                  >
                    {gameState.inventory.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.3)',
                          color: '#93c5fd',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          border: '1px solid rgba(59, 130, 246, 0.5)',
                        }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      fontStyle: 'italic',
                    }}
                  >
                    暂无物品
                  </div>
                )}
              </div>

              {/* 位置信息 */}
              {gameState.position && (
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>位置</div>
                  <div style={{ fontSize: '11px', color: '#d1d5db' }}>
                    X: {Math.round(gameState.position.x)}, Y:{' '}
                    {Math.round(gameState.position.y)}
                  </div>
                </div>
              )}

              {/* 游戏ID（调试信息） */}
              {process.env.NODE_ENV === 'development' && (
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#6b7280',
                      marginTop: '8px',
                    }}
                  >
                    ID: {gameState.id}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>
                    更新: {new Date(gameState.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

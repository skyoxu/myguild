/**
 * 游戏状态面板组件
 * 显示玩家生命值、分数、等级等信息
 */

import { useState } from 'react';
import { useGameState } from '../../contexts/GameStateContext';
import type { GameState } from '../../ports/game-engine.port';
import './GameStatusPanel.css';

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

  // 获取位置CSS类名
  const getPositionClass = () => {
    switch (position) {
      case 'top-left':
        return 'game-status-panel--top-left';
      case 'top-right':
        return 'game-status-panel--top-right';
      case 'bottom-left':
        return 'game-status-panel--bottom-left';
      case 'bottom-right':
        return 'game-status-panel--bottom-right';
      default:
        return 'game-status-panel--top-right';
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
      className={`game-status-panel ${getPositionClass()} ${
        isVisible ? 'game-status-panel--visible' : 'game-status-panel--hidden'
      } ${className}`}
      data-testid="game-status-panel"
    >
      {/* 可折叠按钮 */}
      <div
        className={`game-status-panel__header ${
          isVisible
            ? 'game-status-panel__header--visible'
            : 'game-status-panel__header--collapsed'
        }`}
      >
        <span className="game-status-panel__title">游戏状态</span>
        <button
          onClick={toggleVisibility}
          className="game-status-panel__toggle-btn"
          title={isVisible ? '折叠' : '展开'}
        >
          {isVisible ? '−' : '+'}
        </button>
      </div>

      {/* 主要状态信息 */}
      {isVisible && (
        <div className="game-status-panel__content">
          {/* 生命值条 */}
          <div>
            <div className="game-status-panel__health-header">
              <span className="game-status-panel__health-label">生命值</span>
              <span className="game-status-panel__health-value">
                {gameState.health}/100
              </span>
            </div>
            <div className="game-status-panel__health-bar">
              <div
                className="game-status-panel__health-fill"
                style={{
                  width: `${healthPercentage}%`,
                  backgroundColor: getHealthColor(),
                }}
              />
            </div>
          </div>

          {/* 分数和等级 */}
          <div className="game-status-panel__stats">
            <div>
              <div className="game-status-panel__stat-label">分数</div>
              <div className="game-status-panel__score-value">
                {gameState.score.toLocaleString()}
              </div>
            </div>
            <div className="game-status-panel__level-container">
              <div className="game-status-panel__stat-label">等级</div>
              <div className="game-status-panel__level-value">
                {gameState.level}
              </div>
            </div>
          </div>

          {/* 详细信息（可选） */}
          {showDetailed && (
            <>
              {/* 物品栏 */}
              <div>
                <div className="game-status-panel__inventory-label">
                  物品栏 ({gameState.inventory?.length || 0})
                </div>
                {gameState.inventory && gameState.inventory.length > 0 ? (
                  <div className="game-status-panel__inventory-items">
                    {gameState.inventory.map((item, index) => (
                      <div
                        key={index}
                        className="game-status-panel__inventory-item"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="game-status-panel__inventory-empty">
                    暂无物品
                  </div>
                )}
              </div>

              {/* 位置信息 */}
              {gameState.position && (
                <div>
                  <div className="game-status-panel__position-label">位置</div>
                  <div className="game-status-panel__position-value">
                    X: {Math.round(gameState.position.x)}, Y:{' '}
                    {Math.round(gameState.position.y)}
                  </div>
                </div>
              )}

              {/* 游戏ID（调试信息） */}
              {process.env.NODE_ENV === 'development' && (
                <div className="game-status-panel__debug-info">
                  <div className="game-status-panel__debug-id">
                    ID: {gameState.id}
                  </div>
                  <div className="game-status-panel__debug-timestamp">
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

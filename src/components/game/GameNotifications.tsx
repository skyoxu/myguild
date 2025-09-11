/**
 * 游戏通知系统组件
 * 显示游戏事件、提示和错误消息
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameEvents } from '../../hooks/useGameEvents';
import './GameNotifications.css';

interface GameNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number; // 显示持续时间（毫秒），0表示手动关闭
  persistent?: boolean; // 是否持久显示
}

interface GameNotificationsProps {
  className?: string;
  position?: 'top-center' | 'top-right' | 'bottom-center' | 'bottom-right';
  maxNotifications?: number;
  defaultDuration?: number;
}

export function GameNotifications({
  className = '',
  position = 'top-right',
  maxNotifications = 5,
  defaultDuration = 4000,
}: GameNotificationsProps) {
  const [notifications, setNotifications] = useState<GameNotification[]>([]);

  const gameEvents = useGameEvents({
    context: 'game-notifications',
  });

  // 添加通知
  const addNotification = useCallback(
    (notification: Omit<GameNotification, 'id' | 'timestamp'>) => {
      const newNotification: GameNotification = {
        id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        duration: notification.duration ?? defaultDuration,
        ...notification,
      };

      setNotifications(prev => {
        const updated = [newNotification, ...prev].slice(0, maxNotifications);
        return updated;
      });

      // 自动移除（如果设置了duration且不是持久通知）
      if (
        newNotification.duration &&
        newNotification.duration > 0 &&
        !newNotification.persistent
      ) {
        setTimeout(() => {
          removeNotification(newNotification.id);
        }, newNotification.duration);
      }

      return newNotification.id;
    },
    [defaultDuration, maxNotifications]
  );

  // 移除通知
  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  // 清除所有通知
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // 监听游戏事件并转换为通知
  useEffect(() => {
    // 监听游戏状态变化
    const stateSubscriptions = gameEvents.onGameStateChange(event => {
      const { gameState } = event.data;

      // 等级提升通知
      if (gameState.level > 1) {
        addNotification({
          type: 'success',
          title: '等级提升！',
          message: `恭喜达到 ${gameState.level} 级！`,
          duration: 3000,
        });
      }

      // 低血量警告
      if (gameState.health <= 20) {
        addNotification({
          type: 'warning',
          title: '生命值过低！',
          message: `当前生命值: ${gameState.health}，请注意安全！`,
          duration: 5000,
        });
      }
    });

    // 监听错误事件
    const errorSubscriptions = gameEvents.onGameError(event => {
      const errorData = event.data as { error?: string; message?: string };
      addNotification({
        type: 'error',
        title: '游戏错误',
        message: errorData.error || errorData.message || '发生未知错误',
        duration: 6000,
        persistent: false,
      });
    });

    // 监听Phaser响应
    const responseSubscriptions = gameEvents.onPhaserResponse(event => {
      if (event.type === 'phaser.response.completed') {
        const { command, result } = event.data;

        switch (command) {
          case 'save':
            if (result?.saveId) {
              addNotification({
                type: 'success',
                title: '游戏已保存',
                message: `存档ID: ${result.saveId.substring(0, 8)}...`,
                duration: 3000,
              });
            }
            break;
          case 'load':
            addNotification({
              type: 'info',
              title: '游戏已加载',
              message: '存档加载成功',
              duration: 3000,
            });
            break;
          case 'pause':
            addNotification({
              type: 'info',
              title: '游戏已暂停',
              message: '点击继续按钮恢复游戏',
              duration: 2000,
            });
            break;
          case 'resume':
            addNotification({
              type: 'info',
              title: '游戏已恢复',
              message: '欢迎回来！',
              duration: 2000,
            });
            break;
          case 'restart':
            addNotification({
              type: 'info',
              title: '游戏已重启',
              message: '新的冒险开始了！',
              duration: 3000,
            });
            break;
        }
      }
    });

    // 监听UI通知事件
    const uiSubscription = gameEvents.subscribe(
      'game.ui.notification.shown',
      event => {
        const notificationData = event.data as {
          message?: string;
          type?: 'info' | 'success' | 'warning' | 'error';
        };
        addNotification({
          type: notificationData.type || 'info',
          title: '游戏消息',
          message: notificationData.message || '收到通知',
          duration: 4000,
        });
      }
    );

    return () => {
      stateSubscriptions.forEach(subId => gameEvents.unsubscribe(subId));
      errorSubscriptions.forEach(subId => gameEvents.unsubscribe(subId));
      responseSubscriptions.forEach(subId => gameEvents.unsubscribe(subId));
      gameEvents.unsubscribe(uiSubscription);
    };
  }, [gameEvents, addNotification]);

  // 获取通知图标
  const getNotificationIcon = (type: GameNotification['type']) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  // 获取通知颜色
  const getNotificationColor = (type: GameNotification['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: 'rgba(34, 197, 94, 0.15)',
          border: '#22c55e',
          text: '#22c55e',
        };
      case 'warning':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          border: '#f59e0b',
          text: '#f59e0b',
        };
      case 'error':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          border: '#ef4444',
          text: '#ef4444',
        };
      case 'info':
      default:
        return {
          bg: 'rgba(59, 130, 246, 0.15)',
          border: '#3b82f6',
          text: '#3b82f6',
        };
    }
  };

  // 获取容器位置类名
  const getContainerClassName = () => {
    switch (position) {
      case 'top-center':
        return 'game-notifications--top-center';
      case 'top-right':
        return 'game-notifications--top-right';
      case 'bottom-center':
        return 'game-notifications--bottom-center';
      case 'bottom-right':
        return 'game-notifications--bottom-right';
      default:
        return 'game-notifications--top-right';
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      className={`game-notifications ${getContainerClassName()} ${className}`}
      data-testid="game-notifications"
    >
      {notifications.map(notification => {
        const colors = getNotificationColor(notification.type);

        return (
          <div
            key={notification.id}
            className={`game-notifications__item game-notifications__item--${notification.type}`}
            onClick={() => removeNotification(notification.id)}
            title="点击关闭"
          >
            {/* 关闭按钮 */}
            <button
              onClick={e => {
                e.stopPropagation();
                removeNotification(notification.id);
              }}
              className="game-notifications__close-btn"
            >
              ×
            </button>

            {/* 通知内容 */}
            <div className="game-notifications__content">
              <span className="game-notifications__icon">
                {getNotificationIcon(notification.type)}
              </span>

              <div className="game-notifications__text">
                <div
                  className={`game-notifications__title game-notifications__title--${notification.type}`}
                >
                  {notification.title}
                </div>

                <div className="game-notifications__message">
                  {notification.message}
                </div>

                {/* 时间戳 */}
                <div className="game-notifications__timestamp">
                  {notification.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* 进度条（显示剩余时间） */}
            {notification.duration &&
              notification.duration > 0 &&
              !notification.persistent && (
                <div className="game-notifications__progress-container">
                  <div
                    className={`game-notifications__progress-bar game-notifications__progress-bar--${notification.type}`}
                    style={{
                      animation: `shrinkWidth ${notification.duration}ms linear`,
                    }}
                  />
                </div>
              )}
          </div>
        );
      })}

      {/* 清除所有按钮（当有多个通知时） */}
      {notifications.length > 1 && (
        <button
          onClick={clearAllNotifications}
          className="game-notifications__clear-all"
        >
          清除所有 ({notifications.length})
        </button>
      )}
    </div>
  );
}

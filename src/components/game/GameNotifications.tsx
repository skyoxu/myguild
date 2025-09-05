/**
 * 游戏通知系统组件
 * 显示游戏事件、提示和错误消息
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameEvents } from '../../hooks/useGameEvents';

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

  // 获取容器位置样式
  const getContainerStyle = () => {
    const baseStyle = {
      position: 'fixed' as const,
      zIndex: 2000,
      pointerEvents: 'none' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '8px',
      maxWidth: '320px',
    };

    switch (position) {
      case 'top-center':
        return {
          ...baseStyle,
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'top-right':
        return {
          ...baseStyle,
          top: '80px',
          right: '20px',
        };
      case 'bottom-center':
        return {
          ...baseStyle,
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'bottom-right':
        return {
          ...baseStyle,
          bottom: '80px',
          right: '20px',
        };
      default:
        return baseStyle;
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      className={`game-notifications ${className}`}
      style={getContainerStyle()}
      data-testid="game-notifications"
    >
      {notifications.map(notification => {
        const colors = getNotificationColor(notification.type);

        return (
          <div
            key={notification.id}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              padding: '12px 16px',
              pointerEvents: 'auto',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              animation: 'slideInFromRight 0.3s ease',
              position: 'relative',
            }}
            onClick={() => removeNotification(notification.id)}
            title="点击关闭"
          >
            {/* 关闭按钮 */}
            <button
              onClick={e => {
                e.stopPropagation();
                removeNotification(notification.id);
              }}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '2px',
                opacity: 0.7,
              }}
            >
              ×
            </button>

            {/* 通知内容 */}
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}
            >
              <span style={{ fontSize: '16px', marginTop: '2px' }}>
                {getNotificationIcon(notification.type)}
              </span>

              <div style={{ flex: 1, paddingRight: '16px' }}>
                <div
                  style={{
                    color: colors.text,
                    fontSize: '14px',
                    fontWeight: '600',
                    marginBottom: '4px',
                  }}
                >
                  {notification.title}
                </div>

                <div
                  style={{
                    color: '#e5e7eb',
                    fontSize: '13px',
                    lineHeight: 1.4,
                  }}
                >
                  {notification.message}
                </div>

                {/* 时间戳 */}
                <div
                  style={{
                    color: '#9ca3af',
                    fontSize: '11px',
                    marginTop: '4px',
                  }}
                >
                  {notification.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* 进度条（显示剩余时间） */}
            {notification.duration &&
              notification.duration > 0 &&
              !notification.persistent && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden',
                    borderRadius: '0 0 8px 8px',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: colors.border,
                      animation: `shrinkWidth ${notification.duration}ms linear`,
                      transformOrigin: 'left center',
                    }}
                  />
                </div>
              )}
          </div>
        );
      })}

      {/* 全局动画样式 */}
      <style>{`
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes shrinkWidth {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }
      `}</style>

      {/* 清除所有按钮（当有多个通知时） */}
      {notifications.length > 1 && (
        <button
          onClick={clearAllNotifications}
          style={{
            alignSelf: 'center',
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#9ca3af',
            border: '1px solid rgba(156, 163, 175, 0.3)',
            borderRadius: '4px',
            cursor: 'pointer',
            pointerEvents: 'auto',
            transition: 'all 0.2s ease',
          }}
        >
          清除所有 ({notifications.length})
        </button>
      )}
    </div>
  );
}

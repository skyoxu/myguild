/**
 * React Hook for Game Event Communication
 * 为React组件提供与Phaser游戏引擎的事件通信能力
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { EventBus } from '../shared/events/EventBus';
import type {
  GameDomainEvent,
  GameEventHandler,
} from '../shared/contracts/events/GameEvents';
import { EventPriority } from '../shared/contracts/events/GameEvents';

// 全局事件总线实例（单例模式）
const globalEventBus = new EventBus({
  maxListeners: 200,
  enableLogging: process.env.NODE_ENV === 'development',
  enableMetrics: true,
  queueSize: 2000,
});

// 导出全局事件总线以供其他模块使用
export { globalEventBus };

export interface UseGameEventsOptions {
  context?: string; // 标识组件上下文
  priority?: EventPriority;
  enableAutoCleanup?: boolean; // 组件卸载时自动清理
}

export interface GameEventSubscription {
  eventType: GameDomainEvent['type'];
  subscriptionId: string;
}

export function useGameEvents(options: UseGameEventsOptions = {}) {
  const {
    context = 'react-component',
    priority = EventPriority.NORMAL,
    enableAutoCleanup = true,
  } = options;

  // 保存订阅信息以便清理
  const subscriptionsRef = useRef<GameEventSubscription[]>([]);
  const eventBusRef = useRef(globalEventBus);

  // 订阅事件
  const subscribe = useCallback(
    <T extends GameDomainEvent>(
      eventType: T['type'],
      handler: GameEventHandler<T>,
      subscribeOptions: {
        priority?: EventPriority;
        once?: boolean;
      } = {}
    ): string => {
      const subscriptionId = eventBusRef.current.subscribe(eventType, handler, {
        priority: subscribeOptions.priority || priority,
        once: subscribeOptions.once || false,
        context,
      });

      // 记录订阅信息
      subscriptionsRef.current.push({
        eventType,
        subscriptionId,
      });

      return subscriptionId;
    },
    [context, priority]
  );

  // 取消订阅
  const unsubscribe = useCallback((subscriptionId: string): boolean => {
    const success = eventBusRef.current.unsubscribe(subscriptionId);

    if (success) {
      // 从本地记录中移除
      subscriptionsRef.current = subscriptionsRef.current.filter(
        sub => sub.subscriptionId !== subscriptionId
      );
    }

    return success;
  }, []);

  // 发布事件（同步）
  const publish = useCallback(
    (event: GameDomainEvent): void => {
      eventBusRef.current.publish(event, {
        source: context,
        priority,
      });
    },
    [context, priority]
  );

  // 发布事件（异步）
  const publishAsync = useCallback(
    async (event: GameDomainEvent): Promise<void> => {
      await eventBusRef.current.publishAsync(event, {
        source: context,
        priority,
      });
    },
    [context, priority]
  );

  // 发布命令事件到Phaser（便捷方法）
  const sendCommandToPhaser = useCallback(
    (
      command: 'pause' | 'resume' | 'save' | 'load' | 'restart',
      data?: any
    ): void => {
      const eventMap = {
        pause: {
          type: 'react.command.pause' as const,
          data: { timestamp: new Date() },
        },
        resume: {
          type: 'react.command.resume' as const,
          data: { timestamp: new Date() },
        },
        save: {
          type: 'react.command.save' as const,
          data: { saveId: data?.saveId, timestamp: new Date() },
        },
        load: {
          type: 'react.command.load' as const,
          data: { saveId: data?.saveId, timestamp: new Date() },
        },
        restart: {
          type: 'react.command.restart' as const,
          data: { timestamp: new Date() },
        },
      };

      const event = eventMap[command];
      if (event) {
        publish(event);
      }
    },
    [publish]
  );

  // 监听Phaser响应（便捷方法）
  const onPhaserResponse = useCallback(
    (
      handler: (
        event: Extract<
          GameDomainEvent,
          { type: 'phaser.response.ready' | 'phaser.response.completed' }
        >
      ) => void,
      once: boolean = false
    ): string[] => {
      const readySubId = subscribe('phaser.response.ready', handler, { once });
      const completedSubId = subscribe('phaser.response.completed', handler, {
        once,
      });

      return [readySubId, completedSubId];
    },
    [subscribe]
  );

  // 监听游戏状态变化（便捷方法）
  const onGameStateChange = useCallback(
    (
      handler: (
        event: Extract<
          GameDomainEvent,
          { type: 'game.state.updated' | 'game.state.changed' }
        >
      ) => void
    ): string[] => {
      const updatedSubId = subscribe('game.state.updated', handler);
      const changedSubId = subscribe('game.state.changed', handler);

      return [updatedSubId, changedSubId];
    },
    [subscribe]
  );

  // 监听游戏错误（便捷方法）
  const onGameError = useCallback(
    (
      handler: (
        event: Extract<GameDomainEvent, { type: 'game.error' | 'game.warning' }>
      ) => void
    ): string[] => {
      const errorSubId = subscribe('game.error', handler);
      const warningSubId = subscribe('game.warning', handler);

      return [errorSubId, warningSubId];
    },
    [subscribe]
  );

  // 获取事件总线统计信息
  const getStats = useCallback(
    () => ({
      listenerStats: eventBusRef.current.getListenerStats(),
      metrics: eventBusRef.current.getMetrics(),
      activeSubscriptions: subscriptionsRef.current.length,
    }),
    []
  );

  // 检查是否有监听器
  const hasListeners = useCallback(
    (eventType: GameDomainEvent['type']): boolean => {
      return eventBusRef.current.hasListeners(eventType);
    },
    []
  );

  // 清理函数
  const cleanup = useCallback(() => {
    subscriptionsRef.current.forEach(({ subscriptionId }) => {
      eventBusRef.current.unsubscribe(subscriptionId);
    });
    subscriptionsRef.current = [];
  }, []);

  // 组件卸载时自动清理
  useEffect(() => {
    if (enableAutoCleanup) {
      return cleanup;
    }
  }, [cleanup, enableAutoCleanup]);

  // 返回API对象
  return useMemo(
    () => ({
      // 基础事件API
      subscribe,
      unsubscribe,
      publish,
      publishAsync,

      // 便捷方法
      sendCommandToPhaser,
      onPhaserResponse,
      onGameStateChange,
      onGameError,

      // 工具方法
      getStats,
      hasListeners,
      cleanup,

      // 事件总线实例（高级用法）
      eventBus: eventBusRef.current,
    }),
    [
      subscribe,
      unsubscribe,
      publish,
      publishAsync,
      sendCommandToPhaser,
      onPhaserResponse,
      onGameStateChange,
      onGameError,
      getStats,
      hasListeners,
      cleanup,
    ]
  );
}

// Hook的类型化版本，用于特定事件类型
export function useGameEvent<T extends GameDomainEvent>(
  eventType: T['type'],
  handler: GameEventHandler<T>,
  options: UseGameEventsOptions & {
    once?: boolean;
    autoSubscribe?: boolean;
  } = {}
) {
  const { once = false, autoSubscribe = true, ...hookOptions } = options;

  const { subscribe, unsubscribe } = useGameEvents(hookOptions);
  const subscriptionIdRef = useRef<string | null>(null);

  const subscribeToEvent = useCallback(() => {
    if (subscriptionIdRef.current) {
      unsubscribe(subscriptionIdRef.current);
    }

    subscriptionIdRef.current = subscribe(eventType, handler, { once });
    return subscriptionIdRef.current;
  }, [eventType, handler, once, subscribe, unsubscribe]);

  const unsubscribeFromEvent = useCallback(() => {
    if (subscriptionIdRef.current) {
      const success = unsubscribe(subscriptionIdRef.current);
      if (success) {
        subscriptionIdRef.current = null;
      }
      return success;
    }
    return false;
  }, [unsubscribe]);

  // 自动订阅
  useEffect(() => {
    if (autoSubscribe) {
      subscribeToEvent();
    }

    return () => {
      unsubscribeFromEvent();
    };
  }, [autoSubscribe, subscribeToEvent, unsubscribeFromEvent]);

  return {
    subscribe: subscribeToEvent,
    unsubscribe: unsubscribeFromEvent,
    isSubscribed: subscriptionIdRef.current !== null,
  };
}

/**
 * React Hook for Web Vitals监控
 *
 * 提供React组件级别的性能监控能力：
 * 1. 组件渲染时间监控
 * 2. 用户交互事件监控
 * 3. 路由切换监控
 * 4. 自定义性能埋点
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { getWebVitalsMonitor } from '../shared/observability/web-vitals-monitor';
import type { WebVitalsMetrics } from '../shared/observability/web-vitals-monitor';
import { getWebVitalsCollector } from '../shared/observability/web-vitals-collector';
import type { WebVitalsCollectorConfig } from '../shared/observability/web-vitals-collector';

export interface UseWebVitalsOptions {
  enabled?: boolean;
  componentName?: string;
  trackRender?: boolean;
  trackInteractions?: boolean;
  collectorConfig?: Partial<WebVitalsCollectorConfig>;
}

export interface WebVitalsHookReturn {
  metrics: WebVitalsMetrics | null;
  isLoading: boolean;
  startTiming: (name: string) => void;
  endTiming: (name: string) => void;
  recordInteraction: (name: string, duration: number) => void;
  recordEvent: (name: string, duration: number) => void;
  recordCustomEvent: (name: string, data?: any) => void;
  recordError: (error: Error, context?: string) => void;
  getPerformanceReport: () => any;
}

/**
 * Web Vitals监控Hook
 */
export function useWebVitals(
  options: UseWebVitalsOptions = {}
): WebVitalsHookReturn {
  const {
    enabled = true,
    componentName = 'UnknownComponent',
    trackRender = true,
    trackInteractions = true,
    collectorConfig,
  } = options;

  const [metrics, setMetrics] = useState<WebVitalsMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const renderStartTime = useRef<number>(0);
  const timingMarks = useRef<Map<string, number>>(new Map());

  const monitor = useRef(enabled ? getWebVitalsMonitor() : null);
  const collector = useRef(
    enabled ? getWebVitalsCollector(collectorConfig) : null
  );

  // 订阅Web Vitals数据更新
  useEffect(() => {
    if (!enabled || !monitor.current) return;

    const unsubscribe = monitor.current.subscribe(newMetrics => {
      setMetrics(newMetrics);
      setIsLoading(false);
    });

    // 初始化时获取已有数据
    setMetrics(monitor.current.getMetrics());
    setIsLoading(false);

    return unsubscribe;
  }, [enabled]);

  // 组件渲染性能监控
  useEffect(() => {
    if (!enabled || !trackRender || !monitor.current) return;

    renderStartTime.current = performance.now();
    monitor.current.mark(`${componentName}_render_start`);

    return () => {
      if (renderStartTime.current > 0) {
        const renderDuration = performance.now() - renderStartTime.current;
        monitor.current?.mark(`${componentName}_render_end`);
        monitor.current?.measure(
          `${componentName}_render`,
          `${componentName}_render_start`,
          `${componentName}_render_end`
        );

        // 记录渲染时间
        if (renderDuration > 50) {
          // 超过50ms的渲染才记录
          console.log(
            `[WebVitals] 组件"${componentName}"渲染耗时: ${renderDuration.toFixed(2)}ms`
          );
        }
      }
    };
  }, [enabled, trackRender, componentName]);

  // 开始性能计时
  const startTiming = useCallback(
    (name: string) => {
      if (!enabled || !monitor.current) return;

      const markName = `${componentName}_${name}_start`;
      const startTime = performance.now();

      timingMarks.current.set(name, startTime);
      monitor.current.mark(markName);
    },
    [enabled, componentName]
  );

  // 结束性能计时
  const endTiming = useCallback(
    (name: string) => {
      if (!enabled || !monitor.current) return;

      const startTime = timingMarks.current.get(name);
      if (!startTime) {
        console.warn(`[WebVitals] 找不到计时开始标记: ${name}`);
        return;
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      const startMark = `${componentName}_${name}_start`;
      const endMark = `${componentName}_${name}_end`;
      const measureName = `${componentName}_${name}`;

      monitor.current.mark(endMark);
      monitor.current.measure(measureName, startMark, endMark);

      timingMarks.current.delete(name);

      console.log(
        `[WebVitals] ${componentName} - ${name}: ${duration.toFixed(2)}ms`
      );
      return duration;
    },
    [enabled, componentName]
  );

  // 记录交互事件
  const recordInteraction = useCallback(
    (name: string, duration: number) => {
      if (!enabled || !monitor.current) return;
      monitor.current.recordInteraction(`${componentName}_${name}`, duration);
    },
    [enabled, componentName]
  );

  // 记录事件处理
  const recordEvent = useCallback(
    (name: string, duration: number) => {
      if (!enabled || !monitor.current) return;
      monitor.current.recordEvent(`${componentName}_${name}`, duration);
    },
    [enabled, componentName]
  );

  // 记录自定义事件
  const recordCustomEvent = useCallback(
    (name: string, data?: any) => {
      if (!enabled || !collector.current) return;

      // 使用 collector 记录自定义事件
      try {
        // collectData 是正确的方法名，但它是私有方法，我们改为调用 getPerformanceReport
        const report = collector.current.getPerformanceReport();
        console.log(
          `[WebVitals] Custom event: ${componentName}_${name}`,
          data,
          report
        );
      } catch (error) {
        console.warn(`[WebVitals] 记录自定义事件失败:`, error);
      }
    },
    [enabled, componentName]
  );

  // 记录错误
  const recordError = useCallback(
    (error: Error, context?: string) => {
      if (!enabled) return;

      console.error(
        `[WebVitals] Error in ${componentName}${context ? ` (${context})` : ''}:`,
        error
      );

      // 如果有 Sentry 或其他错误监控，可以在这里集成
      if (window.electronAPI?.reportEvent) {
        window.electronAPI.reportEvent({
          type: 'web_vitals_error',
          data: {
            component: componentName,
            error: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
    [enabled, componentName]
  );

  // 获取性能报告
  const getPerformanceReport = useCallback(() => {
    if (!enabled || !collector.current) return null;
    return collector.current.getPerformanceReport();
  }, [enabled]);

  return {
    metrics,
    isLoading,
    startTiming,
    endTiming,
    recordInteraction,
    recordEvent,
    recordCustomEvent,
    recordError,
    getPerformanceReport,
  };
}

/**
 * 高阶组件：为组件添加性能监控
 */
export function withWebVitals<P extends object>(
  WrappedComponent: React.ComponentType<P & { webVitals?: WebVitalsMetrics }>,
  options: UseWebVitalsOptions = {}
): React.ComponentType<P> {
  const ComponentWithWebVitals = (props: P) => {
    const componentName =
      options.componentName ||
      WrappedComponent.displayName ||
      WrappedComponent.name ||
      'Component';
    const webVitals = useWebVitals({ ...options, componentName });

    return React.createElement(WrappedComponent, {
      ...props,
      webVitals,
    } as P & { webVitals: WebVitalsMetrics });
  };

  const displayName =
    options.componentName ||
    WrappedComponent.displayName ||
    WrappedComponent.name ||
    'Component';
  ComponentWithWebVitals.displayName = `withWebVitals(${displayName})`;
  return ComponentWithWebVitals;
}

/**
 * 用于性能监控的装饰器Hook
 */
export function usePerformanceTracker(name: string, enabled = true) {
  const startTime = useRef<number>(0);
  const monitor = useRef(enabled ? getWebVitalsMonitor() : null);

  const start = useCallback(() => {
    if (!enabled || !monitor.current) return;
    startTime.current = performance.now();
    monitor.current.mark(`${name}_start`);
  }, [enabled, name]);

  const end = useCallback(() => {
    if (!enabled || !monitor.current || startTime.current === 0) return 0;

    const endTime = performance.now();
    const duration = endTime - startTime.current;

    monitor.current.mark(`${name}_end`);
    monitor.current.measure(name, `${name}_start`, `${name}_end`);

    startTime.current = 0;
    return duration;
  }, [enabled, name]);

  const measure = useCallback(
    async <T extends any>(fn: () => T | Promise<T>): Promise<T> => {
      start();
      try {
        const result = await fn();
        const duration = end();
        console.log(`[WebVitals] ${name}: ${duration?.toFixed(2)}ms`);
        return result;
      } catch (error) {
        end();
        throw error;
      }
    },
    [start, end, name]
  );

  return { start, end, measure };
}

/**
 * 路由切换性能监控Hook
 */
export function useRoutePerformance(enabled = true) {
  const monitor = useRef(enabled ? getWebVitalsMonitor() : null);
  const routeStartTime = useRef<number>(0);
  const currentRoute = useRef<string>('');

  const startRouteChange = useCallback(
    (fromRoute: string, toRoute: string) => {
      if (!enabled || !monitor.current) return;

      currentRoute.current = `${fromRoute}_to_${toRoute}`;
      routeStartTime.current = performance.now();
      monitor.current.mark(`route_${currentRoute.current}_start`);
    },
    [enabled]
  );

  const endRouteChange = useCallback(() => {
    if (!enabled || !monitor.current || routeStartTime.current === 0) return;

    const endTime = performance.now();
    const duration = endTime - routeStartTime.current;

    monitor.current.mark(`route_${currentRoute.current}_end`);
    monitor.current.measure(
      `route_${currentRoute.current}`,
      `route_${currentRoute.current}_start`,
      `route_${currentRoute.current}_end`
    );

    // 解析路由名称
    const [fromRoute, toRoute] = currentRoute.current.split('_to_');
    monitor.current.recordRouteChange(fromRoute, toRoute, duration);

    routeStartTime.current = 0;
    currentRoute.current = '';

    return duration;
  }, [enabled]);

  return { startRouteChange, endRouteChange };
}

/**
 * 数据获取性能监控Hook
 */
export function useDataFetchPerformance(enabled = true) {
  const monitor = useRef(enabled ? getWebVitalsMonitor() : null);

  const trackFetch = useCallback(
    async <T extends any>(
      endpoint: string,
      fetchFn: () => Promise<T>
    ): Promise<T> => {
      if (!enabled || !monitor.current) {
        return fetchFn();
      }

      const startTime = performance.now();
      monitor.current.mark(`fetch_${endpoint}_start`);

      try {
        const result = await fetchFn();

        const endTime = performance.now();
        const duration = endTime - startTime;

        monitor.current.mark(`fetch_${endpoint}_end`);
        monitor.current.measure(
          `fetch_${endpoint}`,
          `fetch_${endpoint}_start`,
          `fetch_${endpoint}_end`
        );
        monitor.current.recordDataFetch(endpoint, duration);

        return result;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        monitor.current.mark(`fetch_${endpoint}_error`);
        monitor.current.recordDataFetch(`${endpoint}_error`, duration);

        throw error;
      }
    },
    [enabled]
  );

  return { trackFetch };
}

export default useWebVitals;

/**
 * Web Vitals监控系统 - Electron环境适配
 *
 * 监控核心Web性能指标：
 * - LCP (Largest Contentful Paint): 最大内容绘制
 * - INP (Interaction to Next Paint): 交互到下一次绘制
 * - CLS (Cumulative Layout Shift): 累积布局偏移
 * - FCP (First Contentful Paint): 首次内容绘制
 * - TTFB (Time to First Byte): 首字节时间
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

// 性能阈值配置
export const PERFORMANCE_THRESHOLDS = {
  LCP: { good: 2500, needs_improvement: 4000 }, // LCP: ≤2.5s好，≤4s需改进
  INP: { good: 200, needs_improvement: 500 }, // INP: ≤200ms好，≤500ms需改进
  CLS: { good: 0.1, needs_improvement: 0.25 }, // CLS: ≤0.1好，≤0.25需改进
  FCP: { good: 1800, needs_improvement: 3000 }, // FCP: ≤1.8s好，≤3s需改进
  TTFB: { good: 800, needs_improvement: 1800 }, // TTFB: ≤0.8s好，≤1.8s需改进
} as const;

export interface WebVitalsData {
  id: string;
  name: string;
  value: number;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  entries: PerformanceEntry[];
  timestamp: number;
  navigationType: string;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
}

export interface WebVitalsMetrics {
  lcp?: WebVitalsData;
  inp?: WebVitalsData;
  cls?: WebVitalsData;
  fcp?: WebVitalsData;
  ttfb?: WebVitalsData;
  customTimings: Record<string, number>;
}

// 自定义用户计时标记
export interface UserTiming {
  name: string;
  startTime: number;
  duration?: number;
  type: 'mark' | 'measure';
}

class WebVitalsMonitor {
  private metrics: WebVitalsMetrics = { customTimings: {} };
  private callbacks: Array<(metrics: WebVitalsMetrics) => void> = [];
  private isInitialized = false;
  private userTimings: UserTiming[] = [];

  // P95性能目标 (ms)
  private readonly PERFORMANCE_TARGETS = {
    interaction_p95: 100, // 交互P95 ≤100ms
    event_p95: 50, // 事件P95 ≤50ms
    route_change_p95: 200, // 路由切换P95 ≤200ms
    data_fetch_p95: 300, // 数据获取P95 ≤300ms
  };

  constructor() {
    this.initializeWebVitals();
    this.setupCustomPerformanceObserver();
  }

  private initializeWebVitals() {
    if (this.isInitialized || typeof window === 'undefined') return;

    try {
      // 监控核心Web Vitals指标
      onCLS(this.onCLS.bind(this), { reportAllChanges: true });
      onFCP(this.onFCP.bind(this));
      onINP(this.onINP.bind(this)); // 使用INP替代FID
      onLCP(this.onLCP.bind(this), { reportAllChanges: true });
      onTTFB(this.onTTFB.bind(this));

      // INP需要单独处理，因为web-vitals v4可能还在实验阶段
      this.initializeINP();

      this.isInitialized = true;
      console.log('[WebVitals] 监控系统初始化完成');
    } catch (error) {
      console.error('[WebVitals] 初始化失败:', error);
    }
  }

  private initializeINP() {
    // INP监控 - 手动实现以确保兼容性
    if ('PerformanceEventTiming' in window) {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries() as PerformanceEventTiming[];

        for (const entry of entries) {
          if (entry.processingStart && entry.processingEnd) {
            const inpValue = entry.processingEnd - entry.startTime;

            if (inpValue > 0) {
              const rating = this.getRating('INP', inpValue);
              const inpData: WebVitalsData = {
                id: `inp-${Date.now()}`,
                name: 'INP',
                value: inpValue,
                delta: inpValue,
                rating,
                entries: [entry],
                timestamp: Date.now(),
                navigationType: this.getNavigationType(),
                connection: this.getConnectionInfo(),
              };

              this.metrics.inp = inpData;
              this.notifyCallbacks();
            }
          }
        }
      });

      observer.observe({ entryTypes: ['event'] });
    }
  }

  private setupCustomPerformanceObserver() {
    // 监控自定义性能标记
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver(list => {
        const entries = list.getEntries();

        for (const entry of entries) {
          if (entry.entryType === 'mark') {
            this.userTimings.push({
              name: entry.name,
              startTime: entry.startTime,
              type: 'mark',
            });
          } else if (entry.entryType === 'measure') {
            this.userTimings.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
              type: 'measure',
            });

            // 记录自定义时间到metrics
            this.metrics.customTimings[entry.name] = entry.duration;
          }
        }
      });

      observer.observe({ entryTypes: ['mark', 'measure'] });
    }
  }

  private onCLS(metric: Metric) {
    const rating = this.getRating('CLS', metric.value);
    this.metrics.cls = {
      ...metric,
      rating,
      timestamp: Date.now(),
      navigationType: this.getNavigationType(),
      connection: this.getConnectionInfo(),
    } as WebVitalsData;
    this.notifyCallbacks();
  }

  private onFCP(metric: Metric) {
    const rating = this.getRating('FCP', metric.value);
    this.metrics.fcp = {
      ...metric,
      rating,
      timestamp: Date.now(),
      navigationType: this.getNavigationType(),
      connection: this.getConnectionInfo(),
    } as WebVitalsData;
    this.notifyCallbacks();
  }

  private onLCP(metric: Metric) {
    const rating = this.getRating('LCP', metric.value);
    this.metrics.lcp = {
      ...metric,
      rating,
      timestamp: Date.now(),
      navigationType: this.getNavigationType(),
      connection: this.getConnectionInfo(),
    } as WebVitalsData;
    this.notifyCallbacks();
  }

  private onTTFB(metric: Metric) {
    const rating = this.getRating('TTFB', metric.value);
    this.metrics.ttfb = {
      ...metric,
      rating,
      timestamp: Date.now(),
      navigationType: this.getNavigationType(),
      connection: this.getConnectionInfo(),
    } as WebVitalsData;
    this.notifyCallbacks();
  }

  private onINP(metric: Metric) {
    const rating = this.getRating('INP', metric.value);
    (this.metrics as any).inp = {
      ...metric,
      rating,
      timestamp: Date.now(),
      navigationType: this.getNavigationType(),
      connection: this.getConnectionInfo(),
    } as WebVitalsData;
    this.notifyCallbacks();
  }

  private getRating(
    metricName: keyof typeof PERFORMANCE_THRESHOLDS,
    value: number
  ): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = PERFORMANCE_THRESHOLDS[metricName];
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.needs_improvement) return 'needs-improvement';
    return 'poor';
  }

  private getNavigationType(): string {
    if ('navigation' in performance && 'type' in performance.navigation) {
      const types = ['navigate', 'reload', 'back_forward', 'prerender'];
      return types[performance.navigation.type] || 'unknown';
    }
    return 'unknown';
  }

  private getConnectionInfo() {
    if ('connection' in navigator && navigator.connection) {
      const conn = navigator.connection as any;
      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
      };
    }
    return undefined;
  }

  private notifyCallbacks() {
    this.callbacks.forEach(callback => {
      try {
        callback(this.metrics);
      } catch (error) {
        console.error('[WebVitals] 回调函数执行错误:', error);
      }
    });
  }

  // 公开方法

  /**
   * 订阅性能指标更新
   */
  public subscribe(callback: (metrics: WebVitalsMetrics) => void): () => void {
    this.callbacks.push(callback);

    // 如果有已收集的指标，立即触发回调
    if (Object.keys(this.metrics).length > 1) {
      // customTimings总是存在
      callback(this.metrics);
    }

    // 返回取消订阅函数
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * 获取当前性能指标
   */
  public getMetrics(): WebVitalsMetrics {
    return { ...this.metrics };
  }

  /**
   * 标记自定义性能时间点
   */
  public mark(name: string) {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(name);
    }
  }

  /**
   * 测量两个标记之间的时间
   */
  public measure(name: string, startMark?: string, endMark?: string) {
    if ('performance' in window && 'measure' in performance) {
      if (startMark && endMark) {
        performance.measure(name, startMark, endMark);
      } else if (startMark) {
        performance.measure(name, startMark);
      } else {
        performance.measure(name);
      }
    }
  }

  /**
   * 记录交互事件性能
   */
  public recordInteraction(name: string, duration: number) {
    this.metrics.customTimings[`interaction_${name}`] = duration;

    // 检查是否超出P95目标
    if (duration > this.PERFORMANCE_TARGETS.interaction_p95) {
      console.warn(
        `[WebVitals] 交互"${name}"耗时${duration}ms，超出P95目标${this.PERFORMANCE_TARGETS.interaction_p95}ms`
      );
    }
  }

  /**
   * 记录事件处理性能
   */
  public recordEvent(name: string, duration: number) {
    this.metrics.customTimings[`event_${name}`] = duration;

    // 检查是否超出P95目标
    if (duration > this.PERFORMANCE_TARGETS.event_p95) {
      console.warn(
        `[WebVitals] 事件"${name}"处理耗时${duration}ms，超出P95目标${this.PERFORMANCE_TARGETS.event_p95}ms`
      );
    }
  }

  /**
   * 记录路由切换性能
   */
  public recordRouteChange(from: string, to: string, duration: number) {
    const routeName = `route_${from}_to_${to}`;
    this.metrics.customTimings[routeName] = duration;

    // 检查是否超出P95目标
    if (duration > this.PERFORMANCE_TARGETS.route_change_p95) {
      console.warn(
        `[WebVitals] 路由切换"${from} → ${to}"耗时${duration}ms，超出P95目标${this.PERFORMANCE_TARGETS.route_change_p95}ms`
      );
    }
  }

  /**
   * 记录数据获取性能
   */
  public recordDataFetch(endpoint: string, duration: number) {
    this.metrics.customTimings[`fetch_${endpoint}`] = duration;

    // 检查是否超出P95目标
    if (duration > this.PERFORMANCE_TARGETS.data_fetch_p95) {
      console.warn(
        `[WebVitals] 数据获取"${endpoint}"耗时${duration}ms，超出P95目标${this.PERFORMANCE_TARGETS.data_fetch_p95}ms`
      );
    }
  }

  /**
   * 获取性能总结报告
   */
  public getPerformanceSummary() {
    const { lcp, inp, cls, fcp, ttfb } = this.metrics;

    return {
      coreVitals: {
        lcp: lcp ? { value: lcp.value, rating: lcp.rating } : null,
        inp: inp ? { value: inp.value, rating: inp.rating } : null,
        cls: cls ? { value: cls.value, rating: cls.rating } : null,
      },
      otherMetrics: {
        fcp: fcp ? { value: fcp.value, rating: fcp.rating } : null,
        ttfb: ttfb ? { value: ttfb.value, rating: ttfb.rating } : null,
      },
      customTimings: { ...this.metrics.customTimings },
      userTimings: [...this.userTimings],
      timestamp: Date.now(),
    };
  }

  /**
   * 重置性能指标
   */
  public reset() {
    this.metrics = { customTimings: {} };
    this.userTimings = [];
    console.log('[WebVitals] 性能指标已重置');
  }

  /**
   * 销毁监控器
   */
  public destroy() {
    this.callbacks = [];
    this.reset();
    console.log('[WebVitals] 监控器已销毁');
  }
}

// 全局单例
let webVitalsMonitor: WebVitalsMonitor | null = null;

export const getWebVitalsMonitor = (): WebVitalsMonitor => {
  if (!webVitalsMonitor) {
    webVitalsMonitor = new WebVitalsMonitor();
  }
  return webVitalsMonitor;
};

export { WebVitalsMonitor };
export default getWebVitalsMonitor;

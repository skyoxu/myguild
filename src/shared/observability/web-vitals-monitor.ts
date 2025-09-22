/**
 * Web Vitals - Electron
 *
 * Web
 * - LCP (Largest Contentful Paint):
 * - INP (Interaction to Next Paint):
 * - CLS (Cumulative Layout Shift):
 * - FCP (First Contentful Paint):
 * - TTFB (Time to First Byte):
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

//
export const PERFORMANCE_THRESHOLDS = {
  LCP: { good: 2500, needs_improvement: 4000 }, // LCP: 2.5s4s
  INP: { good: 200, needs_improvement: 500 }, // INP: 200ms500ms
  CLS: { good: 0.1, needs_improvement: 0.25 }, // CLS: 0.10.25
  FCP: { good: 1800, needs_improvement: 3000 }, // FCP: 1.8s3s
  TTFB: { good: 800, needs_improvement: 1800 }, // TTFB: 0.8s1.8s
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

//
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

  // P95 (ms)
  private readonly PERFORMANCE_TARGETS = {
    interaction_p95: 100, // P95 100ms
    event_p95: 50, // P95 50ms
    route_change_p95: 200, // P95 200ms
    data_fetch_p95: 300, // P95 300ms
  };

  constructor() {
    this.initializeWebVitals();
    this.setupCustomPerformanceObserver();
  }

  private initializeWebVitals() {
    if (this.isInitialized || typeof window === 'undefined') return;

    try {
      // Web Vitals
      onCLS(this.onCLS.bind(this), { reportAllChanges: true });
      onFCP(this.onFCP.bind(this));
      onINP(this.onINP.bind(this)); // INPFID
      onLCP(this.onLCP.bind(this), { reportAllChanges: true });
      onTTFB(this.onTTFB.bind(this));

      // INPweb-vitals v4
      this.initializeINP();

      this.isInitialized = true;
      console.log('[WebVitals] ');
    } catch (error) {
      console.error('[WebVitals] :', error);
    }
  }

  private initializeINP() {
    // INP -
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
    //
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

            // metrics
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
        console.error('[WebVitals] :', error);
      }
    });
  }

  //

  /**
   *
   */
  public subscribe(callback: (metrics: WebVitalsMetrics) => void): () => void {
    this.callbacks.push(callback);

    //
    if (Object.keys(this.metrics).length > 1) {
      // customTimings
      callback(this.metrics);
    }

    //
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   *
   */
  public getMetrics(): WebVitalsMetrics {
    return { ...this.metrics };
  }

  /**
   *
   */
  public mark(name: string) {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(name);
    }
  }

  /**
   *
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
   *
   */
  public recordInteraction(name: string, duration: number) {
    this.metrics.customTimings[`interaction_${name}`] = duration;

    // P95
    if (duration > this.PERFORMANCE_TARGETS.interaction_p95) {
      console.warn(
        `[WebVitals] 交互"${name}"耗时${duration}ms，超出P95目标${this.PERFORMANCE_TARGETS.interaction_p95}ms`
      );
    }
  }

  /**
   *
   */
  public recordEvent(name: string, duration: number) {
    this.metrics.customTimings[`event_${name}`] = duration;

    // P95
    if (duration > this.PERFORMANCE_TARGETS.event_p95) {
      console.warn(
        `[WebVitals] 事件"${name}"处理耗时${duration}ms，超出P95目标${this.PERFORMANCE_TARGETS.event_p95}ms`
      );
    }
  }

  /**
   *
   */
  public recordRouteChange(from: string, to: string, duration: number) {
    const routeName = `route_${from}_to_${to}`;
    this.metrics.customTimings[routeName] = duration;

    // P95
    if (duration > this.PERFORMANCE_TARGETS.route_change_p95) {
      console.warn(
        `[WebVitals] 路由切换"${from}  ${to}"耗时${duration}ms，超出P95目标${this.PERFORMANCE_TARGETS.route_change_p95}ms`
      );
    }
  }

  /**
   *
   */
  public recordDataFetch(endpoint: string, duration: number) {
    this.metrics.customTimings[`fetch_${endpoint}`] = duration;

    // P95
    if (duration > this.PERFORMANCE_TARGETS.data_fetch_p95) {
      console.warn(
        `[WebVitals] 数据获取"${endpoint}"耗时${duration}ms，超出P95目标${this.PERFORMANCE_TARGETS.data_fetch_p95}ms`
      );
    }
  }

  /**
   *
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
   *
   */
  public reset() {
    this.metrics = { customTimings: {} };
    this.userTimings = [];
    console.log('[WebVitals] ');
  }

  /**
   *
   */
  public destroy() {
    this.callbacks = [];
    this.reset();
    console.log('[WebVitals] ');
  }
}

//
let webVitalsMonitor: WebVitalsMonitor | null = null;

export const getWebVitalsMonitor = (): WebVitalsMonitor => {
  if (!webVitalsMonitor) {
    webVitalsMonitor = new WebVitalsMonitor();
  }
  return webVitalsMonitor;
};

export { WebVitalsMonitor };
export default getWebVitalsMonitor;

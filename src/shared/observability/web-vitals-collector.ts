/**
 * Web Vitals
 *
 *
 * 1. Web Vitals
 * 2. Sentry
 * 3.
 * 4. 7
 */

import * as Sentry from '@sentry/browser';
import {
  getWebVitalsMonitor,
  type WebVitalsMetrics,
  type WebVitalsData,
} from './web-vitals-monitor';

export interface WebVitalsCollectorConfig {
  enabled: boolean;
  sentryEnabled: boolean;
  batchSize: number;
  flushInterval: number; // ms
  storageKey: string;
  baselineWindow: number; //
  regressionThreshold: number; //
}

export interface WebVitalsDataPoint {
  timestamp: number;
  sessionId: string;
  userId?: string;
  metrics: WebVitalsMetrics;
  context: {
    userAgent: string;
    viewport: { width: number; height: number };
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
    };
    navigation: {
      type: string;
      redirectCount: number;
    };
    memory?: {
      usedJSHeapSize?: number;
      totalJSHeapSize?: number;
    };
  };
}

export interface WebVitalsBaseline {
  lcp_p95: number;
  inp_p95: number;
  cls_p95: number;
  fcp_p95: number;
  ttfb_p95: number;
  sampleSize: number;
  windowStart: number;
  windowEnd: number;
  lastUpdated: number;
}

export interface RegressionAlert {
  metric: string;
  currentValue: number;
  baselineValue: number;
  regressionPercentage: number;
  severity: 'warning' | 'critical';
  timestamp: number;
}

class WebVitalsCollector {
  private config: WebVitalsCollectorConfig;
  private dataBuffer: WebVitalsDataPoint[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private isEnabled = false;
  private monitor = getWebVitalsMonitor();
  private unsubscribe: (() => void) | null = null;

  private readonly DEFAULT_CONFIG: WebVitalsCollectorConfig = {
    enabled: true,
    sentryEnabled: true,
    batchSize: 10,
    flushInterval: 30000, // 30
    storageKey: 'web-vitals-data',
    baselineWindow: 7, // 7
    regressionThreshold: 15, // 15%
  };

  constructor(config: Partial<WebVitalsCollectorConfig> = {}) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();

    if (this.config.enabled && typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    try {
      // Web Vitals
      this.unsubscribe = this.monitor.subscribe(metrics => {
        this.collectData(metrics);
      });

      //
      this.setupFlushTimer();

      //
      this.setupUnloadHandler();

      //
      this.cleanupOldData();

      this.isEnabled = true;
      console.log('[WebVitalsCollector] ');
    } catch (error) {
      console.error('[WebVitalsCollector] :', error);
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private collectData(metrics: WebVitalsMetrics) {
    if (!this.isEnabled) return;

    const dataPoint: WebVitalsDataPoint = {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.getUserId(),
      metrics,
      context: this.collectContext(),
    };

    this.dataBuffer.push(dataPoint);

    //
    if (this.dataBuffer.length >= this.config.batchSize) {
      this.flush();
    }

    //
    this.checkRegression(dataPoint);
  }

  private collectContext() {
    const context: WebVitalsDataPoint['context'] = {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      navigation: {
        type: 'navigate',
        redirectCount: 0,
      },
    };

    //
    if ('connection' in navigator && navigator.connection) {
      const conn = navigator.connection as any;
      context.connection = {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
      };
    }

    //
    if ('navigation' in performance) {
      const nav = performance.navigation;
      context.navigation = {
        type:
          ['navigate', 'reload', 'back_forward', 'prerender'][nav.type] ||
          'navigate',
        redirectCount: nav.redirectCount,
      };
    }

    //
    if ('memory' in performance) {
      const mem = (performance as any).memory;
      context.memory = {
        usedJSHeapSize: mem.usedJSHeapSize,
        totalJSHeapSize: mem.totalJSHeapSize,
      };
    }

    return context;
  }

  private getUserId(): string | undefined {
    // ID
    try {
      // localStorage
      const userId =
        localStorage.getItem('userId') ||
        localStorage.getItem('user_id') ||
        sessionStorage.getItem('userId');

      if (userId) return userId;

      // cookies
      const match = document.cookie.match(/user_id=([^;]+)/);
      if (match) return match[1];

      return undefined;
    } catch {
      return undefined;
    }
  }

  private setupFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.dataBuffer.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  private setupUnloadHandler() {
    //
    const handleUnload = () => {
      if (this.dataBuffer.length > 0) {
        this.flushSync();
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    // Electron
    if (window.electronAPI) {
      // API
    }
  }

  private flush() {
    if (this.dataBuffer.length === 0) return;

    const data = [...this.dataBuffer];
    this.dataBuffer = [];

    Promise.all([
      this.sendToSentry(data),
      this.saveToLocalStorage(data),
      this.sendToCustomEndpoint(data),
    ]).catch(error => {
      console.error('[WebVitalsCollector] :', error);
      //
      this.dataBuffer.unshift(...data);
    });
  }

  private flushSync() {
    //
    if (this.dataBuffer.length === 0) return;

    const data = JSON.stringify(this.dataBuffer);

    try {
      // sendBeacon
      if ('sendBeacon' in navigator) {
        const endpoint = '/api/web-vitals'; // API
        navigator.sendBeacon(endpoint, data);
      }

      // localStorage
      this.saveToLocalStorageSync(this.dataBuffer);
    } catch (error) {
      console.error('[WebVitalsCollector] :', error);
    }

    this.dataBuffer = [];
  }

  private async sendToSentry(data: WebVitalsDataPoint[]) {
    if (!this.config.sentryEnabled) return;

    try {
      data.forEach(point => {
        // Web VitalsSentry
        if (point.metrics.lcp) {
          this.sendMetricToSentry('LCP', point.metrics.lcp, point);
        }
        if (point.metrics.inp) {
          this.sendMetricToSentry('INP', point.metrics.inp, point);
        }
        if (point.metrics.cls) {
          this.sendMetricToSentry('CLS', point.metrics.cls, point);
        }
        if (point.metrics.fcp) {
          this.sendMetricToSentry('FCP', point.metrics.fcp, point);
        }
        if (point.metrics.ttfb) {
          this.sendMetricToSentry('TTFB', point.metrics.ttfb, point);
        }

        //
        Object.entries(point.metrics.customTimings).forEach(([name, value]) => {
          Sentry.addBreadcrumb({
            category: 'performance',
            message: `Custom timing: ${name}`,
            level: 'info',
            data: { value, sessionId: point.sessionId },
          });
        });
      });
    } catch (error) {
      console.error('[WebVitalsCollector] Sentry:', error);
      throw error;
    }
  }

  private sendMetricToSentry(
    name: string,
    metric: WebVitalsData,
    point: WebVitalsDataPoint
  ) {
    // Sentry
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `Web Vital: ${name}`,
      level:
        metric.rating === 'good'
          ? 'info'
          : metric.rating === 'needs-improvement'
            ? 'warning'
            : 'error',
      data: {
        value: metric.value,
        rating: metric.rating,
        sessionId: point.sessionId,
        connection: point.context.connection,
        viewport: point.context.viewport,
      },
    });

    //
    if (metric.rating === 'poor') {
      Sentry.captureMessage(`Poor ${name}: ${metric.value}`, {
        level: 'warning',
        tags: {
          webVital: name,
          rating: metric.rating,
        },
        extra: {
          metric,
          context: point.context,
        },
      });
    }
  }

  private async sendToCustomEndpoint(data: WebVitalsDataPoint[]) {
    // API
    try {
      const endpoint = '/api/web-vitals';
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (error) {
      //
      console.warn('[WebVitalsCollector] :', error);
    }
  }

  private saveToLocalStorage(data: WebVitalsDataPoint[]) {
    try {
      const existing = this.getStoredData();
      const combined = [...existing, ...data];

      // 1000
      const trimmed = combined.slice(-1000);

      localStorage.setItem(this.config.storageKey, JSON.stringify(trimmed));
    } catch (error) {
      console.error('[WebVitalsCollector] :', error);
    }
  }

  private saveToLocalStorageSync(data: WebVitalsDataPoint[]) {
    try {
      const existing = this.getStoredData();
      const combined = [...existing, ...data];
      const trimmed = combined.slice(-1000);
      localStorage.setItem(this.config.storageKey, JSON.stringify(trimmed));
    } catch (error) {
      console.error('[WebVitalsCollector] :', error);
    }
  }

  private getStoredData(): WebVitalsDataPoint[] {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private cleanupOldData() {
    try {
      const data = this.getStoredData();
      const cutoff =
        Date.now() - this.config.baselineWindow * 24 * 60 * 60 * 1000;
      const filtered = data.filter(point => point.timestamp > cutoff);

      if (filtered.length !== data.length) {
        localStorage.setItem(this.config.storageKey, JSON.stringify(filtered));
        console.log(
          `[WebVitalsCollector] 清理了${data.length - filtered.length}条旧数据`
        );
      }
    } catch (error) {
      console.error('[WebVitalsCollector] :', error);
    }
  }

  private checkRegression(dataPoint: WebVitalsDataPoint) {
    try {
      const baseline = this.getBaseline();
      if (!baseline) return;

      const regressions: RegressionAlert[] = [];

      // LCP
      if (dataPoint.metrics.lcp && baseline.lcp_p95) {
        const regression = this.calculateRegression(
          dataPoint.metrics.lcp.value,
          baseline.lcp_p95
        );
        if (regression > this.config.regressionThreshold) {
          regressions.push({
            metric: 'LCP',
            currentValue: dataPoint.metrics.lcp.value,
            baselineValue: baseline.lcp_p95,
            regressionPercentage: regression,
            severity: regression > 30 ? 'critical' : 'warning',
            timestamp: Date.now(),
          });
        }
      }

      // INP
      if (dataPoint.metrics.inp && baseline.inp_p95) {
        const regression = this.calculateRegression(
          dataPoint.metrics.inp.value,
          baseline.inp_p95
        );
        if (regression > this.config.regressionThreshold) {
          regressions.push({
            metric: 'INP',
            currentValue: dataPoint.metrics.inp.value,
            baselineValue: baseline.inp_p95,
            regressionPercentage: regression,
            severity: regression > 30 ? 'critical' : 'warning',
            timestamp: Date.now(),
          });
        }
      }

      // CLS
      if (dataPoint.metrics.cls && baseline.cls_p95) {
        const regression = this.calculateRegression(
          dataPoint.metrics.cls.value,
          baseline.cls_p95
        );
        if (regression > this.config.regressionThreshold) {
          regressions.push({
            metric: 'CLS',
            currentValue: dataPoint.metrics.cls.value,
            baselineValue: baseline.cls_p95,
            regressionPercentage: regression,
            severity: regression > 50 ? 'critical' : 'warning',
            timestamp: Date.now(),
          });
        }
      }

      //
      if (regressions.length > 0) {
        this.reportRegressions(regressions);
      }
    } catch (error) {
      console.error('[WebVitalsCollector] :', error);
    }
  }

  private calculateRegression(
    currentValue: number,
    baselineValue: number
  ): number {
    return ((currentValue - baselineValue) / baselineValue) * 100;
  }

  private reportRegressions(regressions: RegressionAlert[]) {
    regressions.forEach(regression => {
      console.warn(
        `[WebVitalsCollector] ${regression.metric}性能回归检测:`,
        regression
      );

      // Sentry
      if (this.config.sentryEnabled) {
        Sentry.captureMessage(`Web Vitals回归: ${regression.metric}`, {
          level: regression.severity === 'critical' ? 'error' : 'warning',
          tags: {
            regression: true,
            metric: regression.metric,
            severity: regression.severity,
          },
          extra: regression as any,
        });
      }
    });
  }

  //

  /**
   *
   */
  public getBaseline(): WebVitalsBaseline | null {
    try {
      const stored = localStorage.getItem(`${this.config.storageKey}-baseline`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   *
   */
  public updateBaseline(): WebVitalsBaseline | null {
    try {
      const data = this.getStoredData();
      const cutoff =
        Date.now() - this.config.baselineWindow * 24 * 60 * 60 * 1000;
      const recentData = data.filter(point => point.timestamp > cutoff);

      if (recentData.length < 10) {
        console.warn('[WebVitalsCollector] ');
        return null;
      }

      const lcpValues = recentData
        .filter(d => d.metrics.lcp)
        .map(d => d.metrics.lcp!.value);
      const inpValues = recentData
        .filter(d => d.metrics.inp)
        .map(d => d.metrics.inp!.value);
      const clsValues = recentData
        .filter(d => d.metrics.cls)
        .map(d => d.metrics.cls!.value);
      const fcpValues = recentData
        .filter(d => d.metrics.fcp)
        .map(d => d.metrics.fcp!.value);
      const ttfbValues = recentData
        .filter(d => d.metrics.ttfb)
        .map(d => d.metrics.ttfb!.value);

      const baseline: WebVitalsBaseline = {
        lcp_p95: this.calculateP95(lcpValues),
        inp_p95: this.calculateP95(inpValues),
        cls_p95: this.calculateP95(clsValues),
        fcp_p95: this.calculateP95(fcpValues),
        ttfb_p95: this.calculateP95(ttfbValues),
        sampleSize: recentData.length,
        windowStart: cutoff,
        windowEnd: Date.now(),
        lastUpdated: Date.now(),
      };

      localStorage.setItem(
        `${this.config.storageKey}-baseline`,
        JSON.stringify(baseline)
      );
      console.log('[WebVitalsCollector] :', baseline);

      return baseline;
    } catch (error) {
      console.error('[WebVitalsCollector] :', error);
      return null;
    }
  }

  private calculateP95(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   *
   */
  public getPerformanceReport(): {
    baseline: WebVitalsBaseline | null;
    recent: WebVitalsDataPoint[];
    summary: {
      totalSessions: number;
      avgLCP: number;
      avgINP: number;
      avgCLS: number;
      goodRating: number; //
    };
  } {
    const data = this.getStoredData();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24
    const recent = data.filter(point => point.timestamp > cutoff);

    const lcpValues = recent
      .filter(d => d.metrics.lcp)
      .map(d => d.metrics.lcp!.value);
    const inpValues = recent
      .filter(d => d.metrics.inp)
      .map(d => d.metrics.inp!.value);
    const clsValues = recent
      .filter(d => d.metrics.cls)
      .map(d => d.metrics.cls!.value);

    const goodCount = recent.filter(
      d =>
        d.metrics.lcp?.rating === 'good' &&
        d.metrics.inp?.rating === 'good' &&
        d.metrics.cls?.rating === 'good'
    ).length;

    return {
      baseline: this.getBaseline(),
      recent,
      summary: {
        totalSessions: new Set(recent.map(d => d.sessionId)).size,
        avgLCP: lcpValues.length
          ? lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length
          : 0,
        avgINP: inpValues.length
          ? inpValues.reduce((a, b) => a + b, 0) / inpValues.length
          : 0,
        avgCLS: clsValues.length
          ? clsValues.reduce((a, b) => a + b, 0) / clsValues.length
          : 0,
        goodRating: recent.length ? (goodCount / recent.length) * 100 : 0,
      },
    };
  }

  /**
   *
   */
  public start() {
    if (!this.isEnabled && this.config.enabled) {
      this.initialize();
    }
  }

  /**
   *
   */
  public stop() {
    this.isEnabled = false;

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    //
    this.flush();

    console.log('[WebVitalsCollector] ');
  }

  /**
   *
   */
  public destroy() {
    this.stop();
    this.dataBuffer = [];
    console.log('[WebVitalsCollector] ');
  }
}

//
let webVitalsCollector: WebVitalsCollector | null = null;

export const getWebVitalsCollector = (
  config?: Partial<WebVitalsCollectorConfig>
): WebVitalsCollector => {
  if (!webVitalsCollector) {
    webVitalsCollector = new WebVitalsCollector(config);
  }
  return webVitalsCollector;
};

export { WebVitalsCollector };
export default getWebVitalsCollector;

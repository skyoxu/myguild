/**
 * Long Tasks / Event Loop blocking
 * -  PerformanceObserver  'longtask'
 * -  Sentry Performance
 */

export type LongTaskSample = {
  name: string;
  startTime: number;
  duration: number;
};

export interface LongTaskMonitorOptions {
  thresholdMs?: number; //  50ms
  onReport?: (samples: LongTaskSample[]) => void;
}

export function startLongTaskMonitor(options: LongTaskMonitorOptions = {}) {
  const threshold = options.thresholdMs ?? 50;
  const supported =
    typeof PerformanceObserver !== 'undefined' &&
    // @ts-ignore
    PerformanceObserver.supportedEntryTypes &&
    // @ts-ignore
    PerformanceObserver.supportedEntryTypes.includes('longtask');

  if (!supported) {
    return { stop() {} };
  }

  const buffer: LongTaskSample[] = [];
  // @ts-ignore
  const observer = new PerformanceObserver(
    (list: PerformanceObserverEntryList) => {
      const entries = list.getEntries();
      for (const e of entries) {
        const duration = (e as any).duration as number;
        if (duration >= threshold) {
          buffer.push({ name: e.name, startTime: e.startTime, duration });
        }
      }
      if (buffer.length) {
        try {
          options.onReport?.(buffer.splice(0));
        } catch {}
      }
    }
  );
  // @ts-ignore
  observer.observe({ type: 'longtask', buffered: true });

  return {
    stop() {
      try {
        observer.disconnect();
      } catch {}
    },
  };
}

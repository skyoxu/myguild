import { contextBridge, ipcRenderer } from 'electron';
// Node-only: event loop delay monitor (test/CI only)
let eldApi: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { monitorEventLoopDelay } = require('perf_hooks');
  const enabled = process.env.CI === 'true' || process.env.NODE_ENV === 'test';
  if (monitorEventLoopDelay && enabled) {
    const h = monitorEventLoopDelay({ resolution: 20 });
    h.enable();
    eldApi = {
      sample: () => ({
        min: h.min,
        max: h.max,
        mean: h.mean,
        stddev: h.stddev,
        percentiles: {
          p50: h.percentile(50),
          p90: h.percentile(90),
          p99: h.percentile(99),
        },
        exceeds50ms: h.max > 50_000_000, // perf_hooks uses nanoseconds
      }),
      reset: () => h.reset(),
    };
  }
} catch {}

type SafeAPI = {
  ping: () => Promise<string>;
  perf?: {
    eventLoopDelay: () => Promise<any>;
  };
};

const api: SafeAPI = {
  ping: () => ipcRenderer.invoke('sys:ping'),
  perf: eldApi
    ? {
        eventLoopDelay: async () => eldApi.sample(),
      }
    : undefined,
};

contextBridge.exposeInMainWorld('api', api);

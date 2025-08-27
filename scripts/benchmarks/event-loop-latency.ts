import { monitorEventLoopDelay } from 'node:perf_hooks';

export interface LagStats {
  mean: number;
  p95: number;
  p99: number;
  max: number;
}

export async function measureEventLoopLag(ms = 200): Promise<LagStats> {
  const h = monitorEventLoopDelay({ resolution: 1 });
  h.enable();
  await new Promise(r => setTimeout(r, ms));
  h.disable();
  return {
    mean: Number(h.mean / 1e6),
    p95: Number(h.percentiles.get(95) / 1e6),
    p99: Number(h.percentiles.get(99) / 1e6),
    max: Number(h.max / 1e6),
  };
}

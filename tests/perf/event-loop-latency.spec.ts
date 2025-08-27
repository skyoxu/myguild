import { describe, it, expect } from 'vitest';
import { measureEventLoopLag } from '../../scripts/benchmarks/event-loop-latency';

describe('09 EventLoop 延迟', () => {
  it('TP95/P99 在基线范围内（开发机）', async () => {
    const s = await measureEventLoopLag(300);
    expect(s.p95).toBeLessThanOrEqual(50);
    expect(s.p99).toBeLessThanOrEqual(100);
  });
});

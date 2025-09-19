import { describe, it, expect } from 'vitest';
import { measureEventLoopLag } from '../../scripts/benchmarks/event-loop-latency';

describe('09 EventLoop 延迟', () => {
  it('TP95/P99 在基线范围内（开发机）', async () => {
    const s = await measureEventLoopLag(200); // 减少采样次数避免超时
    expect(s.p95).toBeLessThanOrEqual(50); // 恢复严格生产阈值
    expect(s.p99).toBeLessThanOrEqual(150);
  }, 30000); // 性能采样测试30s超时
});

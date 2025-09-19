import { describe, it, expect } from 'vitest';
import { GATES } from '../../src/shared/quality/gates';

describe('01 SLO→门禁映射', () => {
  it('包含三类门禁并满足阈值下限', () => {
    const byKey = Object.fromEntries(GATES.map(g => [g.key, g]));
    expect(byKey.crash_free.threshold).toBeGreaterThanOrEqual(99.5);
    expect(byKey.tp95.threshold).toBeLessThanOrEqual(100);
    expect(byKey.coverage.threshold).toBeGreaterThanOrEqual(90);
  });
});

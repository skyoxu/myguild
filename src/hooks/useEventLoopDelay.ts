import { useEffect, useRef } from 'react';

/**
 * 轮询 Preload 暴露的 eventLoopDelay 统计（仅测试/CI 启用）
 * - 依赖 window.api.perf.eventLoopDelay（src/preload/bridge.ts）
 * - 默认每 5 秒采样一次，打印到控制台
 */
export function useEventLoopDelayMonitor(intervalMs: number = 5000) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const api: any = (window as any).api;
    if (!api?.perf?.eventLoopDelay) return;

    const tick = async () => {
      try {
        const s = await api.perf.eventLoopDelay();
        // perf_hooks 以纳秒为单位，换算为毫秒
        const toMs = (n: number) => Math.round((n / 1_000_000) * 10) / 10;
        // 仅在测试/CI 打印，避免污染用户日志
        if (process?.env?.NODE_ENV === 'test' || process?.env?.CI === 'true') {
          console.log('[eld]', {
            min: toMs(s.min),
            max: toMs(s.max),
            mean: toMs(s.mean),
            p50: toMs(s.percentiles.p50),
            p90: toMs(s.percentiles.p90),
            p99: toMs(s.percentiles.p99),
            exceeds50ms: s.exceeds50ms,
          });
        }
      } catch {}
    };

    timerRef.current = window.setInterval(tick, intervalMs);
    // 立即采样一次
    void tick();
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [intervalMs]);
}

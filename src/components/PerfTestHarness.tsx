import React, { useCallback, useRef, useState, useTransition } from 'react';
import { createComputationWorker } from '@/shared/workers/workerBridge';

export default function PerfTestHarness() {
  const e2eSmoke = (import.meta as any)?.env?.VITE_E2E_SMOKE === 'true';
  const [responded, setResponded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const workerRef = useRef<ReturnType<typeof createComputationWorker> | null>(
    null
  );

  const ensureWorker = () => {
    if (!workerRef.current) workerRef.current = createComputationWorker();
    return workerRef.current!;
  };

  const onClick = useCallback(async () => {
    const t0 = performance.now();
    performance.mark('test_button_click_start');

    // 立即反馈 UI，保证响应性（下一帧渲染）
    requestAnimationFrame(() => {
      startTransition(() => setResponded(true));
      // 仅在 E2E 性能烟囱模式下，为采样自动隐藏指示器；生产不改变 UI 行为
      if (e2eSmoke) setTimeout(() => setResponded(false), 120);
      performance.mark('response_indicator_visible');
      performance.measure(
        'click_to_indicator',
        'test_button_click_start',
        'response_indicator_visible'
      );
      const m = performance.getEntriesByName('click_to_indicator').pop();
      if (m)
        console.log(
          `[PerfTestHarness] click_to_indicator=${m.duration.toFixed(2)}ms`
        );
    });

    // 后台重计算：不阻塞主线程
    setBusy(true);
    const { heavyTask } = ensureWorker();
    try {
      const res = await heavyTask(5_000_00); // 50万次演示
      console.log(
        `[PerfTestHarness] worker heavyTask duration=${res.duration.toFixed(2)}ms`
      );
    } catch (e) {
      console.warn('[PerfTestHarness] worker error', e);
    } finally {
      setBusy(false);
      const t1 = performance.now();
      console.log(
        `[PerfTestHarness] total handler time=${(t1 - t0).toFixed(2)}ms`
      );
    }
  }, []);

  return (
    <div className="mt-6 flex items-center gap-3" data-testid="perf-harness">
      <button
        data-testid="test-button"
        className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white"
        onClick={onClick}
        disabled={busy}
      >
        {busy ? 'Working…' : 'Test Interaction'}
      </button>
      {responded && (
        <span data-testid="response-indicator" className="text-green-400">
          OK
        </span>
      )}
      {isPending && <span className="text-yellow-400">…</span>}
    </div>
  );
}

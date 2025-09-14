import React, {
  useCallback,
  useRef,
  useState,
  useTransition,
  useLayoutEffect,
} from 'react';
import { createComputationWorker } from '@/shared/workers/workerBridge';

export default function PerfTestHarness() {
  const e2eSmoke = (import.meta as any)?.env?.VITE_E2E_SMOKE === 'true';
  const [responded, setResponded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const workerRef = useRef<ReturnType<typeof createComputationWorker> | null>(
    null
  );
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const ensureWorker = () => {
    if (!workerRef.current) workerRef.current = createComputationWorker();
    return workerRef.current!;
  };

  const onClick = useCallback(async () => {
    const t0 = performance.now();
    performance.mark('test_button_click_start');

    // 立即设置responded状态，确保同步DOM更新
    setResponded(true);

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

  // 使用useLayoutEffect确保response-indicator的同步显示和性能标记
  useLayoutEffect(() => {
    if (responded) {
      // 立即标记指示器可见，确保在DOM更新后同步执行
      performance.mark('response_indicator_visible');
      performance.measure(
        'click_to_indicator',
        'test_button_click_start',
        'response_indicator_visible'
      );

      const m = performance.getEntriesByName('click_to_indicator').pop();
      if (m) {
        console.log(
          `[PerfTestHarness] click_to_indicator=${m.duration.toFixed(2)}ms`
        );
      }

      // E2E烟雾测试模式下120ms后隐藏
      if (e2eSmoke) {
        timerRef.current = setTimeout(() => setResponded(false), 120);
      }
    }

    // 清理函数：组件卸载时清理定时器
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [responded, e2eSmoke]);

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

// 计算密集任务Worker（示例）：将重逻辑从主线程移出
// 在渲染侧：new Worker(new URL('./computation.worker.ts', import.meta.url), { type: 'module' })

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data || {};
  if (type === 'heavyTask') {
    const start = performance.now();
    // 模拟重计算
    let acc = 0;
    const n: number = payload?.n ?? 5_000_000;
    for (let i = 0; i < n; i++) acc += Math.sqrt(i ^ i % 13);
    const duration = performance.now() - start;
    (self as any).postMessage({
      type: 'heavyTask:done',
      result: acc,
      duration,
    });
  } else {
    (self as any).postMessage({ type: 'unknown', payload });
  }
};

export {};

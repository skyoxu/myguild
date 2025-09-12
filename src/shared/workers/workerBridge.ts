export type HeavyTaskResult = { result: number; duration: number };

export function createComputationWorker() {
  const worker = new Worker(
    new URL('@/workers/computation.worker.ts', import.meta.url),
    {
      type: 'module',
    }
  );

  function heavyTask(n: number): Promise<HeavyTaskResult> {
    return new Promise((resolve, reject) => {
      const onMessage = (e: MessageEvent) => {
        const { type, result, duration } = (e.data || {}) as any;
        if (type === 'heavyTask:done') {
          cleanup();
          resolve({ result, duration });
        }
      };
      const onError = (err: any) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        worker.removeEventListener('message', onMessage as any);
        worker.removeEventListener('error', onError as any);
      };
      worker.addEventListener('message', onMessage as any);
      worker.addEventListener('error', onError as any);
      worker.postMessage({ type: 'heavyTask', payload: { n } });
    });
  }

  function terminate() {
    worker.terminate();
  }

  return { worker, heavyTask, terminate };
}

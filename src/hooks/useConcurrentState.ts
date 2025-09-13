import { useDeferredValue, useState, useTransition } from 'react';

/**
 * 并发友好型状态封装：
 * - 提供 startTransition 包裹的 setState（不改业务语义，只降级优先级）
 * - 提供 useDeferredValue 的延迟副本（用于渲染重对象/数组时减载）
 */
export function useConcurrentState<T>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const deferred = useDeferredValue(state);
  const [isPending, startTransition] = useTransition();

  const set = (updater: T | ((prev: T) => T)) => {
    startTransition(() => {
      // @ts-ignore
      setState(updater);
    });
  };

  return { state, set, deferred, isPending } as const;
}

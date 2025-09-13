import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useWebVitals } from './hooks/useWebVitals';
import { startLongTaskMonitor } from '@/shared/observability/longtask-monitor';
import { useEventLoopDelayMonitor } from '@/hooks/useEventLoopDelay';
import {
  runPreheatQueue,
  preheatImages,
} from '@/shared/performance/asset-preheater';
import { startTransaction } from '@/shared/observability/sentry-perf';
import { scheduleNonBlocking } from '@/shared/performance/idle';

const LazyGameCanvas = lazy(() =>
  import('./components/GameCanvas').then(m => ({ default: m.GameCanvas }))
);
const LazyVerticalSlice = lazy(() =>
  import('./components/GameVerticalSlice').then(m => ({
    default: m.GameVerticalSlice,
  }))
);
// Perf 测试组件采用按需动态导入，仅在特征旗标下加载，避免进入生产包

type AppMode = 'normal' | 'vertical-slice';

function App() {
  const [mode, setMode] = useState<AppMode>('normal');
  const [verticalSliceCompleted, setVerticalSliceCompleted] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const isPerfSmoke = (() => {
    // 以 Vite 注入的构建期旗标为主，query 为辅
    const byFlag = (import.meta as any)?.env?.VITE_E2E_SMOKE === 'true';
    try {
      const params = new URLSearchParams(window.location.search);
      const byQuery = params.get('e2e-smoke') === '1';
      return Boolean(byFlag || byQuery);
    } catch {
      return Boolean(byFlag);
    }
  })();
  const [showPerfHarness, setShowPerfHarness] = useState<boolean>(isPerfSmoke);
  const [PerfHarnessComp, setPerfHarnessComp] =
    useState<React.ComponentType | null>(null);

  const webVitals = useWebVitals({
    enabled: true,
    componentName: 'App',
    trackRender: true,
    trackInteractions: true,
    collectorConfig: {
      enabled: true,
      sentryEnabled: true,
      batchSize: 5,
      flushInterval: 15000,
    },
  });

  useEffect(() => {
    webVitals.startTiming('app_initialization');
    let txn: { finish: () => void } | null = null;
    (async () => {
      txn = await startTransaction('app_initialization', 'startup');
    })();
    const timer = setTimeout(() => {
      webVitals.endTiming('app_initialization');
    }, 100);
    return () => {
      clearTimeout(timer);
      txn?.finish?.();
    };
  }, [webVitals]);

  useEffect(() => {
    const monitor = startLongTaskMonitor({
      thresholdMs: 50,
      onReport: samples => {
        if (process?.env?.NODE_ENV !== 'production') {
          scheduleNonBlocking(() => console.log('[longtask]', samples));
        }
      },
    });
    return () => monitor.stop();
  }, []);

  useEventLoopDelayMonitor(5000);

  useEffect(() => {
    const tiny =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    runPreheatQueue(preheatImages([tiny]), 4).catch(() => void 0);
  }, []);

  useEffect(() => {
    try {
      console.log('[e2e] search:', window.location.search);
      const params = new URLSearchParams(window.location.search);
      if (params.get('vertical-slice') === 'auto') setMode('vertical-slice');
      if (params.get('auto-start') === '1') setGameStarted(true);
    } catch {}
  }, []);

  // 仅在 perf-smoke 模式下按需加载测试组件，生产构建不包含该模块
  useEffect(() => {
    if (isPerfSmoke) {
      import('./components/PerfTestHarness')
        .then(m => setPerfHarnessComp(() => m.default))
        .catch(() => setPerfHarnessComp(null));
    }
  }, [isPerfSmoke]);

  const handleVerticalSliceComplete = (result: any) => {
    console.log('[vertical-slice] completed:', result);
    setVerticalSliceCompleted(true);
    webVitals.recordCustomEvent('vertical_slice_completed', {
      testId: result?.testId,
      score: result?.result?.score,
      duration: result?.result?.duration,
    });
  };

  const handleVerticalSliceError = (error: string) => {
    console.error('[vertical-slice] error:', error);
    webVitals.recordError(new Error(error), 'vertical_slice');
  };

  return (
    <div className="app-container p-8 min-h-screen" data-testid="app-root">
      <header className="text-center mb-8">
        <h1 className="font-bold text-xl mb-2">
          Phaser 3 + React 19 + TypeScript
        </h1>
        <p className="text-gray-500">Demo application</p>
        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={() => setMode('normal')}
            className={`px-4 py-2 rounded ${mode === 'normal' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}
          >
            Normal
          </button>
          <button
            onClick={() => setMode('vertical-slice')}
            className={`px-4 py-2 rounded ${mode === 'vertical-slice' ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}
          >
            Vertical Slice{' '}
            {verticalSliceCompleted && (
              <span className="ml-2 text-green-300">✓</span>
            )}
          </button>
        </div>
      </header>

      <main className="flex justify-center">
        {mode === 'normal' ? (
          <div className="flex flex-col items-center">
            {!gameStarted ? (
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white"
                onClick={() => setGameStarted(true)}
                data-testid="start-game"
              >
                Start Game
              </button>
            ) : (
              <Suspense
                fallback={
                  <div className="text-gray-300">Loading game module...</div>
                }
              >
                <LazyGameCanvas
                  width={800}
                  height={600}
                  className="shadow-lg"
                />
              </Suspense>
            )}
            <p className="text-center mt-4 text-gray-400 text-sm max-w-md">
              Standard game canvas using GameEngineAdapter & Menu/Game scenes.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Suspense
              fallback={<div className="text-gray-300">Loading slice...</div>}
            >
              <LazyVerticalSlice
                onComplete={handleVerticalSliceComplete}
                onError={handleVerticalSliceError}
                className="max-w-4xl"
                autoStart={false}
              />
            </Suspense>
          </div>
        )}
      </main>

      {showPerfHarness && PerfHarnessComp && (
        <Suspense
          fallback={
            <div className="text-gray-300">Loading perf harness...</div>
          }
        >
          <PerfHarnessComp />
        </Suspense>
      )}

      <footer className="text-center mt-8 text-gray-500">
        <p>Electron + React 19 + Vite + Phaser 3 + Tailwind + TypeScript</p>
      </footer>
    </div>
  );
}

export default App;

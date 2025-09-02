import { GameCanvas } from './components/GameCanvas';
import { GameVerticalSlice } from './components/GameVerticalSlice';
import { useWebVitals } from './hooks/useWebVitals';
import { useEffect, useState } from 'react';

type AppMode = 'normal' | 'vertical-slice';

function App() {
  const [mode, setMode] = useState<AppMode>('normal');
  const [verticalSliceCompleted, setVerticalSliceCompleted] = useState(false);

  // 初始化Web Vitals监控
  const webVitals = useWebVitals({
    enabled: true,
    componentName: 'App',
    trackRender: true,
    trackInteractions: true,
    collectorConfig: {
      enabled: true,
      sentryEnabled: true,
      batchSize: 5,
      flushInterval: 15000, // 15秒批量上报
    },
  });

  // 应用启动性能监控
  useEffect(() => {
    webVitals.startTiming('app_initialization');

    // 模拟应用初始化完成
    const timer = setTimeout(() => {
      webVitals.endTiming('app_initialization');
    }, 100);

    return () => clearTimeout(timer);
  }, [webVitals]);

  // 处理竖切测试完成
  const handleVerticalSliceComplete = (result: any) => {
    console.log('🎉 竖切测试完成:', result);
    setVerticalSliceCompleted(true);
    webVitals.recordCustomEvent('vertical_slice_completed', {
      testId: result.testId,
      score: result.result?.score,
      duration: result.result?.duration,
    });
  };

  // 处理竖切测试错误
  const handleVerticalSliceError = (error: string) => {
    console.error('❌ 竖切测试失败:', error);
    webVitals.recordError(new Error(error), 'vertical_slice');
  };

  // 快速启动竖切测试（开发用）
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('vertical-slice') === 'auto') {
      console.log('🚀 自动启动竖切测试');
      setMode('vertical-slice');
    }
  }, []);

  return (
    <div className="app-container p-8 min-h-screen bg-game-ui-background" data-testid="app-root">
      <header className="text-center mb-8">
        <h1 className="text-game-title font-bold text-game-primary mb-4">
          Phaser 3 + React 19 + TypeScript
        </h1>
        <p className="text-game-subtitle text-game-ui-muted">
          符合 CLAUDE.md 技术栈要求的游戏开发环境
        </p>

        {/* 导航切换 */}
        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={() => setMode('normal')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === 'normal'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            🎮 常规游戏
          </button>
          <button
            onClick={() => setMode('vertical-slice')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === 'vertical-slice'
                ? 'bg-green-600 text-white'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            🚀 竖切测试
            {verticalSliceCompleted && (
              <span className="ml-2 text-green-300">✅</span>
            )}
          </button>
        </div>
      </header>

      <main className="flex justify-center">
        {mode === 'normal' ? (
          <div className="flex flex-col items-center">
            <GameCanvas width={800} height={600} className="shadow-lg" />
            <p className="text-center mt-4 text-gray-400 text-sm max-w-md">
              这是标准的游戏画布，使用现有的 GameEngineAdapter 和
              MenuScene/GameScene
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <GameVerticalSlice
              onComplete={handleVerticalSliceComplete}
              onError={handleVerticalSliceError}
              className="max-w-4xl"
              autoStart={false}
            />
            <div className="mt-6 p-4 bg-gray-800 rounded-lg max-w-2xl">
              <h3 className="text-white font-semibold mb-2">🔬 竖切测试说明</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• 验证 React → Phaser → CloudEvents → SQLite 端到端流程</li>
                <li>• 包含数据持久化、可观测性上报、性能监控</li>
                <li>• 集成现有的备份系统和 Sentry 监控</li>
                <li>
                  • 支持快速访问: <code>?vertical-slice=auto</code>
                </li>
              </ul>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center mt-8 text-game-ui-muted">
        <p>
          🎮 技术栈：Electron + React 19 + Vite + Phaser 3 + Tailwind CSS v4 +
          TypeScript
        </p>
        {mode === 'vertical-slice' && (
          <p className="mt-2 text-sm text-green-400">
            竖切模式: 端到端验证所有组件集成
          </p>
        )}
      </footer>
    </div>
  );
}

export default App;

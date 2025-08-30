import { GameCanvas } from './components/GameCanvas';
import { useWebVitals } from './hooks/useWebVitals';
import { useEffect } from 'react';

function App() {
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
    }
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
  return (
    <div className="app-container p-8 min-h-screen bg-game-ui-background">
      <header className="text-center mb-8">
        <h1 className="text-game-title font-bold text-game-primary mb-4">
          Phaser 3 + React 19 + TypeScript
        </h1>
        <p className="text-game-subtitle text-game-ui-muted">
          符合 CLAUDE.md 技术栈要求的游戏开发环境
        </p>
      </header>

      <main className="flex justify-center">
        <GameCanvas width={800} height={600} className="shadow-lg" />
      </main>

      <footer className="text-center mt-8 text-game-ui-muted">
        <p>
          🎮 技术栈：Electron + React 19 + Vite + Phaser 3 + Tailwind CSS v4 +
          TypeScript
        </p>
      </footer>
    </div>
  );
}

export default App;

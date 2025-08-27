import { GameCanvas } from './components/GameCanvas';

function App() {
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

import { BrowserWindow, app } from 'electron';
import path from 'node:path';

export function createMainWindow() {
  const win = new BrowserWindow({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload', 'bridge.js'),
    },
  });

  // 加载入口（开发/生产可按需切换）
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }
  return win;
}

app.whenReady().then(() => {
  const win = createMainWindow();
  win.on('closed', () => app.quit());
});

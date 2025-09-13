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

  if (process.env.VITE_DEV_SERVER_URL) {
    const devUrl = new URL(process.env.VITE_DEV_SERVER_URL);
    if (process.env.E2E_AUTO_START === '1') {
      devUrl.searchParams.set('auto-start', '1');
      devUrl.searchParams.set('e2e-smoke', '1');
    }
    win.loadURL(devUrl.toString());
  } else {
    const distIndex = path.join(process.cwd(), 'dist', 'index.html');
    if (process.env.E2E_AUTO_START === '1') {
      win.loadFile(distIndex, { search: 'auto-start=1&e2e-smoke=1' });
    } else {
      win.loadFile(distIndex);
    }
  }
  return win;
}

app.whenReady().then(() => {
  const win = createMainWindow();
  win.on('closed', () => app.quit());
});

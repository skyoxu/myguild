#!/usr/bin/env node
/**
 * Resolve Electron entry for E2E:
 * - Prefer packaged exe under dist/win-unpacked/<productName>.exe when exists
 * - Fallback to dist-electron/main.js (build-ready) when exe is missing
 * - Export ELECTRON_MAIN_PATH and VITE_E2E_SMOKE to GITHUB_ENV
 */
import {
  existsSync,
  appendFileSync,
  readFileSync,
  mkdirSync,
  appendFile,
} from 'node:fs';
import path from 'node:path';

function stripBOM(s) {
  return s.replace(/^\uFEFF/, '');
}

function log(msg) {
  const dir = path.join('logs', new Date().toISOString().slice(0, 10), 'ci');
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}
  try {
    appendFile(path.join(dir, 'set-electron-env.log'), msg + '\n', () => {});
  } catch {}
  console.log(msg);
}

try {
  const pkg = JSON.parse(stripBOM(readFileSync('package.json', 'utf8')));
  const productName = pkg.productName || pkg.name || 'App';
  const exePath = `dist/win-unpacked/${productName}.exe`;
  const fallbackMain = 'dist-electron/electron/main.js';

  let resolved = '';
  if (existsSync(exePath)) {
    resolved = exePath;
    log(`[set-electron-env] Found packaged exe: ${exePath}`);
  } else if (existsSync(fallbackMain)) {
    resolved = fallbackMain;
    log(
      `[set-electron-env] Packaged exe missing; fallback to: ${fallbackMain}`
    );
  } else {
    log(
      `[set-electron-env] Neither packaged exe nor fallback main found. Expected one of:\n - ${exePath}\n - ${fallbackMain}`
    );
    process.exit(1);
  }

  const envFile = process.env.GITHUB_ENV;
  if (!envFile) {
    log('[set-electron-env] GITHUB_ENV not set; printing exports to stdout');
    console.log(`ELECTRON_MAIN_PATH=${resolved}`);
    console.log('VITE_E2E_SMOKE=true');
  } else {
    appendFileSync(envFile, `ELECTRON_MAIN_PATH=${resolved}\n`);
    appendFileSync(envFile, `VITE_E2E_SMOKE=true\n`);
  }
  process.exit(0);
} catch (e) {
  console.error(`set-electron-env failed: ${(e && e.message) || e}`);
  process.exit(1);
}

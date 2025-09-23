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

  // Additional fallback paths for CI environments
  const developmentMain = pkg.main || 'dist-electron/electron/main.js';
  const alternativePaths = [
    'dist-electron/main.js',
    'electron/main.js',
    'dist/electron/main.js'
  ];

  let resolved = '';

  // Priority 1: Packaged executable (production)
  if (existsSync(exePath)) {
    resolved = exePath;
    log(`[set-electron-env] Found packaged exe: ${exePath}`);
  }
  // Priority 2: Built main.js in expected location
  else if (existsSync(fallbackMain)) {
    resolved = fallbackMain;
    log(`[set-electron-env] Using built main.js: ${fallbackMain}`);
  }
  // Priority 3: Package.json main entry
  else if (developmentMain && existsSync(developmentMain)) {
    resolved = developmentMain;
    log(`[set-electron-env] Using package.json main: ${developmentMain}`);
  }
  // Priority 4: Try alternative common paths
  else {
    let found = false;
    for (const altPath of alternativePaths) {
      if (existsSync(altPath)) {
        resolved = altPath;
        found = true;
        log(`[set-electron-env] Using alternative path: ${altPath}`);
        break;
      }
    }

    if (!found) {
      log(`[set-electron-env] No Electron entry found. Checked paths:`);
      log(` - ${exePath} (packaged exe)`);
      log(` - ${fallbackMain} (built main)`);
      log(` - ${developmentMain} (package.json main)`);
      alternativePaths.forEach(p => log(` - ${p} (alternative)`));

      // In CI environments, try to provide helpful debugging info
      log(`[set-electron-env] Current directory contents:`);
      try {
        const { readdirSync } = await import('node:fs');
        const contents = readdirSync('.', { withFileTypes: true });
        contents.forEach(item => {
          const type = item.isDirectory() ? 'DIR' : 'FILE';
          log(`  ${type}: ${item.name}`);
        });
      } catch (e) {
        log(`  Error listing directory: ${e.message}`);
      }

      process.exit(1);
    }
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

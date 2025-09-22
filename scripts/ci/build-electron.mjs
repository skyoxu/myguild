#!/usr/bin/env node
/**
 * Build Electron application for Windows and copy win-unpacked to dist/win-unpacked.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';

function sh(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

try {
  sh('npm run build');
  sh('npx tsc -p electron');
  sh('npx electron-builder --dir');

  // Find win-unpacked under release/*
  const releaseDir = 'release';
  const { readdirSync, statSync } = await import('node:fs');
  function findWinUnpacked(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (name.toLowerCase() === 'win-unpacked') return p;
        const found = findWinUnpacked(p);
        if (found) return found;
      }
    }
    return null;
  }
  const winUnpacked = existsSync(releaseDir)
    ? findWinUnpacked(releaseDir)
    : null;
  if (!winUnpacked) {
    console.error('electron-builder output not found in release/');
    process.exit(1);
  }
  const dest = join('dist', 'win-unpacked');
  mkdirSync(dest, { recursive: true });
  cpSync(winUnpacked, dest, { recursive: true });
  console.log(`Copied ${winUnpacked} -> ${dest}`);
} catch (e) {
  console.error(`build-electron failed: ${(e && e.message) || e}`);
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Verify Electron executable and set environment exports for subsequent steps.
 * - Writes ELECTRON_MAIN_PATH and VITE_E2E_SMOKE to GITHUB_ENV.
 */
import { existsSync, appendFileSync } from 'node:fs';

const exePath = 'dist/win-unpacked/ViteGame Studio.exe';
try {
  if (!existsSync(exePath)) {
    console.error(`Electron executable not found: ${exePath}`);
    process.exit(1);
  }
  console.log(`Found Electron executable: ${exePath}`);
  const envFile = process.env.GITHUB_ENV;
  if (!envFile) {
    console.log('GITHUB_ENV not set; printing exports to stdout');
    console.log(`ELECTRON_MAIN_PATH=${exePath}`);
    console.log('VITE_E2E_SMOKE=true');
  } else {
    appendFileSync(envFile, `ELECTRON_MAIN_PATH=${exePath}\n`);
    appendFileSync(envFile, `VITE_E2E_SMOKE=true\n`);
  }
  process.exit(0);
} catch (e) {
  console.error(`set-electron-env failed: ${(e && e.message) || e}`);
  process.exit(1);
}


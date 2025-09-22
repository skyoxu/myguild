#!/usr/bin/env node
/**
 * Archive dist/* into artifacts/build.zip using PowerShell Compress-Archive.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

fs.mkdirSync('artifacts', { recursive: true });
const zip = path.join('artifacts', 'build.zip');
const cmd = process.platform === 'win32' ? 'powershell' : 'pwsh';
const r = spawnSync(
  cmd,
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path dist/* -DestinationPath ${zip} -Force`,
  ],
  { stdio: 'inherit' }
);
process.exit(r.status ?? 0);

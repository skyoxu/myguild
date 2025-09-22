#!/usr/bin/env node
/**
 * Validate feed file and manifest existence, then run manifest validation.
 * Env:
 * - FEED_FILE (required)
 */
import fs from 'node:fs';

const feed = process.env.FEED_FILE || '';
if (!feed) {
  console.error('FEED_FILE is required');
  process.exit(1);
}
if (!fs.existsSync(feed)) {
  console.error(`Feed file not found: ${feed}`);
  process.exit(1);
}
if (!fs.existsSync('artifacts/manifest.json')) {
  console.error('Missing artifacts/manifest.json');
  process.exit(1);
}
console.log('Validating manifest format...');
const { spawnSync } = await import('node:child_process');
const r = spawnSync(
  process.execPath,
  ['scripts/release/manage-manifest.mjs', 'validate'],
  { stdio: 'inherit' }
);
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('Validation complete.');

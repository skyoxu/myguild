#!/usr/bin/env node
/**
 * Execute rollback for a single feed.
 * Env: FEED_FILE, PREV_GA_VERSION, WEBHOOK_URL, REASON
 * Output: rollback_result
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const feed = process.env.FEED_FILE || '';
const prev = process.env.PREV_GA_VERSION || '';
const reason = process.env.REASON || '';
const webhook = process.env.WEBHOOK_URL || '';

if (!feed || !fs.existsSync(feed)) {
  console.error(`Feed file not found: ${feed}`);
  process.exit(1);
}
const args = [
  'scripts/release/execute-rollback.mjs',
  `--feed=${feed}`,
  `--previous-version=${prev}`,
  '--manifest=artifacts/manifest.json',
];
if (reason) args.push(`--reason=${reason}`);
if (webhook) args.push('--notify');
const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
const result = (r.stdout || '').trim();
if (process.env.GITHUB_OUTPUT)
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `rollback_result=${JSON.stringify(result)}\n`
  );
console.log('Rollback executed for single feed');
process.exit(r.status ?? 0);

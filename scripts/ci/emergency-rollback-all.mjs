#!/usr/bin/env node
/**
 * Execute rollback for all known feeds if file exists.
 * Env: PREV_GA_VERSION, WEBHOOK_URL, REASON
 * Output: rollback_results (JSON array)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const prev = process.env.PREV_GA_VERSION || '';
const reason = process.env.REASON || '';
const webhook = process.env.WEBHOOK_URL || '';

const feeds = ['dist/latest.yml'];
const results = [];
for (const feed of feeds) {
  if (fs.existsSync(feed)) {
    const args = [
      'scripts/release/execute-rollback.mjs',
      `--feed=${feed}`,
      `--previous-version=${prev}`,
      '--manifest=artifacts/manifest.json',
    ];
    if (reason) args.push(`--reason=${reason}`);
    if (webhook) args.push('--notify');
    const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
    results.push({
      feed,
      success: r.status === 0,
      result: (r.stdout || '').trim(),
    });
  } else {
    results.push({ feed, success: true, skipped: true });
  }
}
const out = JSON.stringify(results);
if (process.env.GITHUB_OUTPUT)
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `rollback_results=${out}\n`);
console.log('Rollback for all feeds processed');

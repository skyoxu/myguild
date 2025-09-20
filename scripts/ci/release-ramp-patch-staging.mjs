#!/usr/bin/env node
/**
 * Patch stagingPercentage in feed file and set output.
 * Env: FEED_FILE, STAGE
 * Output: staging_result
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const feed = process.env.FEED_FILE || '';
const stage = process.env.STAGE || '';
if (!feed || !stage) { console.error('FEED_FILE and STAGE are required'); process.exit(1); }
const r = spawnSync(process.execPath, ['scripts/release/patch-staging-percentage.mjs', feed, stage], { encoding: 'utf8' });
const outFile = process.env.GITHUB_OUTPUT;
if (outFile) fs.appendFileSync(outFile, `staging_result=${JSON.stringify(r.stdout?.trim() || '')}\n`);
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('Staging percentage patched');


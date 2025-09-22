#!/usr/bin/env node
/**
 * Write .github/monitoring/latest-status.json with provided env fields.
 * Env:
 * - APP_VERSION
 * - STAGING_PERCENTAGE
 * - HEALTH_STATUS
 * - HEALTH_RESULT (JSON string or 'null')
 */
import fs from 'node:fs';
import path from 'node:path';

const version = process.env.APP_VERSION || 'unknown';
const pct = process.env.STAGING_PERCENTAGE || '0';
const status = process.env.HEALTH_STATUS || 'unknown';
let data = null;
try {
  data = JSON.parse(process.env.HEALTH_RESULT || 'null');
} catch {
  data = null;
}

const dir = path.join('.github', 'monitoring');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'latest-status.json');
const now = new Date();
const next = new Date(now.getTime() + 15 * 60 * 1000);

const payload = {
  timestamp: now.toISOString(),
  version,
  staging_percentage: Number(pct),
  health_status: status,
  health_data: data,
  workflow_run: process.env.GITHUB_RUN_NUMBER || '',
  next_check: next.toISOString(),
};

fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
console.log(`Wrote monitoring status to ${file}`);

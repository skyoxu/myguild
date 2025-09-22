#!/usr/bin/env node
/**
 * Run DRY health check via scripts/release/auto-rollback.mjs and set outputs.
 * Outputs:
 * - health_result: JSON string
 * - health_exit_code: number
 * - monitor_status: 'healthy' | 'unhealthy' | 'skipped' | 'error'
 * If unhealthy (exit code 42), triggers emergency rollback workflow dispatch.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const token = process.env.SENTRY_AUTH_TOKEN || '';
const outFile = process.env.GITHUB_OUTPUT;
function setOutput(k, v) {
  if (!outFile) return;
  fs.appendFileSync(outFile, `${k}=${v}\n`, 'utf8');
}

if (!token) {
  console.log('SENTRY_AUTH_TOKEN missing; skipping monitoring');
  setOutput('monitor_status', 'skipped');
  process.exit(0);
}

const r = spawnSync(process.execPath, ['scripts/release/auto-rollback.mjs'], {
  env: { ...process.env, DRY_RUN: 'true' },
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});
const exitCode = r.status ?? 1;
const result = (r.stdout || '').trim() || 'null';
setOutput('health_result', result);
setOutput('health_exit_code', String(exitCode));

if (exitCode === 0) {
  setOutput('monitor_status', 'healthy');
  console.log('Health OK');
  process.exit(0);
}
if (exitCode === 42) {
  setOutput('monitor_status', 'unhealthy');
  console.log('Health degraded; emergency rollback dispatch will be triggered');
  // Best-effort dispatch call (requires GITHUB_TOKEN)
  try {
    const tokenGh = process.env.GITHUB_TOKEN;
    const repoEnv = process.env.GITHUB_REPOSITORY || '';
    const [owner, repo] = repoEnv.split('/');
    if (tokenGh && owner && repo) {
      const body = {
        ref: process.env.GITHUB_REF || 'main',
        inputs: {
          reason: 'Continuous monitoring detected health degradation',
          triggered_by: 'monitor',
        },
      };
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/release-emergency-rollback.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenGh}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        console.warn(`Dispatch failed: ${res.status} ${res.statusText} - ${t}`);
      } else {
        console.log('Emergency rollback workflow dispatched.');
      }
    } else {
      console.warn(
        'GITHUB_TOKEN or repository info missing; cannot dispatch rollback.'
      );
    }
  } catch (e) {
    console.warn(`Dispatch error: ${String(e)}`);
  }
  process.exit(0);
}

setOutput('monitor_status', 'error');
console.log(`Health check error (exit=${exitCode})`);
process.exit(0);

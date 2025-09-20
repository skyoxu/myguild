#!/usr/bin/env node
/**
 * Wait for a specific check-run to complete on the current ref.
 * Env:
 * - GITHUB_TOKEN (required)
 * - TARGET_CHECK_NAME (required)
 * - TIMEOUT_MS (optional, default 600000)
 */
import assert from 'node:assert';

const token = process.env.GITHUB_TOKEN;
const repoEnv = process.env.GITHUB_REPOSITORY || '';
const owner = process.env.GITHUB_REPOSITORY_OWNER || (repoEnv.includes('/') ? repoEnv.split('/')[0] : '');
const repo = repoEnv.includes('/') ? repoEnv.split('/')[1] : (process.env.REPO_NAME || '');
const ref = process.env.GITHUB_SHA || process.env.GITHUB_REF;
const target = process.env.TARGET_CHECK_NAME;
const timeoutMs = Number(process.env.TIMEOUT_MS || 10 * 60 * 1000);

assert(token, 'GITHUB_TOKEN is required');
assert(owner && repo, 'Cannot resolve repository');
assert(ref, 'Cannot resolve ref/sha');
assert(target, 'TARGET_CHECK_NAME is required');

async function listChecks() {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${ref}/check-runs`;
  const r = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gatekeeper-wait-check'
    }
  });
  if (!r.ok) throw new Error(`GitHub API error: ${r.status} ${r.statusText}`);
  const j = await r.json();
  return j.check_runs || [];
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function main(){
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const checks = await listChecks();
    const cr = checks.find(c => c.name === target);
    const status = cr?.status;
    const conclusion = cr?.conclusion || 'pending';
    console.log(`Waiting for check: ${target} (found=${!!cr} status=${status} conclusion=${conclusion})`);
    if (cr && ['success','neutral','skipped'].includes(conclusion)) return;
    if (cr && ['failure','timed_out','cancelled','action_required'].includes(conclusion)) {
      throw new Error(`${target} concluded: ${conclusion}`);
    }
    await sleep(30000);
  }
  throw new Error(`Timeout waiting for ${target}`);
}

main().catch(err => { console.error(String(err)); process.exit(1); });


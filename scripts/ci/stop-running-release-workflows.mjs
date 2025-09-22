#!/usr/bin/env node
/**
 * Cancel in-progress runs for a named workflow (Release Ramp).
 * Env: GITHUB_TOKEN, GITHUB_REPOSITORY
 */
import assert from 'node:assert';

const token = process.env.GITHUB_TOKEN;
const repoEnv = process.env.GITHUB_REPOSITORY || '';
assert(token, 'GITHUB_TOKEN required');
assert(repoEnv.includes('/'), 'GITHUB_REPOSITORY required');
const [owner, repo] = repoEnv.split('/');

async function listRuns() {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?status=in_progress&per_page=100`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!r.ok) throw new Error(`list runs failed: ${r.status}`);
  const j = await r.json();
  return (j.workflow_runs || []).filter(w => w.name === 'Release Ramp');
}

async function cancelRun(id) {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${id}/cancel`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!r.ok) console.warn(`cancel run ${id} failed: ${r.status}`);
}

const runs = await listRuns();
for (const run of runs) {
  console.log(`Cancelling workflow run ${run.id}`);
  await cancelRun(run.id);
}
console.log('Cancellation requests sent.');

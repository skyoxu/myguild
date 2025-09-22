#!/usr/bin/env node
/**
 * Wait for a specific check-run to complete on the current ref.
 * Env:
 * - GITHUB_TOKEN (required)
 * - TARGET_CHECK_NAME (optional; supports comma-separated)
 * - TARGET_JOB_NAME (optional; job name portion)
 * - TARGET_WORKFLOW_NAME (optional; workflow name portion)
 * - OPTIONAL ('true' to skip if target never appears)
 * - TIMEOUT_MS (optional, default 600000)
 *
 * Notes:
 * - GitHub Checks API check_run.name equals the job name, not "Workflow / Job".
 * - UI often shows "<workflow> / <job>" and may append matrix/OS suffixes.
 * - To reduce flakiness, we match by job name and lenient prefix.
 *
 * References: ADR-0005 (质量门禁), ADR-0008 (CI/CD 管道)
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const token = process.env.GITHUB_TOKEN;
const repoEnv = process.env.GITHUB_REPOSITORY || '';
const owner =
  process.env.GITHUB_REPOSITORY_OWNER ||
  (repoEnv.includes('/') ? repoEnv.split('/')[0] : '');
const repo = repoEnv.includes('/')
  ? repoEnv.split('/')[1]
  : process.env.REPO_NAME || '';
const ref = process.env.GITHUB_SHA || process.env.GITHUB_REF;
const targetRaw = process.env.TARGET_CHECK_NAME || '';
const targetJobName = process.env.TARGET_JOB_NAME || '';
const targetWorkflowName = process.env.TARGET_WORKFLOW_NAME || '';
const optional =
  String(process.env.OPTIONAL || '').toLowerCase() === 'true' ||
  String(process.env.SKIP_IF_NOT_FOUND || '').toLowerCase() === 'true';
const timeoutMs = Number(process.env.TIMEOUT_MS || 10 * 60 * 1000);

assert(token, 'GITHUB_TOKEN is required');
assert(owner && repo, 'Cannot resolve repository');
assert(ref, 'Cannot resolve ref/sha');

// Prepare logging to logs/ci/YYYY-MM-DD/gatekeeper-<timestamp>.log
const now = new Date();
const yyyy = now.getUTCFullYear();
const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
const dd = String(now.getUTCDate()).padStart(2, '0');
const hh = String(now.getUTCHours()).padStart(2, '0');
const mi = String(now.getUTCMinutes()).padStart(2, '0');
const ss = String(now.getUTCSeconds()).padStart(2, '0');
const dateDir = path.join('logs', 'ci', `${yyyy}-${mm}-${dd}`);
const logFile = path.join(
  dateDir,
  `gatekeeper-wait-check-${hh}${mi}${ss}Z.log`
);
try {
  fs.mkdirSync(dateDir, { recursive: true });
} catch {}
const log = msg => {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(logFile, line + '\n');
  } catch {}
};

const targetCandidates = [
  ...targetRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  targetJobName.trim(),
].filter(Boolean);

if (targetCandidates.length === 0) {
  throw new Error(
    'At least one of TARGET_CHECK_NAME or TARGET_JOB_NAME is required'
  );
}

async function listChecks() {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${ref}/check-runs`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gatekeeper-wait-check',
    },
  });
  if (!r.ok) throw new Error(`GitHub API error: ${r.status} ${r.statusText}`);
  const j = await r.json();
  return j.check_runs || [];
}

function matchCheckRunName(name) {
  // Accept exact match, prefix match, or match the job portion when user supplied "Workflow / Job"
  for (const t of targetCandidates) {
    if (!t) continue;
    if (name === t) return true;
    if (name.startsWith(t)) return true; // allow matrix suffixes like " (windows-latest)"
    if (t.includes(' / ')) {
      const jobOnly = t.split(' / ').pop();
      if (jobOnly && (name === jobOnly || name.startsWith(jobOnly)))
        return true;
    }
  }
  return false;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const start = Date.now();
  let printedCatalogue = false;
  let notFoundLoops = 0;
  const notFoundGraceMs = Math.min(timeoutMs, 5 * 60 * 1000); // 5min grace for OPTIONAL

  log(`owner=${owner} repo=${repo} ref=${ref}`);
  log(
    `candidates=${JSON.stringify(targetCandidates)} workflowHint=${targetWorkflowName || '-'} optional=${optional}`
  );

  while (Date.now() - start < timeoutMs) {
    const checks = await listChecks();

    if (!printedCatalogue) {
      const cat = checks
        .map(c => `${c.name} [status=${c.status} conclusion=${c.conclusion}]`)
        .join(', ');
      log(`discovered check-runs: ${cat || '(none)'}`);
      printedCatalogue = true;
    }

    const cr = checks.find(c => matchCheckRunName(c.name));
    const status = cr?.status;
    const conclusion = cr?.conclusion || 'pending';
    log(
      `Waiting for check (match by job name): found=${!!cr} status=${status} conclusion=${conclusion}`
    );

    if (cr && ['success', 'neutral', 'skipped'].includes(conclusion)) return;
    if (
      cr &&
      ['failure', 'timed_out', 'cancelled', 'action_required'].includes(
        conclusion
      )
    ) {
      throw new Error(`${cr.name} concluded: ${conclusion}`);
    }

    if (!cr) {
      notFoundLoops++;
      const elapsed = Date.now() - start;
      if (optional && elapsed >= notFoundGraceMs) {
        log(
          `Target check not found after ${Math.round(elapsed / 1000)}s, OPTIONAL=true → skip waiting.`
        );
        return;
      }
    }

    await sleep(30000);
  }
  throw new Error(`Timeout waiting for ${targetCandidates.join(' | ')}`);
}

main().catch(err => {
  log(String(err));
  process.exit(1);
});

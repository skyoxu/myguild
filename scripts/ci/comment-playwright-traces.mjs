#!/usr/bin/env node
/**
 * Comment PR with a summary of latest Playwright trace manifest.
 * Env:
 * - GITHUB_TOKEN (required)
 * - GITHUB_REPOSITORY / GITHUB_REPOSITORY_OWNER
 * - PR_NUMBER (required when not running in PR context)
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

const token = process.env.GITHUB_TOKEN;
const repoEnv = process.env.GITHUB_REPOSITORY || '';
const owner =
  process.env.GITHUB_REPOSITORY_OWNER ||
  (repoEnv.includes('/') ? repoEnv.split('/')[0] : '');
const repo = repoEnv.includes('/') ? repoEnv.split('/')[1] : '';
const pr = process.env.PR_NUMBER || '';

assert(token, 'GITHUB_TOKEN is required');
assert(owner && repo, 'Cannot resolve repository');

const base = path.join(process.cwd(), 'logs', 'playwright-traces');
function latestDateDir() {
  if (!fs.existsSync(base)) return null;
  const dirs = fs
    .readdirSync(base)
    .filter(d => {
      try {
        return fs.statSync(path.join(base, d)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort()
    .reverse();
  return dirs[0] ? path.join(base, dirs[0]) : null;
}
function loadManifest(dir) {
  if (!dir) return null;
  const file = path.join(dir, 'trace-manifest.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const dir = latestDateDir();
const manifest = loadManifest(dir);
if (!manifest || !Array.isArray(manifest.entries) || !manifest.entries.length) {
  console.log('No trace manifest found to comment');
  process.exit(0);
}
const rel = p => path.relative(process.cwd(), p).replace(/\\/g, '/');
const head = manifest.entries
  .slice(0, 10)
  .map(
    (e, i) =>
      `- ${i + 1}. ${rel(e.target)} (${Math.round((e.size || 0) / 1024)} kB)`
  )
  .join('\n');
const example = rel(manifest.entries[0].target);
const body = [
  '### Playwright Traces (auto-collected)',
  '',
  '**How to replay (locally):**',
  '1. Download the "playwright-traces" artifact from this workflow run',
  `2. Run: \`npx playwright show-trace ${example}\``,
  '',
  '**Latest traces (top 10):**',
  head,
].join('\n');

async function createComment(issue_number) {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}/comments`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(
      `Failed to post comment: ${r.status} ${r.statusText} - ${t}`
    );
  }
}

async function main() {
  let number = pr;
  if (!number) {
    const payloadPath = process.env.GITHUB_EVENT_PATH;
    if (payloadPath && fs.existsSync(payloadPath)) {
      try {
        const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
        number = payload.pull_request?.number || '';
      } catch {}
    }
  }
  if (!number) {
    console.log('No PR context available; skipping comment.');
    return;
  }
  await createComment(number);
  console.log(`Posted trace summary to PR #${number}`);
}

main().catch(err => {
  console.error(String(err));
  process.exit(1);
});

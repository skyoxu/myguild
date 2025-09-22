#!/usr/bin/env node
/**
 * Update branch protection to require a specific status check for a list of branches.
 * Env:
 * - ADMIN_TOKEN or GITHUB_TOKEN: GitHub token with admin permission to update protections
 * - BRANCHES: multiline list of branches
 * - REQUIRED_CONTEXT: status check name to require (default provided)
 * - GITHUB_REPOSITORY or REPO_OWNER/REPO_NAME
 */
import assert from 'node:assert';

const token = process.env.ADMIN_TOKEN || process.env.GITHUB_TOKEN;
const repoEnv = process.env.GITHUB_REPOSITORY || '';
const owner =
  process.env.REPO_OWNER ||
  (repoEnv.includes('/') ? repoEnv.split('/')[0] : '');
const repo =
  process.env.REPO_NAME || (repoEnv.includes('/') ? repoEnv.split('/')[1] : '');
const requiredContext =
  process.env.REQUIRED_CONTEXT ||
  'Validate Workflows & Guards / Enforce UTF-8 + LF for workflows';
const branchesEnv = process.env.BRANCHES || 'main';
const branches = branchesEnv
  .split(/\r?\n/)
  .map(s => s.trim())
  .filter(Boolean);

async function updateProtection(branch) {
  const url = `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`;
  const body = {
    required_status_checks: {
      strict: true,
      contexts: [requiredContext],
    },
    enforce_admins: true,
    required_pull_request_reviews: {
      required_approving_review_count: 1,
    },
    restrictions: null,
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'workflow-branch-protection-script',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to update ${branch}: ${res.status} ${res.statusText} - ${text}`
    );
  }
}

async function main() {
  try {
    assert(token, 'ADMIN_TOKEN or GITHUB_TOKEN is required');
    assert(owner && repo, 'Cannot resolve repo owner/name');
    if (branches.length === 0) {
      throw new Error('No branches provided');
    }
    console.log(`Updating branch protection for ${owner}/${repo}`);
    console.log(`Required status check: ${requiredContext}`);
    for (const b of branches) {
      console.log(`- ${b}`);
      await updateProtection(b);
    }
    console.log('Branch protection updated successfully.');
  } catch (err) {
    console.error(String(err?.stack || err));
    process.exit(1);
  }
}

main();

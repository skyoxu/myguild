#!/usr/bin/env node
/**
 * Debug script to check GitHub API check-runs naming format
 */

const token = process.env.GITHUB_TOKEN;
const owner = 'skyoxu';
const repo = 'myguild';
const ref = process.env.GITHUB_SHA || 'HEAD';

if (!token) {
  console.error('GITHUB_TOKEN is required');
  process.exit(1);
}

async function listChecks() {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${ref}/check-runs`;
  const r = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'debug-check-names'
    }
  });
  if (!r.ok) throw new Error(`GitHub API error: ${r.status} ${r.statusText}`);
  const j = await r.json();
  return j.check_runs || [];
}

async function main(){
  console.log('Checking GitHub API check-runs for current ref...');
  const checks = await listChecks();

  console.log('\nFound check-runs:');
  checks.forEach((check, index) => {
    console.log(`${index + 1}. Name: "${check.name}"`);
    console.log(`   Status: ${check.status}`);
    console.log(`   Conclusion: ${check.conclusion || 'null'}`);
    console.log(`   App: ${check.app?.name || 'unknown'}`);
    console.log('');
  });

  console.log('\nLooking for Security Gate related checks:');
  const securityChecks = checks.filter(c =>
    c.name.toLowerCase().includes('security') ||
    c.name.toLowerCase().includes('unified')
  );

  securityChecks.forEach(check => {
    console.log(`- Found: "${check.name}" (${check.status}/${check.conclusion || 'pending'})`);
  });

  console.log('\nCurrent TARGET_CHECK_NAME in pr-gatekeeper.yml: "Security Gate (Unified) / Unified Security Gate"');
  const exactMatch = checks.find(c => c.name === 'Security Gate (Unified) / Unified Security Gate');
  if (exactMatch) {
    console.log('✅ Exact match found!');
  } else {
    console.log('❌ No exact match found');
    console.log('Available names that might match:');
    checks.forEach(c => {
      if (c.name.includes('Security') || c.name.includes('Unified')) {
        console.log(`  - "${c.name}"`);
      }
    });
  }
}

main().catch(err => { console.error(String(err)); process.exit(1); });
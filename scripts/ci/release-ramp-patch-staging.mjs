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

// Enhanced error diagnostics
console.log('🔍 Environment check:');
console.log(`- FEED_FILE: ${feed}`);
console.log(`- STAGE: ${stage}`);
console.log(`- Working directory: ${process.cwd()}`);

if (!feed || !stage) {
  console.error('❌ FEED_FILE and STAGE are required');
  process.exit(1);
}

// Verify feed file exists before proceeding
if (!fs.existsSync(feed)) {
  console.error(`❌ Feed file not found: ${feed}`);
  console.log('Available files in current directory:');
  try {
    const files = fs.readdirSync('.', { withFileTypes: true });
    files.forEach(file => {
      console.log(`  ${file.isDirectory() ? '[DIR]' : '[FILE]'} ${file.name}`);
    });
  } catch (err) {
    console.error('Could not list directory contents:', err.message);
  }
  process.exit(1);
}

console.log('✅ Feed file exists, proceeding with staging patch...');

const r = spawnSync(
  process.execPath,
  ['scripts/release/patch-staging-percentage.mjs', feed, stage],
  {
    encoding: 'utf8',
    stdio: 'pipe',
  }
);

// Enhanced error reporting
if (r.status !== 0) {
  console.error('❌ Script failed with status:', r.status);
  console.error('📤 stdout:', r.stdout || '(empty)');
  console.error('📥 stderr:', r.stderr || '(empty)');
  console.error(
    '🔧 Command:',
    `node scripts/release/patch-staging-percentage.mjs "${feed}" "${stage}"`
  );

  // Additional diagnostics
  console.log('🔍 Additional diagnostics:');
  console.log(`- Feed file size: ${fs.statSync(feed).size} bytes`);
  console.log(
    `- Target script exists: ${fs.existsSync('scripts/release/patch-staging-percentage.mjs')}`
  );

  process.exit(r.status ?? 1);
}

const outFile = process.env.GITHUB_OUTPUT;
if (outFile) {
  fs.appendFileSync(
    outFile,
    `staging_result=${JSON.stringify(r.stdout?.trim() || '')}\n`
  );
}

console.log('✅ Staging percentage patched successfully');

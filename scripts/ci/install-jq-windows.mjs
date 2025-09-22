#!/usr/bin/env node
/**
 * Ensure jq is available on Windows runner.
 * - Try PowerShell detection; if missing, attempt choco or winget.
 * - Never fails the workflow; prints status only.
 */
import { execSync } from 'node:child_process';

function hasJq() {
  try {
    execSync('jq --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function has(cmd) {
  try {
    execSync(
      `powershell -NoProfile -Command "Get-Command ${cmd} -ErrorAction SilentlyContinue | Out-Null"`
    );
    return true;
  } catch {
    return false;
  }
}

try {
  if (hasJq()) {
    console.log('jq already available');
    process.exit(0);
  }
  console.log('Installing jq tool...');
  if (has('choco')) {
    execSync('choco install jq -y --no-progress', { stdio: 'inherit' });
  } else if (has('winget')) {
    execSync(
      'winget install stedolan.jq --accept-source-agreements --accept-package-agreements',
      { stdio: 'inherit' }
    );
  } else {
    console.log(
      'Neither choco nor winget available. Please preinstall jq or add a custom installer step.'
    );
  }
} catch (e) {
  console.log(`jq installation attempt failed: ${(e && e.message) || e}`);
}
process.exit(0);

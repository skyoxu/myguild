#!/usr/bin/env node

/**
 * Cache Bust Token Generator for Playwright Transform Cache
 *
 * Generates a unique cache token based on:
 * - Current Git commit hash
 * - Package.json modification time
 * - Playwright config modification time
 * - Node.js version
 *
 * This ensures cache invalidation when any critical component changes
 */

import { writeFileSync, statSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Generate cache bust token based on project state
 */
function generateCacheBustToken() {
  const components = [];

  try {
    // Git commit hash (most important for source code changes)
    const gitHash = execSync('git rev-parse HEAD', {
      cwd: projectRoot,
      encoding: 'utf8',
    })
      .trim()
      .substring(0, 8);
    components.push(`git:${gitHash}`);
  } catch (error) {
    console.warn(
      '[Cache Bust] Warning: Git hash not available, using timestamp'
    );
    components.push(`time:${Date.now()}`);
  }

  // Package.json modification time (dependency changes)
  try {
    const packagePath = join(projectRoot, 'package.json');
    if (existsSync(packagePath)) {
      const packageMtime = Math.floor(statSync(packagePath).mtimeMs / 1000);
      components.push(`pkg:${packageMtime}`);
    }
  } catch (error) {
    console.warn('[Cache Bust] Warning: package.json mtime not available');
  }

  // Playwright config modification time (config changes)
  try {
    const playwrightConfigPath = join(projectRoot, 'playwright.config.ts');
    if (existsSync(playwrightConfigPath)) {
      const configMtime = Math.floor(
        statSync(playwrightConfigPath).mtimeMs / 1000
      );
      components.push(`pw:${configMtime}`);
    }
  } catch (error) {
    console.warn(
      '[Cache Bust] Warning: playwright.config.ts mtime not available'
    );
  }

  // Node.js version (runtime changes)
  const nodeVersion = process.version
    .replace(/^v/, '')
    .split('.')
    .slice(0, 2)
    .join('.');
  components.push(`node:${nodeVersion}`);

  return components.join('-');
}

/**
 * Write cache bust token to environment file
 */
function writeCacheBustToken() {
  const token = generateCacheBustToken();
  const envContent = `# Auto-generated cache bust token
# This file is updated before each test run to ensure cache invalidation
PW_CACHE_BUST=${token}
PW_CACHE_BUST_TIMESTAMP=${new Date().toISOString()}
`;

  const envPath = join(projectRoot, '.env.cache-bust');

  try {
    writeFileSync(envPath, envContent, 'utf8');
    console.log(`[Cache Bust] ✅ Generated token: ${token}`);
    console.log(`[Cache Bust] 📝 Written to: ${envPath}`);

    // Also set as environment variable for current process
    process.env.PW_CACHE_BUST = token;

    return token;
  } catch (error) {
    console.error(
      `[Cache Bust] ❌ Failed to write cache bust token: ${error.message}`
    );
    process.exit(1);
  }
}

// Main execution - run when script is directly executed
const isMainModule = process.argv[1] && __filename.endsWith(process.argv[1]);
if (isMainModule) {
  console.log('[Cache Bust] 🎯 Generating cache bust token...');
  writeCacheBustToken();
  console.log('[Cache Bust] ✅ Cache bust token generation complete');
}

export { generateCacheBustToken, writeCacheBustToken };

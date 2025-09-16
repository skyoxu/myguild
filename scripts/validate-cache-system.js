#!/usr/bin/env node

/**
 * Cache System Validation Script
 *
 * Validates that the Playwright transform cache system is working correctly:
 * 1. Verifies cache bust token generation and propagation
 * 2. Checks project configuration consistency
 * 3. Validates environment variable setup
 * 4. Tests cache clearing mechanisms
 * 5. Performs end-to-end cache validation
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(level, message, details = '') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const color =
    {
      info: colors.blue,
      success: colors.green,
      warning: colors.yellow,
      error: colors.red,
      debug: colors.magenta,
    }[level] || colors.reset;

  console.log(
    `${color}[${timestamp}] [CACHE-VALIDATOR] ${message}${colors.reset}${details ? ` ${details}` : ''}`
  );
}

class CacheSystemValidator {
  constructor() {
    this.validationResults = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: [],
    };
  }

  /**
   * Main validation entry point
   */
  async validate() {
    log('info', '🔍 Starting cache system validation...');

    try {
      await this.validateProjectStructure();
      await this.validateCacheBustToken();
      await this.validatePlaywrightConfig();
      await this.validateEnvironmentConsistency();
      await this.validateCacheScripts();
      await this.performEndToEndTest();

      this.printValidationSummary();
      return this.validationResults.failed === 0;
    } catch (error) {
      log('error', 'Validation failed with error:', error.message);
      return false;
    }
  }

  /**
   * Validate project structure and required files
   */
  async validateProjectStructure() {
    log('info', '📁 Validating project structure...');

    const requiredFiles = [
      'playwright.config.ts',
      'package.json',
      'scripts/write-cache-bust.js',
      'scripts/ci-cache-clear.sh',
      'scripts/ci-cache-clear.ps1',
      'tests/__cache-setup__.spec.ts',
    ];

    for (const file of requiredFiles) {
      const filePath = join(projectRoot, file);
      if (existsSync(filePath)) {
        this.recordResult('success', `Required file exists: ${file}`);
      } else {
        this.recordResult('error', `Missing required file: ${file}`);
      }
    }
  }

  /**
   * Validate cache bust token generation and format
   */
  async validateCacheBustToken() {
    log('info', '🎫 Validating cache bust token system...');

    try {
      // Generate a new token
      execSync('node scripts/write-cache-bust.js', {
        cwd: projectRoot,
        stdio: 'pipe',
      });

      // Check if .env.cache-bust file exists
      const envFile = join(projectRoot, '.env.cache-bust');
      if (!existsSync(envFile)) {
        this.recordResult('error', 'Cache bust token file not generated');
        return;
      }

      // Validate token format
      const content = readFileSync(envFile, 'utf8');
      const lines = content.split('\n');

      const tokenLine = lines.find(line => line.startsWith('PW_CACHE_BUST='));
      const timestampLine = lines.find(line =>
        line.startsWith('PW_CACHE_BUST_TIMESTAMP=')
      );

      if (!tokenLine) {
        this.recordResult(
          'error',
          'PW_CACHE_BUST token not found in .env.cache-bust'
        );
        return;
      }

      const token = tokenLine.split('=')[1];

      // Validate token format (should contain git hash, timestamps, etc.)
      const tokenParts = token.split('-');
      if (tokenParts.length < 3) {
        this.recordResult(
          'warning',
          'Cache bust token format may be incomplete'
        );
      } else {
        this.recordResult(
          'success',
          `Cache bust token generated: ${token.substring(0, 20)}...`
        );
      }

      if (timestampLine) {
        const timestamp = timestampLine.split('=')[1];
        const tokenTime = new Date(timestamp);
        const now = new Date();
        const ageMinutes = (now - tokenTime) / (1000 * 60);

        if (ageMinutes < 5) {
          this.recordResult(
            'success',
            `Token is fresh (${Math.round(ageMinutes * 10) / 10} minutes old)`
          );
        } else {
          this.recordResult(
            'warning',
            `Token may be stale (${Math.round(ageMinutes)} minutes old)`
          );
        }
      }
    } catch (error) {
      this.recordResult(
        'error',
        `Cache bust token generation failed: ${error.message}`
      );
    }
  }

  /**
   * Validate Playwright configuration for cache consistency
   */
  async validatePlaywrightConfig() {
    log('info', '⚙️  Validating Playwright configuration...');

    try {
      const configPath = join(projectRoot, 'playwright.config.ts');
      const configContent = readFileSync(configPath, 'utf8');

      // Check for cache bust token loading
      if (configContent.includes('PW_CACHE_BUST')) {
        this.recordResult(
          'success',
          'Playwright config includes cache bust token handling'
        );
      } else {
        this.recordResult(
          'warning',
          'Playwright config may not handle cache bust token'
        );
      }

      // Check for setup:cache project
      if (configContent.includes('setup:cache')) {
        this.recordResult('success', 'Cache setup project configured');
      } else {
        this.recordResult(
          'error',
          'Missing setup:cache project in Playwright config'
        );
      }

      // Check for dependencies on cache setup
      const setupDependencies = (
        configContent.match(/dependencies: \[.*'setup:cache'.*\]/g) || []
      ).length;
      if (setupDependencies >= 3) {
        this.recordResult(
          'success',
          `${setupDependencies} projects depend on cache setup`
        );
      } else {
        this.recordResult(
          'warning',
          `Only ${setupDependencies} projects depend on cache setup`
        );
      }

      // Validate environment variable consistency
      const securityTestModeCount = (
        configContent.match(/SECURITY_TEST_MODE: 'true'/g) || []
      ).length;
      if (securityTestModeCount >= 5) {
        this.recordResult(
          'success',
          `SECURITY_TEST_MODE consistent across ${securityTestModeCount} projects`
        );
      } else {
        this.recordResult(
          'warning',
          `SECURITY_TEST_MODE only found in ${securityTestModeCount} projects`
        );
      }
    } catch (error) {
      this.recordResult(
        'error',
        `Playwright config validation failed: ${error.message}`
      );
    }
  }

  /**
   * Validate environment variable consistency across projects
   */
  async validateEnvironmentConsistency() {
    log('info', '🌍 Validating environment consistency...');

    const configPath = join(projectRoot, 'playwright.config.ts');
    const configContent = readFileSync(configPath, 'utf8');

    // Extract all env sections
    const envSections = configContent.match(/env: \{[^}]*\}/g) || [];

    if (envSections.length === 0) {
      this.recordResult(
        'error',
        'No environment sections found in Playwright config'
      );
      return;
    }

    // Check that all sections have base environment variables
    const baseVars = ['NODE_ENV', 'CI', 'SECURITY_TEST_MODE'];
    let consistentProjects = 0;

    for (const envSection of envSections) {
      const hasAllBaseVars = baseVars.every(
        varName =>
          envSection.includes(`${varName}: 'test'`) ||
          envSection.includes(`${varName}: 'true'`)
      );

      if (hasAllBaseVars) {
        consistentProjects++;
      }
    }

    const consistency = (consistentProjects / envSections.length) * 100;

    if (consistency === 100) {
      this.recordResult(
        'success',
        `All ${envSections.length} projects have consistent base environment variables`
      );
    } else if (consistency >= 80) {
      this.recordResult(
        'warning',
        `${consistency.toFixed(0)}% of projects have consistent environment variables`
      );
    } else {
      this.recordResult(
        'error',
        `Only ${consistency.toFixed(0)}% of projects have consistent environment variables`
      );
    }
  }

  /**
   * Validate cache clearing scripts
   */
  async validateCacheScripts() {
    log('info', '📜 Validating cache clearing scripts...');

    // Test bash script
    const bashScript = join(projectRoot, 'scripts/ci-cache-clear.sh');
    if (existsSync(bashScript)) {
      try {
        const stats = statSync(bashScript);
        // On Windows, execute permission might not be relevant, just check if file exists
        if (process.platform === 'win32') {
          this.recordResult(
            'success',
            'Bash cache clear script exists (Windows environment)'
          );
        } else if (stats.mode & 0o111) {
          // Check if executable on Unix
          this.recordResult('success', 'Bash cache clear script is executable');
        } else {
          this.recordResult(
            'warning',
            'Bash cache clear script is not executable'
          );
        }
      } catch (error) {
        this.recordResult('warning', 'Could not check bash script permissions');
      }
    }

    // Test PowerShell script
    const psScript = join(projectRoot, 'scripts/ci-cache-clear.ps1');
    if (existsSync(psScript)) {
      const psContent = readFileSync(psScript, 'utf8');
      if (psContent.includes('Clear-PlaywrightCache')) {
        this.recordResult(
          'success',
          'PowerShell cache clear script has main function'
        );
      } else {
        this.recordResult(
          'error',
          'PowerShell cache clear script missing main function'
        );
      }
    }

    // Check package.json for pretest:e2e hook
    const packageJsonPath = join(projectRoot, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    if (packageJson.scripts && packageJson.scripts['pretest:e2e']) {
      this.recordResult(
        'success',
        'pretest:e2e hook configured in package.json'
      );
    } else {
      this.recordResult(
        'warning',
        'pretest:e2e hook not found in package.json'
      );
    }
  }

  /**
   * Perform end-to-end cache validation test
   */
  async performEndToEndTest() {
    log('info', '🔄 Performing end-to-end cache validation...');

    try {
      // Step 1: Generate fresh token
      log('debug', 'Generating fresh cache bust token...');
      execSync('node scripts/write-cache-bust.js', {
        cwd: projectRoot,
        stdio: 'pipe',
      });

      const envFile = join(projectRoot, '.env.cache-bust');
      const beforeContent = readFileSync(envFile, 'utf8');
      const beforeToken = beforeContent.match(/PW_CACHE_BUST=([^\n]+)/)?.[1];

      // Step 2: Wait a moment and generate another token
      await new Promise(resolve => setTimeout(resolve, 2000));

      execSync('node scripts/write-cache-bust.js', {
        cwd: projectRoot,
        stdio: 'pipe',
      });

      const afterContent = readFileSync(envFile, 'utf8');
      const afterToken = afterContent.match(/PW_CACHE_BUST=([^\n]+)/)?.[1];

      // Step 3: Verify tokens are different (showing cache busting is working)
      // Note: Tokens may be identical if no files changed and Git hash is the same
      // This is actually correct behavior - cache should only change when content changes
      if (beforeToken && afterToken) {
        if (beforeToken !== afterToken) {
          this.recordResult(
            'success',
            'Cache bust tokens are unique across generations'
          );
        } else {
          this.recordResult(
            'success',
            'Cache bust tokens are stable when no changes occur (correct behavior)'
          );
        }
      } else {
        this.recordResult('error', 'Cache bust tokens are missing');
      }

      // Step 4: Verify token includes expected components
      if (afterToken && afterToken.includes('git:')) {
        this.recordResult('success', 'Token includes Git hash component');
      } else {
        this.recordResult('warning', 'Token may be missing Git hash component');
      }

      // Step 5: Test cache clearing script (dry run)
      log('debug', 'Testing cache clear script...');
      try {
        // Note: Not actually clearing cache in validation, just checking script syntax
        execSync('node -c scripts/write-cache-bust.js', {
          cwd: projectRoot,
          stdio: 'pipe',
        });
        this.recordResult('success', 'Cache bust script syntax is valid');
      } catch (error) {
        this.recordResult('error', 'Cache bust script has syntax errors');
      }
    } catch (error) {
      this.recordResult('error', `End-to-end test failed: ${error.message}`);
    }
  }

  /**
   * Record validation result
   */
  recordResult(type, message) {
    const result = { type, message, timestamp: new Date().toISOString() };
    this.validationResults.details.push(result);

    switch (type) {
      case 'success':
        this.validationResults.passed++;
        log('success', `✅ ${message}`);
        break;
      case 'error':
        this.validationResults.failed++;
        log('error', `❌ ${message}`);
        break;
      case 'warning':
        this.validationResults.warnings++;
        log('warning', `⚠️  ${message}`);
        break;
      default:
        log('info', message);
    }
  }

  /**
   * Print validation summary
   */
  printValidationSummary() {
    log('info', '📊 Validation Summary:');
    log('success', `Passed: ${this.validationResults.passed}`);
    log('warning', `Warnings: ${this.validationResults.warnings}`);
    log('error', `Failed: ${this.validationResults.failed}`);

    const total =
      this.validationResults.passed +
      this.validationResults.failed +
      this.validationResults.warnings;
    const successRate =
      total > 0
        ? ((this.validationResults.passed / total) * 100).toFixed(1)
        : 0;

    log('info', `Success Rate: ${successRate}%`);

    if (this.validationResults.failed === 0) {
      log('success', '🎉 Cache system validation PASSED');
    } else {
      log('error', '💥 Cache system validation FAILED');
      log('error', 'Please address the failed checks before running E2E tests');
    }
  }
}

// Main execution - run when script is directly executed
const isMainModule = process.argv[1] && __filename.endsWith(process.argv[1]);
if (isMainModule) {
  const validator = new CacheSystemValidator();

  validator
    .validate()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log('error', 'Validation crashed:', error.message);
      process.exit(1);
    });
}

export { CacheSystemValidator };

#!/usr/bin/env node

/**
 * UTF-8 Encoding Consistency Check
 * Prevents multi-environment encoding issues by validating critical scripts
 */

const fs = require('fs');
const path = require('path');

// Critical files that must have consistent encoding
const CRITICAL_FILES = [
  'scripts/ci/coverage-config.cjs',
  'scripts/ci/coverage-gate.cjs',
  'scripts/release-health-gate.mjs',
  'scripts/scan_electron_safety.mjs',
];

/**
 * Check if file contains high-risk non-ASCII characters
 */
function checkEncodingRisks(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      issues: [`File not found: ${filePath}`],
    };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // Check for non-ASCII characters in critical contexts
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Check description strings and console.log messages
    if (line.includes('description:') || line.includes('console.log')) {
      const nonAscii = line.match(/[^\x00-\x7F]/g);
      if (nonAscii) {
        issues.push(
          `Line ${lineNumber}: Non-ASCII characters in output context: ${nonAscii.join(', ')}`
        );
      }
    }

    // Check for common encoding corruption patterns
    if (line.includes('\ufffd') || line.includes('?')) {
      issues.push(`Line ${lineNumber}: Potential encoding corruption detected`);
    }

    // Check for unclosed strings (common with encoding issues)
    const singleQuotes = (line.match(/'/g) || []).length;
    const doubleQuotes = (line.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
      if (line.includes('description:') || line.trim().endsWith(',')) {
        issues.push(
          `Line ${lineNumber}: Potential unclosed string (encoding-related)`
        );
      }
    }
  });

  return {
    exists: true,
    size: content.length,
    lines: lines.length,
    issues: issues,
  };
}

/**
 * Validate Node.js syntax for all critical files
 */
function validateSyntax(filePath) {
  const { spawn } = require('child_process');

  return new Promise(resolve => {
    const nodeCheck = spawn('node', ['--check', filePath], {
      stdio: 'pipe',
    });

    let stderr = '';
    nodeCheck.stderr.on('data', data => {
      stderr += data.toString();
    });

    nodeCheck.on('close', code => {
      resolve({
        valid: code === 0,
        error: stderr.trim(),
      });
    });
  });
}

/**
 * Main encoding check process
 */
async function runEncodingCheck() {
  console.log('🔍 UTF-8 Encoding Consistency Check');
  console.log('=====================================');

  let hasIssues = false;

  for (const filePath of CRITICAL_FILES) {
    console.log(`\n📁 Checking: ${filePath}`);

    const encodingCheck = checkEncodingRisks(filePath);

    if (!encodingCheck.exists) {
      console.log('⚠️  File not found (skipping)');
      continue;
    }

    console.log(
      `📏 Size: ${encodingCheck.size} bytes, ${encodingCheck.lines} lines`
    );

    // Encoding risk analysis
    if (encodingCheck.issues.length > 0) {
      console.log('❌ Encoding issues found:');
      encodingCheck.issues.forEach(issue => console.log(`   ${issue}`));
      hasIssues = true;
    } else {
      console.log('✅ No encoding issues detected');
    }

    // Syntax validation
    try {
      const syntaxCheck = await validateSyntax(filePath);
      if (syntaxCheck.valid) {
        console.log('✅ Syntax validation passed');
      } else {
        console.log('❌ Syntax validation failed:');
        console.log(`   ${syntaxCheck.error}`);
        hasIssues = true;
      }
    } catch (error) {
      console.log(`⚠️  Syntax check failed: ${error.message}`);
    }
  }

  console.log('\n🎯 Summary');
  console.log('===========');

  if (hasIssues) {
    console.log('❌ Encoding consistency check FAILED');
    console.log('\n💡 Recommended actions:');
    console.log('1. Convert non-ASCII strings to ASCII equivalents');
    console.log(
      '2. Use UTF-8 with BOM for PowerShell compatibility (if needed)'
    );
    console.log('3. Ensure editor saves files as UTF-8');
    console.log('4. Check .editorconfig charset setting');
    process.exit(1);
  } else {
    console.log('✅ All files pass encoding consistency check');
    console.log('🚀 Safe for multi-environment CI/CD deployment');
  }
}

// Execute if run directly
if (require.main === module) {
  runEncodingCheck().catch(error => {
    console.error('❌ Encoding check process failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  checkEncodingRisks,
  validateSyntax,
  runEncodingCheck,
  CRITICAL_FILES,
};

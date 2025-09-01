/**
 * CSP Compliance Verification Script
 *
 * This script validates that all CSP configurations comply with ADR-0002 security baseline.
 * It prevents future CSP security violations by enforcing strict compliance checks.
 *
 * Usage:
 * - CI/CD integration: Run as part of quality gates
 * - Pre-commit hook: Validate before code commit
 * - Manual verification: Run anytime to check compliance
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const COMPLIANCE_CHECKS = {
  // Critical security violations (ADR-0002)
  CRITICAL: [
    {
      name: 'unsafe-inline in style-src',
      pattern: /'unsafe-inline'/g,
      description:
        "Violates ADR-0002: 'unsafe-inline' completely bypasses CSP protection",
      severity: 'CRITICAL',
      adrs: ['ADR-0002'],
    },
    {
      name: 'unsafe-eval in script-src',
      pattern: /'unsafe-eval'/g,
      description:
        "Violates ADR-0002: 'unsafe-eval' enables code injection attacks",
      severity: 'CRITICAL',
      adrs: ['ADR-0002'],
    },
  ],

  // Format errors
  HIGH: [
    {
      name: 'connect-src format errors',
      pattern: /https: \/\//g,
      description:
        "CSP syntax error: extra space in 'https: //' should be 'https://'",
      severity: 'HIGH',
      fix: "Remove extra space: 'https: //' -> 'https://'",
    },
    {
      name: 'hardcoded domains',
      pattern: /https?:\/\/api\.guildmanager\.local/g,
      description: 'Base documents should use placeholders: ${PRODUCT_DOMAIN}',
      severity: 'HIGH',
      fix: 'Replace with placeholder: https://api.${PRODUCT_DOMAIN}',
    },
  ],

  // Best practices
  MEDIUM: [
    {
      name: 'missing nonce placeholder',
      pattern: /style-src 'self'(?!.*nonce-\$\{[^}]+\})/g,
      description:
        'Should use nonce mechanism instead of allowing all inline styles',
      severity: 'MEDIUM',
      fix: "Add nonce: style-src 'self' 'nonce-${NONCE_PLACEHOLDER}'",
    },
    {
      name: 'object-src not restricted',
      pattern: /(?!.*object-src 'none')/g,
      description: 'Should explicitly disable object-src for security',
      severity: 'MEDIUM',
      fix: "Add object-src 'none' to CSP",
    },
  ],
};

/**
 * Compliance check results
 */
class ComplianceResult {
  constructor() {
    this.totalFiles = 0;
    this.violationFiles = 0;
    this.violations = [];
    this.isCompliant = true;
    this.summary = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };
  }

  addViolation(violation) {
    this.violations.push(violation);
    this.summary[violation.severity]++;
    this.isCompliant = false;

    // Mark as violation file if not already counted
    if (
      !this.violations.some(v => v.file === violation.file && v !== violation)
    ) {
      this.violationFiles++;
    }
  }

  getComplianceScore() {
    if (this.totalFiles === 0) return 100;
    const compliantFiles = this.totalFiles - this.violationFiles;
    return Math.round((compliantFiles / this.totalFiles) * 100);
  }
}

/**
 * Check a single file for CSP compliance violations
 */
function checkFileCompliance(filePath, content) {
  const violations = [];
  const fileName = path.basename(filePath);

  // Check all compliance categories
  Object.entries(COMPLIANCE_CHECKS).forEach(([category, checks]) => {
    checks.forEach(check => {
      const matches = [...content.matchAll(check.pattern)];
      if (matches.length > 0) {
        matches.forEach((match, index) => {
          violations.push({
            file: fileName,
            filePath: filePath,
            check: check.name,
            severity: check.severity,
            description: check.description,
            adrs: check.adrs || [],
            fix: check.fix || 'See ADR-0002 for guidance',
            matchedText: match[0],
            lineContext: getLineContext(content, match.index),
          });
        });
      }
    });
  });

  return violations;
}

/**
 * Get line context for a match
 */
function getLineContext(content, matchIndex) {
  const lines = content.split('\n');
  let currentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineStart = currentIndex;
    const lineEnd = currentIndex + lines[i].length + 1; // +1 for newline

    if (matchIndex >= lineStart && matchIndex < lineEnd) {
      return {
        lineNumber: i + 1,
        lineContent: lines[i].trim(),
        contextLines: lines.slice(Math.max(0, i - 1), i + 2),
      };
    }

    currentIndex = lineEnd;
  }

  return { lineNumber: 0, lineContent: 'Unknown', contextLines: [] };
}

/**
 * Generate compliance report
 */
function generateComplianceReport(result) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 CSP COMPLIANCE REPORT');
  console.log('='.repeat(80));
  console.log(`Files scanned: ${result.totalFiles}`);
  console.log(`Files with violations: ${result.violationFiles}`);
  console.log(`Compliance score: ${result.getComplianceScore()}%`);
  console.log('');

  // Severity summary
  console.log('📊 VIOLATIONS BY SEVERITY:');
  Object.entries(result.summary).forEach(([severity, count]) => {
    if (count > 0) {
      const icon =
        severity === 'CRITICAL' ? '🚨' : severity === 'HIGH' ? '⚠️' : '📝';
      console.log(`${icon} ${severity}: ${count}`);
    }
  });

  if (result.violations.length === 0) {
    console.log('\n✅ ALL FILES ARE CSP COMPLIANT!');
    console.log('🔐 Security baseline ADR-0002 requirements satisfied.');
    return;
  }

  // Detailed violations
  console.log('\n🚨 DETAILED VIOLATIONS:');
  console.log('-'.repeat(80));

  const violationsByFile = result.violations.reduce((acc, violation) => {
    if (!acc[violation.file]) acc[violation.file] = [];
    acc[violation.file].push(violation);
    return acc;
  }, {});

  Object.entries(violationsByFile).forEach(([file, fileViolations]) => {
    console.log(`\n📄 ${file}:`);
    fileViolations.forEach((violation, index) => {
      const icon =
        violation.severity === 'CRITICAL'
          ? '🚨'
          : violation.severity === 'HIGH'
            ? '⚠️'
            : '📝';
      console.log(`   ${icon} [${violation.severity}] ${violation.check}`);
      console.log(`      Description: ${violation.description}`);
      console.log(
        `      Line ${violation.lineContext.lineNumber}: ${violation.lineContext.lineContent}`
      );
      console.log(`      Fix: ${violation.fix}`);
      if (violation.adrs.length > 0) {
        console.log(`      Related ADRs: ${violation.adrs.join(', ')}`);
      }
      console.log('');
    });
  });

  // Action required section
  console.log('='.repeat(80));
  console.log('🔧 ACTION REQUIRED:');
  console.log('');

  const criticalCount = result.summary.CRITICAL;
  const highCount = result.summary.HIGH;

  if (criticalCount > 0) {
    console.log(
      `🚨 ${criticalCount} CRITICAL violations must be fixed immediately!`
    );
    console.log('   These violations directly compromise security (ADR-0002).');
    console.log('   Run: node scripts/fix-csp-security-violations.mjs');
    console.log('');
  }

  if (highCount > 0) {
    console.log(
      `⚠️ ${highCount} HIGH priority violations should be fixed soon.`
    );
    console.log(
      '   These violations may cause CSP parsing errors or policy gaps.'
    );
    console.log('');
  }

  console.log('📖 For more information, see:');
  console.log('   • docs/adr/ADR-0002-electron-security.md');
  console.log('   • https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP');
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔍 CSP Compliance Verification - DEBUG VERSION');
  console.log(
    'Validating CSP configurations against ADR-0002 security baseline...\n'
  );
  console.log('DEBUG: Script started successfully');

  try {
    const result = new ComplianceResult();

    // Find all files to check
    const patterns = [
      'docs/prd_chunks/**/*.md',
      'docs/architecture/**/*.md',
      'docs/adr/**/*.md',
      'src/**/*.ts',
      'src/**/*.tsx',
      '*.html',
      'public/**/*.html',
    ];

    const allFiles = [];
    for (const pattern of patterns) {
      const files = await glob(pattern);
      allFiles.push(...files);
    }

    const uniqueFiles = [...new Set(allFiles)];
    result.totalFiles = uniqueFiles.length;

    console.log(`📁 Scanning ${result.totalFiles} files for CSP compliance...`);

    // Check each file
    for (const filePath of uniqueFiles) {
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const fileViolations = checkFileCompliance(filePath, content);

      fileViolations.forEach(violation => result.addViolation(violation));
    }

    // Generate and display report
    generateComplianceReport(result);

    // Exit with appropriate code
    if (result.summary.CRITICAL > 0) {
      console.log(
        '\n❌ COMPLIANCE CHECK FAILED: Critical security violations found'
      );
      process.exit(1);
    } else if (result.summary.HIGH > 0) {
      console.log(
        '\n⚠️ COMPLIANCE CHECK WARNING: High priority violations found'
      );
      process.exit(1);
    } else if (result.violations.length > 0) {
      console.log('\n⚠️ COMPLIANCE CHECK WARNING: Minor violations found');
      // Don't fail CI for medium/low priority issues
      process.exit(0);
    } else {
      console.log(
        '\n✅ COMPLIANCE CHECK PASSED: All CSP configurations are compliant'
      );
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Compliance check failed:', error.message);
    process.exit(1);
  }
}

// Execute the script directly
console.log('DEBUG: About to call main()');
main().catch(error => {
  console.error('DEBUG: Main function failed:', error);
  process.exit(1);
});

export { checkFileCompliance, ComplianceResult };

/**
 * CSP Security Violations Emergency Fix Script
 *
 * This script fixes critical CSP security violations found in 24 prd_chunks files:
 * 1. Removes 'unsafe-inline' from style-src (ADR-0002 violation)
 * 2. Fixes connect-src format errors ("https: //" -> "https://")
 * 3. Replaces hardcoded domains with proper placeholders
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const FIXES_APPLIED = {
  unsafeInlineRemoved: 0,
  connectSrcFixed: 0,
  domainsReplacedWithPlaceholders: 0,
  filesProcessed: 0,
};

/**
 * Generate secure CSP configuration compliant with ADR-0002
 */
function getSecureCSPConfig() {
  return `"Electron CSP: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; connect-src 'self' https://api.\${PRODUCT_DOMAIN}; style-src 'self' 'nonce-\${NONCE_PLACEHOLDER}'; img-src 'self' data: https:; font-src 'self'"`;
}

/**
 * Fix CSP violations in file content
 */
function fixCSPViolations(content, filePath) {
  let fixedContent = content;
  const changesApplied = {
    unsafeInlineRemoved: false,
    connectSrcFixed: false,
    domainsReplacedWithPlaceholders: false,
  };

  // Pattern 1: Fix 'unsafe-inline' in style-src (Critical Security Violation)
  const unsafeInlinePattern = /style-src 'self' 'unsafe-inline'/g;
  if (unsafeInlinePattern.test(fixedContent)) {
    fixedContent = fixedContent.replace(
      unsafeInlinePattern,
      "style-src 'self' 'nonce-${NONCE_PLACEHOLDER}'"
    );
    changesApplied.unsafeInlineRemoved = true;
    console.log(`   ✓ Removed 'unsafe-inline' from style-src`);
  }

  // Pattern 2: Fix connect-src format errors ("https: //" -> "https://")
  const connectSrcFormatPattern =
    /connect-src 'self' https: \/\/api\.guildmanager\.local/g;
  if (connectSrcFormatPattern.test(fixedContent)) {
    fixedContent = fixedContent.replace(
      connectSrcFormatPattern,
      "connect-src 'self' https://api.${PRODUCT_DOMAIN}"
    );
    changesApplied.connectSrcFixed = true;
    changesApplied.domainsReplacedWithPlaceholders = true;
    console.log(`   ✓ Fixed connect-src format and replaced with placeholder`);
  }

  // Pattern 3: Alternative fix for any remaining hardcoded domains
  const hardcodedDomainPattern = /https:\/\/api\.guildmanager\.local/g;
  if (hardcodedDomainPattern.test(fixedContent)) {
    fixedContent = fixedContent.replace(
      hardcodedDomainPattern,
      'https://api.${PRODUCT_DOMAIN}'
    );
    changesApplied.domainsReplacedWithPlaceholders = true;
    console.log(`   ✓ Replaced hardcoded domain with placeholder`);
  }

  return { fixedContent, changesApplied };
}

/**
 * Validate that fixes were applied correctly
 */
function validateFixes(content, filePath) {
  const violations = [];

  // Check for remaining 'unsafe-inline'
  if (content.includes("'unsafe-inline'")) {
    violations.push("'unsafe-inline' still present in CSP");
  }

  // Check for format errors in connect-src
  if (content.includes('https: //')) {
    violations.push('connect-src format errors still present');
  }

  // Check for hardcoded domains (should use placeholders)
  if (content.includes('api.guildmanager.local')) {
    violations.push(
      'hardcoded domain still present (should use ${PRODUCT_DOMAIN})'
    );
  }

  return violations;
}

/**
 * Process a single file
 */
async function processFile(filePath) {
  try {
    console.log(`\n📁 Processing: ${path.basename(filePath)}`);

    const content = fs.readFileSync(filePath, 'utf8');
    const { fixedContent, changesApplied } = fixCSPViolations(
      content,
      filePath
    );

    // Apply changes if any fixes were made
    if (Object.values(changesApplied).some(applied => applied)) {
      fs.writeFileSync(filePath, fixedContent, 'utf8');

      // Update global counters
      if (changesApplied.unsafeInlineRemoved)
        FIXES_APPLIED.unsafeInlineRemoved++;
      if (changesApplied.connectSrcFixed) FIXES_APPLIED.connectSrcFixed++;
      if (changesApplied.domainsReplacedWithPlaceholders)
        FIXES_APPLIED.domainsReplacedWithPlaceholders++;

      // Validate fixes were applied correctly
      const violations = validateFixes(fixedContent, filePath);
      if (violations.length > 0) {
        console.log(`   ❌ Validation failed: ${violations.join(', ')}`);
        return { success: false, violations };
      } else {
        console.log(`   ✅ All fixes validated successfully`);
        return { success: true, violations: [] };
      }
    } else {
      console.log(
        `   ⚠️  No CSP violations found (file might already be fixed)`
      );
      return { success: true, violations: [] };
    }
  } catch (error) {
    console.error(`   ❌ Error processing ${filePath}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔧 CSP Security Violations Emergency Fix Script');
  console.log('='.repeat(60));
  console.log(
    'This script fixes critical security violations in PRD chunk files:'
  );
  console.log("• Removes 'unsafe-inline' from style-src (ADR-0002 compliance)");
  console.log('• Fixes connect-src format errors');
  console.log('• Replaces hardcoded domains with placeholders');
  console.log('');

  try {
    // Find all PRD chunk files
    const prdChunksPattern = 'docs/prd_chunks/PRD-Guild-Manager_chunk_*.md';
    const files = await glob(prdChunksPattern);

    if (files.length === 0) {
      console.log('❌ No PRD chunk files found.');
      process.exit(1);
    }

    console.log(`📋 Found ${files.length} PRD chunk files to process\n`);

    // Process each file
    const results = [];
    for (const file of files) {
      const result = await processFile(file);
      results.push({ file, ...result });
      FIXES_APPLIED.filesProcessed++;
    }

    // Generate summary report
    console.log('\n' + '='.repeat(60));
    console.log('📊 FIXES APPLIED SUMMARY:');
    console.log(`Files processed: ${FIXES_APPLIED.filesProcessed}`);
    console.log(
      `'unsafe-inline' removed: ${FIXES_APPLIED.unsafeInlineRemoved}`
    );
    console.log(`connect-src format fixed: ${FIXES_APPLIED.connectSrcFixed}`);
    console.log(
      `Domains replaced with placeholders: ${FIXES_APPLIED.domainsReplacedWithPlaceholders}`
    );

    // Check for any failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.log(`\n❌ ${failures.length} files had errors:`);
      failures.forEach(f => {
        console.log(`   • ${f.file}: ${f.error || f.violations?.join(', ')}`);
      });
      process.exit(1);
    } else {
      console.log(`\n✅ All ${files.length} files fixed successfully!`);
      console.log(
        '\n🔐 SECURITY STATUS: CSP violations resolved, ADR-0002 compliance restored'
      );
    }
  } catch (error) {
    console.error('❌ Script execution failed:', error.message);
    process.exit(1);
  }
}

// Execute the script
main();

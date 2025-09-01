/**
 * Simple CSP Compliance Verification Script (PRD chunks only)
 *
 * Quick verification that CSP security violations have been fixed.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

async function main() {
  console.log('🔍 Simple CSP Compliance Check');
  console.log('Checking PRD chunks for security violations...\n');

  try {
    // Find PRD chunk files
    const files = await glob('docs/prd_chunks/PRD-Guild-Manager_chunk_*.md');
    console.log(`📁 Found ${files.length} PRD chunk files`);

    let violations = 0;
    let totalChecks = 0;

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath);

      // Check for unsafe-inline (Critical violation)
      if (content.includes("'unsafe-inline'")) {
        console.log(`❌ ${fileName}: Contains 'unsafe-inline' (CRITICAL)`);
        violations++;
      }
      totalChecks++;

      // Check for format errors
      if (content.includes('https: //')) {
        console.log(`❌ ${fileName}: Contains format error "https: //" (HIGH)`);
        violations++;
      }
      totalChecks++;

      // Check for hardcoded domains
      if (content.includes('api.guildmanager.local')) {
        console.log(`❌ ${fileName}: Contains hardcoded domain (HIGH)`);
        violations++;
      }
      totalChecks++;
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESULTS:');
    console.log(`Files checked: ${files.length}`);
    console.log(`Total checks: ${totalChecks}`);
    console.log(`Violations found: ${violations}`);

    if (violations === 0) {
      console.log('\n✅ ALL CHECKS PASSED!');
      console.log('🔐 CSP security baseline compliance verified');
      process.exit(0);
    } else {
      console.log(`\n❌ ${violations} violations found!`);
      console.log('🚨 Security baseline compliance FAILED');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

main();

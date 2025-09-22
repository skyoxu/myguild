#!/usr/bin/env node
/**
 * Validate a semantic version string from env INPUT_VERSION.
 */
const version = process.env.INPUT_VERSION || '';
const re = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
if (!re.test(version)) {
  console.error(`Invalid version format: ${version}`);
  console.error('Expected semantic version (e.g., 1.2.3 or 1.2.3-beta.1)');
  process.exit(1);
}
console.log(`Version format valid: ${version}`);

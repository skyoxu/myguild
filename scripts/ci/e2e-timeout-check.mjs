#!/usr/bin/env node
/**
 * Validate E2E_SECURITY_TIMEOUT_MS from environment and print a concise result.
 * - If not set or invalid or out of range, exit 0 to avoid blocking; the caller decides defaulting.
 * - If valid, print a message. Never throws to keep CI stable.
 */
const raw = process.env.E2E_SECURITY_TIMEOUT_MS || '';
try {
  if (!raw.trim()) {
    console.log(
      '[config-check] E2E_SECURITY_TIMEOUT_MS not set, skipping validation'
    );
    process.exit(0);
  }
  const val = Number(raw);
  if (!Number.isFinite(val)) {
    console.log(
      `[config-check] E2E_SECURITY_TIMEOUT_MS is not a valid number: ${raw}, using default`
    );
    process.exit(0);
  }
  if (val < 60000 || val > 900000) {
    console.log(
      `[config-check] E2E_SECURITY_TIMEOUT_MS out of range [60000,900000]: ${val}, using default`
    );
    process.exit(0);
  }
  console.log(`[config-check] E2E_SECURITY_TIMEOUT_MS=${val} (valid)`);
  process.exit(0);
} catch (e) {
  console.log(`[config-check] validation error: ${(e && e.message) || e}`);
  process.exit(0);
}

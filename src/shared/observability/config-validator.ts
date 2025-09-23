/**
 * [compat] main-only shim for legacy path.
 * - Kept to satisfy scripts/verify-observability.js required files.
 * - Do NOT import this from renderer; use metrics-integration.renderer related APIs instead.
 */
export * from './config-validator.main';

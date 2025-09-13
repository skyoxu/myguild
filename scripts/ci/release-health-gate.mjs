#!/usr/bin/env node
/**
 * Release Health Gate (offline-friendly)
 * - 读取环境阈值与结果来源（env 或 本地文件 test-results/release-health.json）
 * - 在无网络环境下运行，便于本地/CI 预检
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function env(k, d = '') {
  return (process.env[k] || d).trim();
}

const envName = (
  env('SENTRY_ENVIRONMENT') ||
  env('NODE_ENV') ||
  'dev'
).toLowerCase();
const thresholds = envName.includes('prod')
  ? { sessions: 99.0, users: 99.0 }
  : envName.includes('stag')
    ? { sessions: 98.0, users: 98.0 }
    : { sessions: 95.0, users: 95.0 };

const soft = ['1', 'true', 'soft'].includes(
  env('HEALTH_GUARD_SOFT').toLowerCase()
);

function loadMetrics() {
  const file = join(process.cwd(), 'test-results', 'release-health.json');
  if (existsSync(file)) {
    const j = JSON.parse(readFileSync(file, 'utf-8'));
    return {
      sessions: Number(j.crashFreeSessions ?? j.sessions ?? 0),
      users: Number(j.crashFreeUsers ?? j.users ?? 0),
      release: j.release || env('SENTRY_RELEASE') || 'unknown',
      env: j.environment || envName,
      source: 'file',
    };
  }
  return {
    sessions: Number(env('CRASH_FREE_SESSIONS') || 0),
    users: Number(env('CRASH_FREE_USERS') || 0),
    release: env('SENTRY_RELEASE') || 'unknown',
    env: envName,
    source: 'env',
  };
}

const m = loadMetrics();

function fmt(v) {
  return `${Number(v).toFixed(2)}%`;
}

const okSessions = m.sessions >= thresholds.sessions;
const okUsers = m.users >= thresholds.users;

const header = `[release-health] env=${m.env} release=${m.release} source=${m.source}`;
console.log(header);
console.log(
  `  crash-free sessions: ${fmt(m.sessions)} (gate ${fmt(thresholds.sessions)})`
);
console.log(
  `  crash-free users   : ${fmt(m.users)} (gate ${fmt(thresholds.users)})`
);

if (okSessions && okUsers) {
  console.log('[release-health] OK');
  process.exit(0);
}

const reason = `[release-health] FAIL sessions_ok=${okSessions} users_ok=${okUsers}`;
if (soft) {
  console.warn(reason, '(soft gate, not failing)');
  process.exit(0);
} else {
  console.error(reason);
  process.exit(1);
}

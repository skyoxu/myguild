#!/usr/bin/env node
/**
 * Unified test runner invoked by the composite action.
 * - Parses inputs via CLI flags
 * - Ensures Electron build exists for E2E/Security/Smoke
 * - Runs appropriate npm script and controls fail-fast behavior
 * - Emits GITHUB_OUTPUT key/values: result, report_path
 * - Writes execution logs under logs/YYYY-MM-DD/ci/
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, vRaw] = a.split('=');
      const key = k.replace(/^--/, '').replace(/-/g, '_');
      const v = vRaw !== undefined ? vRaw : argv[i + 1];
      if (vRaw === undefined) i++;
      out[key] = v ?? '';
    }
  }
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function todayDir() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function writeOutput(name, value) {
  const outFile = process.env.GITHUB_OUTPUT;
  if (outFile) {
    fs.appendFileSync(outFile, `${name}=${value}\n`, 'utf8');
  }
}

function runCmd(cmd, args) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return r;
}

const args = parseArgs(process.argv);
const TEST_TYPE = String(args.test_type || '').trim();
const TIMEOUT_MS = String(args.timeout || '300000').trim();
const FAIL_FAST =
  String(args.fail_fast || 'true')
    .trim()
    .toLowerCase() === 'true';
const REPORTER = String(args.reporter || 'default').trim();
const SHARD = String(args.shard || '').trim();
const GREP = String(args.grep || '').trim();
const OUTPUT_FILE = String(args.output_file || '').trim();

if (!TEST_TYPE) {
  console.error('[run-tests] Missing required --test-type');
  process.exit(2);
}

// Logs directory
const logsRoot = path.join('logs', todayDir(), 'ci');
ensureDir(logsRoot);
const logPath = path.join(logsRoot, `run-tests-${TEST_TYPE}.log`);

function log(msg) {
  const line = `${msg}\n`;
  try {
    fs.appendFileSync(logPath, line, 'utf8');
  } catch {}
  process.stdout.write(line);
}

log(`[run-tests] Start type=${TEST_TYPE}`);
log(
  `[run-tests] Timeout=${TIMEOUT_MS}ms, FailFast=${FAIL_FAST}, Reporter=${REPORTER}`
);

// Ensure Electron build for e2e/security/smoke
if (['e2e', 'security', 'smoke'].includes(TEST_TYPE)) {
  if (!fs.existsSync(path.join('dist-electron', 'main.js'))) {
    log('[run-tests] dist-electron/main.js missing, building once...');
    const build = runCmd('npm', ['run', 'build']);
    fs.appendFileSync(logPath, (build.stdout || '') + (build.stderr || ''));
    if (build.status !== 0) {
      log('[run-tests] Build failed');
      if (FAIL_FAST) {
        writeOutput('result', 'failure');
        writeOutput('report_path', '');
        process.exit(build.status ?? 1);
      }
    }
  }
}

// Build npm command
let npmScript = '';
let extra = [];
switch (TEST_TYPE) {
  case 'unit':
    npmScript = 'test:unit';
    if (REPORTER && REPORTER !== 'default') {
      extra = ['--', `--reporter=${REPORTER}`];
    }
    break;
  case 'coverage':
    npmScript = 'test:coverage';
    break;
  case 'e2e':
    npmScript = 'test:e2e';
    if (TIMEOUT_MS !== '300000') extra = [...extra, `--timeout=${TIMEOUT_MS}`];
    if (SHARD) extra = [...extra, `--shard=${SHARD}`];
    if (GREP) extra = [...extra, `--grep=${GREP}`];
    break;
  case 'security':
    npmScript = 'test:e2e:security';
    if (SHARD) extra = [...extra, `--shard=${SHARD}`];
    if (GREP) extra = [...extra, `--grep=${GREP}`];
    break;
  case 'smoke':
    npmScript = 'test:e2e:smoke';
    if (TIMEOUT_MS !== '300000') extra = [...extra, `--timeout=${TIMEOUT_MS}`];
    break;
  case 'observability':
    npmScript = 'observability:test';
    break;
  default:
    console.error(`[run-tests] Unknown test type: ${TEST_TYPE}`);
    process.exit(3);
}

// Ensure forwarded args marker "--" is present when passing CLI flags
if (extra.length > 0 && extra[0] !== '--') {
  extra = ['--', ...extra];
}

log(`[run-tests] Executing: npm run ${npmScript} ${extra.join(' ')}`.trim());
const r = runCmd('npm', ['run', npmScript, ...extra]);

// Persist child output to logs and console
try {
  fs.appendFileSync(logPath, r.stdout || '', 'utf8');
} catch {}
try {
  fs.appendFileSync(logPath, r.stderr || '', 'utf8');
} catch {}
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);

const success = (r.status ?? 0) === 0;

// Determine report path
let reportPath = '';
try {
  if (OUTPUT_FILE && fs.existsSync(OUTPUT_FILE)) reportPath = OUTPUT_FILE;
  else if (fs.existsSync('test-results')) reportPath = 'test-results/';
  else if (fs.existsSync('coverage')) reportPath = 'coverage/';
} catch {}

if (success) {
  log('[run-tests] Completed: PASS');
  writeOutput('result', 'success');
  writeOutput('report_path', reportPath);
  process.exit(0);
}

log('[run-tests] Completed: FAIL');
writeOutput('result', 'failure');
writeOutput('report_path', reportPath);

if (FAIL_FAST) {
  process.exit(r.status ?? 1);
} else {
  // Non-blocking mode: keep green but mark failure in outputs
  process.exit(0);
}

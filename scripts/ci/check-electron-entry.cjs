#!/usr/bin/env node
/**
 * Electron entry consistency gate (Windows-friendly)
 * - Verifies package.json.main exists after build
 * - Warns/Skips when dist-electron is not built yet (so it can run before E2E)
 * - Logs to logs/ci/YYYY-MM-DD/electron-entry-check-*.log
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function now() {
  return new Date().toISOString();
}

function ensureLogFile() {
  try {
    const d = new Date();
    const dateDir = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    const dir = path.join(process.cwd(), 'logs', 'ci', dateDir);
    fs.mkdirSync(dir, { recursive: true });
    const stamp = d.toISOString().replace(/[:.]/g, '-');
    return path.join(dir, `electron-entry-check-${stamp}.log`);
  } catch {
    return null;
  }
}

const logFile = ensureLogFile();
function log(line) {
  const msg = `[${now()}] ${line}`;
  console.log(msg);
  try {
    if (logFile) fs.writeFileSync(logFile, msg + '\n', { flag: 'a' });
  } catch {}
}

function main() {
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(pkgPath)) {
    log('FAIL: package.json not found');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const mainRel = pkg.main;
  if (!mainRel || typeof mainRel !== 'string') {
    log('FAIL: package.json.main is missing');
    process.exit(1);
  }

  const mainAbs = path.join(process.cwd(), mainRel);
  const distDir = path.join(process.cwd(), 'dist-electron');
  const distExists = fs.existsSync(distDir);

  // If not built yet, skip (allow running before build)
  if (!distExists) {
    log(`SKIP: dist-electron not found yet; main='${mainRel}'`);
    process.exit(0);
  }

  const mainExists = fs.existsSync(mainAbs);
  if (!mainExists) {
    // Heuristic: common historical paths
    const oldPaths = [
      path.join(process.cwd(), 'dist-electron', 'main.js'),
      path.join(process.cwd(), 'dist-electron', 'main.cjs'),
    ].filter(p => fs.existsSync(p));

    if (oldPaths.length) {
      log(
        `FAIL: Built entry exists at '${path.relative(
          process.cwd(),
          oldPaths[0]
        )}' but package.json.main='${mainRel}'. Please align to the built path.`
      );
      process.exit(1);
    }

    // List a few files for diagnostics
    let listing = [];
    try {
      listing = fs.readdirSync(distDir).slice(0, 20);
    } catch {}
    log(
      `FAIL: package.json.main points to '${mainRel}' but file not found after build. dist-electron listing=[${listing.join(
        ', '
      )}]`
    );
    process.exit(1);
  }

  // Optional: verify dist-electron/package.json type commonjs
  const distPkg = path.join(distDir, 'package.json');
  if (fs.existsSync(distPkg)) {
    try {
      const dp = JSON.parse(fs.readFileSync(distPkg, 'utf-8'));
      if (String(dp.type).toLowerCase() !== 'commonjs') {
        log(`WARN: dist-electron/package.json.type != 'commonjs' (got '${dp.type}')`);
      }
    } catch (e) {
      log(`WARN: failed to parse dist-electron/package.json: ${e.message}`);
    }
  } else {
    log('WARN: dist-electron/package.json missing');
  }

  log(`OK: package.json.main='${mainRel}' exists`);
}

main();


#!/usr/bin/env node
/**
 * Update artifacts/manifest.json with a new version entry.
 * Env:
 * - VERSION: version string
 * - ARTIFACT_PATH: file path to artifact (optional; if missing, create placeholder entry)
 */
import fs from 'node:fs';
import path from 'node:path';

const version = process.env.VERSION;
const artifactPath = process.env.ARTIFACT_PATH || '';
if (!version) {
  console.error('VERSION is required');
  process.exit(1);
}

const dir = path.join(process.cwd(), 'artifacts');
fs.mkdirSync(dir, { recursive: true });
const manifestFile = path.join(dir, 'manifest.json');
let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
} catch {}

let fileName = artifactPath ? path.basename(artifactPath) : 'app.exe';
const now = new Date().toISOString();
const entry = {
  path: fileName,
  sha512: 'sha512-placeholder-hash-for-testing',
  size: 52_428_800,
  releaseDate: now,
  files: [
    {
      url: fileName,
      sha512: 'sha512-placeholder-hash-for-testing',
      size: 52_428_800,
    },
  ],
};

manifest[version] = entry;
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');

// Emit to GITHUB_OUTPUT
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `manifest_result={\"ok\":true,\"version\":\"${version}\"}\n`
  );
}
console.log('Manifest updated.');

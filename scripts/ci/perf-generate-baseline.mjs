#!/usr/bin/env node
/**
 * Ensure baseline performance data exists at data/web-vitals/baseline.json
 */
import fs from 'node:fs';
import path from 'node:path';

const baseDir = path.join(process.cwd(), 'data', 'web-vitals');
fs.mkdirSync(baseDir, { recursive: true });

const file = path.join(baseDir, 'baseline.json');
if (!fs.existsSync(file)) {
  const now = new Date().toISOString();
  const content = {
    LCP: 2400,
    INP: 180,
    CLS: 0.08,
    FCP: 1600,
    TTFB: 700,
    timestamp: now,
    environment: 'baseline',
    commit: process.env.GITHUB_SHA || 'unknown',
  };
  fs.writeFileSync(file, JSON.stringify(content, null, 2), 'utf8');
  console.log('Created baseline.json');
} else {
  console.log('baseline.json already exists');
}

#!/usr/bin/env node
import fs from 'node:fs';
const out = process.env.GITHUB_OUTPUT;
if (!out) process.exit(0);
fs.appendFileSync(out, 'can_proceed=true\n', 'utf8');
console.log('can_proceed=true');

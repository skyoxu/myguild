#!/usr/bin/env node
import fs from 'node:fs';
fs.mkdirSync('logs', { recursive: true });
console.log('logs/ directory ensured');

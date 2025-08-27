import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const v = pkg.version.split('.').map((n: string) => parseInt(n, 10));
v[2] += 1; // patch
pkg.version = v.join('.');
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('Bumped version to', pkg.version);

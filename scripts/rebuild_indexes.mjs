// scripts/rebuild_indexes.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';

const REPO = process.cwd();
const BASE_DIR = process.env.BASE_DIR ?? 'docs/architecture/base';
const PRD_DIR = process.env.PRD_DIR ?? 'docs/prd_chunks';

const INCLUDE_EXT = /\.(md|mdx)$/i; // ✅ 大小写不敏感，支持 .md / .mdx
const EXCLUDE_INDEX = new Set(['index.md', '_index.md']);

async function walk(dir) {
  const out = [];
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    // fs.Dirent
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const rel = p =>
  p
    .split(path.sep)
    .join('/')
    .replace(REPO.replace(/\\/g, '/') + '/', '');
const naturalSort = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

async function buildBase() {
  const files = (await walk(BASE_DIR))
    .filter(p => INCLUDE_EXT.test(p))
    .filter(p => !EXCLUDE_INDEX.has(path.basename(p).toLowerCase()))
    .filter(p => !/[\/\\]08-[^/\\]*$/i.test(p)) // 排除 08-* 模板
    .map(rel)
    .sort(naturalSort);
  await fs.writeFile(
    'architecture_base.index',
    files.join('\n') + '\n',
    'utf8'
  );
  console.log(`BASE: ${files.length} files`);
}

async function buildPrd() {
  const files = (await walk(PRD_DIR))
    .filter(p => INCLUDE_EXT.test(p))
    .filter(p => !EXCLUDE_INDEX.has(path.basename(p).toLowerCase()))
    .map(rel)
    .sort(naturalSort);
  await fs.writeFile('prd_chunks.index', files.join('\n') + '\n', 'utf8');
  console.log(`PRD: ${files.length} files`);
}

await buildBase();
await buildPrd();

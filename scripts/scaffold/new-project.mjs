#!/usr/bin/env node
/**
 * Scaffold a new project from the current repository snapshot (Windows-first).
 * - Copies selected directories/files into a target path
 * - Patches package.json name/productName/version
 * - Creates overlay skeleton docs (CH08) for the given PRD-ID
 * - Logs actions under logs/YYYY-MM-DD/scaffold/
 *
 * Usage (PowerShell):
 *   node scripts/scaffold/new-project.mjs --target C:\path\NewProj \
 *     --name new-proj --productName "NewProj" --prdId PRD-NewProj --domainPrefix newproj
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function timestamp() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}${mm}${ss}`;
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch (e) {
    return false;
  }
}

async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fsp.copyFile(src, dest);
}

async function copyDirFiltered(srcDir, destDir, filterFn) {
  const items = await fsp.readdir(srcDir, { withFileTypes: true });
  for (const it of items) {
    const src = path.join(srcDir, it.name);
    const dest = path.join(destDir, it.name);
    if (!(await filterFn(src, it))) continue;
    if (it.isDirectory()) {
      await copyDirFiltered(src, dest, filterFn);
    } else if (it.isFile()) {
      await copyFile(src, dest);
    }
  }
}

function defaultFilterFactory(root) {
  const rootAbs = path.resolve(root);
  const exclude = new Set([
    '.git',
    'node_modules',
    'dist',
    'dist-electron',
    'logs',
    'artifacts',
    'backups',
    'citest',
    'claudedocs',
    'examples',
    '.bmad-2d-phaser-game-dev',
    '.bmad-2d-unity-game-dev',
    '.bmad-core',
    '.bmad-infrastructure-devops',
    '.clinerules',
    '.cursor',
    '.gemini',
    '.roo',
    '.serena',
    '.windsurf',
    '.zed',
    'github_gpt' // per AGENTS.md: never include
  ]);
  // Only include curated top-level items
  const includeTop = new Set([
    'src',
    'electron',
    'tests',
    'public',
    'scripts',
    '.github',
    '.husky',
    '.taskmaster',
    'docs',
    'tailwind.config.js',
    'vite.config.ts',
    'vitest.setup.ts',
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.node.json',
    'package.json',
    'README.md'
  ]);
  return async function filterFn(src, dirent) {
    const rel = path.relative(rootAbs, src);
    const parts = rel.split(path.sep);
    // Exclude if matches any excluded top-level folder
    if (parts.length === 1) {
      if (exclude.has(parts[0])) return false;
      // Only copy curated whitelist
      if (!includeTop.has(parts[0])) return false;
    }
    // Inside docs: keep base + default ADRs + overlays skeleton (created later)
    if (parts[0] === 'docs') {
      if (parts[1] === 'adr') {
        // allow only ADR-0001..0015
        if (dirent.isFile()) {
          return /^ADR-00(0[1-9]|1[0-5])-.+\.md$/i.test(path.basename(src));
        }
        return true;
      }
      if (parts[1] === 'architecture') {
        if (parts[2] === 'base') return true;
        // Skip overlays here; we'll create skeleton later
        if (parts[2] === 'overlays') return false;
      }
    }
    // In scripts: keep everything (they are part of CI gates), but ensure we don't bring caches
    // In tests/src/electron: keep all
    return true;
  };
}

async function patchPackageJson(destRoot, { name, productName }) {
  const pjPath = path.join(destRoot, 'package.json');
  const buf = await fsp.readFile(pjPath, 'utf8');
  const obj = JSON.parse(buf);
  if (name) obj.name = name;
  if (productName) obj.productName = productName;
  // Reset version for new project
  obj.version = '0.1.0';
  // Ensure private remains true
  obj.private = true;
  // Keep type: module as-is
  await fsp.writeFile(pjPath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

async function createOverlaySkeleton(destRoot, { prdId }) {
  if (!prdId) return;
  const dir = path.join(destRoot, 'docs', 'architecture', 'overlays', prdId, '08');
  await ensureDir(dir);
  const idx = path.join(dir, '_index.md');
  const content = `# 08 功能纵切索引 (${prdId})\n\n- 约束：仅引用 CH01/CH02/CH03；阈值不复制\n- 契约与事件：统一引用 src/shared/contracts/**\n- Test-Refs：tests/e2e/** 与 tests/unit/** 占位\n`;
  await fsp.writeFile(idx, content, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv);
  const { target, name, productName, prdId, domainPrefix } = args;
  if (!target) {
    console.error('[x] 缺少 --target 目标目录');
    process.exit(1);
  }
  // Logging
  const logsBase = path.resolve(process.cwd(), 'logs', today(), 'scaffold');
  await ensureDir(logsBase);
  const logFile = path.join(logsBase, `scaffold-${timestamp()}.log`);
  const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, line);
    console.log(msg);
  };
  log(`开始脚手架：target=${target} name=${name || ''} productName=${productName || ''} prdId=${prdId || ''} domainPrefix=${domainPrefix || ''}`);

  const srcRoot = path.resolve(process.cwd());
  const destRoot = path.resolve(target);
  if (fs.existsSync(destRoot) && fs.readdirSync(destRoot).length > 0) {
    log('[!] 目标目录非空，将尝试在其中创建项目');
  }
  await ensureDir(destRoot);

  const filterFn = defaultFilterFactory(srcRoot);
  await copyDirFiltered(srcRoot, destRoot, filterFn);
  log('基础文件复制完成');

  // Patch package.json
  await patchPackageJson(destRoot, { name, productName });
  log('package.json 已更新 name/productName/version');

  // Create overlays skeleton
  await createOverlaySkeleton(destRoot, { prdId });
  log('Overlays CH08 索引已创建（如提供 prdId）');

  // Remove any .git in target if accidentally copied (should be filtered, but just in case)
  const gitDir = path.join(destRoot, '.git');
  if (fs.existsSync(gitDir)) {
    await fsp.rm(gitDir, { recursive: true, force: true });
    log('移除目标中的 .git 目录');
  }

  // Write a bootstrap summary
  const summary = [
    '# 新项目初始化摘要',
    `- 目标目录: ${destRoot}`,
    `- 项目名: ${name || '(保持原值)'}`,
    `- 产品名: ${productName || '(保持原值)'}`,
    `- PRD-ID: ${prdId || '(未设置)'}`,
    `- Domain Prefix: ${domainPrefix || '(未设置)'}`,
    '',
    '后续步骤（Windows）：',
    '- 进入目标目录：`cd <target>`',
    '- 安装依赖：`npm install`',
    '- 安装 Playwright 运行时：`npx playwright install`（Windows 无需 --with-deps）',
    '- 本地开发：`npm run dev` 与 `npm run dev:electron`',
    '- 运行质量门禁：`npm run guard:ci`',
  ].join('\n');
  await fsp.writeFile(path.join(destRoot, 'BOOTSTRAP_SUMMARY.md'), summary, 'utf8');
  log('生成 BOOTSTRAP_SUMMARY.md');

  log('脚手架完成。');
}

main().catch((err) => {
  try {
    const logsBase = path.resolve(process.cwd(), 'logs', today(), 'scaffold');
    fs.mkdirSync(logsBase, { recursive: true });
    const logFile = path.join(logsBase, `scaffold-${timestamp()}-error.log`);
    fs.writeFileSync(logFile, String(err && err.stack || err), 'utf8');
  } catch {}
  console.error('[x] 脚手架失败:', err);
  process.exit(1);
});


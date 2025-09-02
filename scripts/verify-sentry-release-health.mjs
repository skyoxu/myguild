#!/usr/bin/env node
/**
 * Sentry Release Health验证脚本
 * 验证主进程和渲染进程的Sentry配置是否正确支持Release Health
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

console.log('🔍 验证Sentry Release Health配置...\n');

// 1. 检查环境变量配置
console.log('1️⃣ 检查环境变量配置');
const envPath = join(projectRoot, '.env');
if (!existsSync(envPath)) {
  console.error('❌ .env文件不存在');
  process.exit(1);
}

const envContent = readFileSync(envPath, 'utf-8');
const requiredEnvVars = ['SENTRY_DSN', 'APP_VERSION'];
let envCheckPassed = true;

for (const envVar of requiredEnvVars) {
  if (
    envContent.includes(`${envVar}=`) &&
    !envContent.includes(`${envVar}=placeholder`)
  ) {
    console.log(`  ✅ ${envVar} 已配置`);
  } else {
    console.log(`  ❌ ${envVar} 未正确配置或仍为占位符`);
    envCheckPassed = false;
  }
}

// 2. 检查主进程Sentry配置
console.log('\n2️⃣ 检查主进程Sentry配置');
const sentryMainPath = join(
  projectRoot,
  'src/shared/observability/sentry-main.ts'
);
if (!existsSync(sentryMainPath)) {
  console.error('❌ sentry-main.ts文件不存在');
  process.exit(1);
}

const sentryMainContent = readFileSync(sentryMainPath, 'utf-8');
const mainProcessChecks = [
  { pattern: 'autoSessionTracking: true', name: 'autoSessionTracking启用' },
  { pattern: 'process.env.SENTRY_DSN', name: 'DSN环境变量引用' },
  { pattern: 'app.getVersion?.', name: '应用版本获取' },
];

let mainCheckPassed = true;
for (const check of mainProcessChecks) {
  if (sentryMainContent.includes(check.pattern)) {
    console.log(`  ✅ ${check.name}`);
  } else {
    console.log(`  ❌ ${check.name} 缺失`);
    mainCheckPassed = false;
  }
}

// 3. 检查渲染进程Sentry配置
console.log('\n3️⃣ 检查渲染进程Sentry配置');
const sentryRendererPath = join(
  projectRoot,
  'src/shared/observability/sentry-renderer.ts'
);
if (!existsSync(sentryRendererPath)) {
  console.error('❌ sentry-renderer.ts文件不存在');
  process.exit(1);
}

const sentryRendererContent = readFileSync(sentryRendererPath, 'utf-8');
const rendererProcessChecks = [
  { pattern: 'autoSessionTracking: true', name: 'autoSessionTracking启用' },
  { pattern: 'process.env.SENTRY_DSN', name: 'DSN环境变量引用' },
  { pattern: 'window.__APP_VERSION__', name: '应用版本引用' },
];

let rendererCheckPassed = true;
for (const check of rendererProcessChecks) {
  if (sentryRendererContent.includes(check.pattern)) {
    console.log(`  ✅ ${check.name}`);
  } else {
    console.log(`  ❌ ${check.name} 缺失`);
    rendererCheckPassed = false;
  }
}

// 4. 检查preload脚本中的版本暴露
console.log('\n4️⃣ 检查preload脚本版本暴露');
const preloadPath = join(projectRoot, 'electron/preload.ts');
if (!existsSync(preloadPath)) {
  console.error('❌ preload.ts文件不存在');
  process.exit(1);
}

const preloadContent = readFileSync(preloadPath, 'utf-8');
let preloadCheckPassed = true;

if (
  preloadContent.includes('__APP_VERSION__') &&
  preloadContent.includes('process.env.APP_VERSION')
) {
  console.log('  ✅ APP_VERSION版本信息已暴露到渲染进程');
} else {
  console.log('  ❌ APP_VERSION版本信息未正确暴露');
  preloadCheckPassed = false;
}

// 5. 检查package.json版本
console.log('\n5️⃣ 检查package.json版本信息');
const packageJsonPath = join(projectRoot, 'package.json');
if (!existsSync(packageJsonPath)) {
  console.error('❌ package.json文件不存在');
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
if (packageJson.version) {
  console.log(`  ✅ 应用版本: ${packageJson.version}`);
} else {
  console.log('  ❌ package.json中缺少版本信息');
  preloadCheckPassed = false;
}

// 总结
console.log('\n📊 验证结果总结:');
const allChecksPassed =
  envCheckPassed &&
  mainCheckPassed &&
  rendererCheckPassed &&
  preloadCheckPassed;

if (allChecksPassed) {
  console.log('✅ 所有Release Health配置检查通过');
  console.log('\n🎯 Release Health功能说明:');
  console.log('• Crash-Free Sessions: 衡量应用稳定性的会话级指标');
  console.log('• Crash-Free Users: 衡量应用稳定性的用户级指标');
  console.log('• 这些指标可作为guard:ci门禁的放量标准');
  console.log('• 低于阈值时自动回滚发版，保障用户体验');
  console.log('• 支持A/B测试和渐进式发布策略');
  process.exit(0);
} else {
  console.log('❌ 部分配置检查未通过，请修复后重试');
  process.exit(1);
}

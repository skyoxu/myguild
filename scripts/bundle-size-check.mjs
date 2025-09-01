#!/usr/bin/env node
/**
 * Bundle Size Check Script
 * 检查构建产物大小，防止bundle膨胀
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadQualityGatesConfig } from './utils/config-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从配置中心加载bundle大小限制
const environment = process.env.NODE_ENV || 'default';
const config = loadQualityGatesConfig(environment);
const bundleConfig = config.bundleSize;

const SIZE_LIMITS = {
  'dist-electron/main.js': bundleConfig.mainProcess.threshold,
  'dist/index.html': bundleConfig.renderer.html.threshold,
  'dist/assets/index.js': bundleConfig.renderer.js.threshold,
  'dist/assets/index.css': bundleConfig.renderer.css.threshold,
};

// 格式化文件大小
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 获取文件大小
function getFileSize(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const stats = fs.statSync(fullPath);
    return stats.size;
  } catch (error) {
    console.warn(`⚠️  文件不存在: ${filePath}`);
    return 0;
  }
}

// 检查bundle大小
function checkBundleSize() {
  console.log('📦 Bundle Size Check');
  console.log('==================');

  let hasViolations = false;
  const results = [];

  for (const [filePath, limit] of Object.entries(SIZE_LIMITS)) {
    const actualSize = getFileSize(filePath);
    const percentage = limit > 0 ? ((actualSize / limit) * 100).toFixed(1) : 0;

    const result = {
      file: filePath,
      actual: actualSize,
      limit: limit,
      percentage: percentage,
      violation: actualSize > limit,
    };

    results.push(result);

    if (result.violation) {
      hasViolations = true;
      console.log(`❌ ${filePath}`);
      console.log(`   实际大小: ${formatBytes(actualSize)} (${percentage}%)`);
      console.log(`   限制大小: ${formatBytes(limit)}`);
      console.log(`   超出: ${formatBytes(actualSize - limit)}`);
    } else {
      console.log(`✅ ${filePath}`);
      console.log(
        `   大小: ${formatBytes(actualSize)} (${percentage}% of limit)`
      );
    }
    console.log();
  }

  // 总结
  console.log('📊 Bundle Size Summary');
  console.log('====================');

  const totalActual = results.reduce((sum, r) => sum + r.actual, 0);
  const totalLimit = results.reduce((sum, r) => sum + r.limit, 0);
  const overallPercentage = ((totalActual / totalLimit) * 100).toFixed(1);

  console.log(
    `总大小: ${formatBytes(totalActual)} / ${formatBytes(totalLimit)} (${overallPercentage}%)`
  );
  console.log(
    `违规文件: ${results.filter(r => r.violation).length} / ${results.length}`
  );

  if (hasViolations) {
    console.log('❌ Bundle size check failed!');
    console.log(
      '💡 建议: 检查是否引入了不必要的大型依赖，考虑代码分割或懒加载'
    );
    process.exit(1);
  } else {
    console.log('✅ All bundle sizes are within limits!');
  }
}

// 运行检查
checkBundleSize();

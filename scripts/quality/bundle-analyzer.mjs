#!/usr/bin/env node

/**
 * Bundle 体积分析和门禁脚本
 *
 * 基于 Vite 和 rollup-plugin-visualizer 实现包体积监控和阈值检查
 *
 * 功能：
 * - 生成 bundle 可视化报告 (stats.html)
 * - 检查包体积阈值 (主包、分包、总体积)
 * - 对比前次构建的体积变化
 * - 输出 CI 可用的结构化报告
 * - 支持不同环境的阈值配置
 *
 * Usage:
 *   node scripts/quality/bundle-analyzer.mjs --build
 *   node scripts/quality/bundle-analyzer.mjs --analyze
 *   node scripts/quality/bundle-analyzer.mjs --gate
 *
 * 环境变量:
 *   MAIN_BUNDLE_MAX_MB      - 主包体积上限 (默认: 1.5MB)
 *   VENDOR_BUNDLE_MAX_MB    - vendor包体积上限 (默认: 3.0MB)
 *   TOTAL_BUNDLE_MAX_MB     - 总体积上限 (默认: 5.0MB)
 *   BUNDLE_INCREASE_MAX_PCT - 体积增长上限百分比 (默认: 10%)
 *   SKIP_BUNDLE_GATE        - 跳过体积门禁 (默认: false)
 *
 * 退出码:
 *   0 - 体积检查通过
 *   1 - 体积超过阈值
 *   2 - 构建失败
 *   3 - 分析工具错误
 *
 * 基于:
 * - Vite Bundle Analyzer: https://vitejs.dev/guide/build.html#load-performance-analysis
 * - rollup-plugin-visualizer: https://github.com/btd/rollup-plugin-visualizer
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 配置常量
const DEFAULT_CONFIG = {
  mainBundleMaxMB: parseFloat(process.env.MAIN_BUNDLE_MAX_MB) || 1.5,
  vendorBundleMaxMB: parseFloat(process.env.VENDOR_BUNDLE_MAX_MB) || 3.0,
  totalBundleMaxMB: parseFloat(process.env.TOTAL_BUNDLE_MAX_MB) || 5.0,
  bundleIncreaseMaxPct: parseFloat(process.env.BUNDLE_INCREASE_MAX_PCT) || 10,
  skipBundleGate: process.env.SKIP_BUNDLE_GATE === 'true',
  distDir: 'dist',
  statsFile: 'dist/stats.html',
  reportFile: 'reports/bundle-analysis.json',
  logLevel: process.env.LOG_LEVEL || 'info',
};

// 日志级别
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLogLevel = LOG_LEVELS[DEFAULT_CONFIG.logLevel] || LOG_LEVELS.info;

/**
 * 结构化日志输出
 */
function log(level, message, data = {}) {
  if (LOG_LEVELS[level] > currentLogLevel) return;

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    component: 'bundle-analyzer',
    message,
    ...data,
  };

  const output = level === 'error' ? console.error : console.log;
  output(JSON.stringify(logEntry));
}

/**
 * 执行 Vite 构建并生成 bundle stats
 */
function buildWithStats() {
  try {
    log('info', 'Starting Vite build with bundle analysis');

    // 检查是否有 vite.config.ts 文件
    const viteConfigExists =
      fs.existsSync('vite.config.ts') || fs.existsSync('vite.config.js');
    if (!viteConfigExists) {
      throw new Error('vite.config.ts or vite.config.js not found');
    }

    // 执行构建命令，启用 bundle analyzer
    const buildCmd = 'npm run build -- --mode=analysis';

    log('debug', 'Executing build command', { command: buildCmd });

    const buildOutput = execSync(buildCmd, {
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    log('info', 'Vite build completed successfully');

    return {
      success: true,
      output: buildOutput,
      statsFile: DEFAULT_CONFIG.statsFile,
    };
  } catch (error) {
    log('error', 'Vite build failed', {
      error: error.message,
      stderr: error.stderr?.toString(),
      stdout: error.stdout?.toString(),
    });

    throw new Error(`Build failed: ${error.message}`);
  }
}

/**
 * 分析 dist 目录中的文件大小
 */
function analyzeBundleFiles() {
  try {
    const distDir = DEFAULT_CONFIG.distDir;

    if (!fs.existsSync(distDir)) {
      throw new Error(`Distribution directory not found: ${distDir}`);
    }

    log('info', 'Analyzing bundle files', { distDir });

    const files = fs.readdirSync(distDir, { recursive: true });
    const analysis = {
      files: [],
      summary: {
        totalSize: 0,
        mainBundleSize: 0,
        vendorBundleSize: 0,
        cssSize: 0,
        assetsSize: 0,
      },
    };

    for (const file of files) {
      const filePath = path.join(distDir, file);

      // 跳过目录和非文件
      if (!fs.statSync(filePath).isFile()) continue;

      const stats = fs.statSync(filePath);
      const sizeMB = stats.size / 1024 / 1024;

      const fileInfo = {
        name: file,
        path: filePath,
        size: stats.size,
        sizeMB: Math.round(sizeMB * 1000) / 1000, // 保留3位小数
        type: getFileType(file),
      };

      analysis.files.push(fileInfo);
      analysis.summary.totalSize += stats.size;

      // 按文件类型分类统计
      switch (fileInfo.type) {
        case 'main-js':
          analysis.summary.mainBundleSize += stats.size;
          break;
        case 'vendor-js':
          analysis.summary.vendorBundleSize += stats.size;
          break;
        case 'css':
          analysis.summary.cssSize += stats.size;
          break;
        case 'asset':
          analysis.summary.assetsSize += stats.size;
          break;
      }
    }

    // 转换为 MB 并排序
    analysis.files.sort((a, b) => b.size - a.size);

    Object.keys(analysis.summary).forEach(key => {
      if (key.endsWith('Size')) {
        analysis.summary[key + 'MB'] =
          Math.round((analysis.summary[key] / 1024 / 1024) * 1000) / 1000;
      }
    });

    log('info', 'Bundle analysis completed', {
      totalFiles: analysis.files.length,
      totalSizeMB: analysis.summary.totalSizeMB,
      mainBundleMB: analysis.summary.mainBundleSizeMB,
      vendorBundleMB: analysis.summary.vendorBundleSizeMB,
    });

    return analysis;
  } catch (error) {
    log('error', 'Bundle analysis failed', { error: error.message });
    throw error;
  }
}

/**
 * 根据文件名判断文件类型
 */
function getFileType(fileName) {
  const name = fileName.toLowerCase();

  if (name.includes('vendor') || name.includes('chunk')) {
    return name.endsWith('.js') ? 'vendor-js' : 'vendor-other';
  }

  if (name.includes('index') || name.includes('main')) {
    return name.endsWith('.js') ? 'main-js' : 'main-other';
  }

  if (name.endsWith('.css')) {
    return 'css';
  }

  if (name.endsWith('.js') || name.endsWith('.mjs')) {
    return 'js';
  }

  if (name.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)) {
    return 'image';
  }

  if (name.match(/\.(woff|woff2|ttf|eot)$/)) {
    return 'font';
  }

  return 'asset';
}

/**
 * 加载之前的构建分析结果
 */
function loadPreviousAnalysis() {
  try {
    const reportPath = DEFAULT_CONFIG.reportFile;

    if (!fs.existsSync(reportPath)) {
      log('debug', 'No previous analysis found', { reportPath });
      return null;
    }

    const content = fs.readFileSync(reportPath, 'utf8');
    const data = JSON.parse(content);

    log('debug', 'Previous analysis loaded', {
      timestamp: data.timestamp,
      totalSizeMB: data.analysis?.summary?.totalSizeMB,
    });

    return data;
  } catch (error) {
    log('warn', 'Failed to load previous analysis', { error: error.message });
    return null;
  }
}

/**
 * 执行体积门禁检查
 */
function performSizeGate(analysis, previousAnalysis) {
  const gates = {
    timestamp: new Date().toISOString(),
    passed: true,
    failures: [],
    warnings: [],
    checks: [],
  };

  // 1. 主包体积检查
  const mainBundleCheck = {
    name: 'main_bundle_size',
    actual: analysis.summary.mainBundleSizeMB,
    threshold: DEFAULT_CONFIG.mainBundleMaxMB,
    passed: analysis.summary.mainBundleSizeMB <= DEFAULT_CONFIG.mainBundleMaxMB,
  };

  gates.checks.push(mainBundleCheck);

  if (!mainBundleCheck.passed) {
    gates.failures.push(
      `Main bundle size ${mainBundleCheck.actual}MB exceeds limit ${mainBundleCheck.threshold}MB`
    );
  }

  // 2. Vendor包体积检查
  const vendorBundleCheck = {
    name: 'vendor_bundle_size',
    actual: analysis.summary.vendorBundleSizeMB,
    threshold: DEFAULT_CONFIG.vendorBundleMaxMB,
    passed:
      analysis.summary.vendorBundleSizeMB <= DEFAULT_CONFIG.vendorBundleMaxMB,
  };

  gates.checks.push(vendorBundleCheck);

  if (!vendorBundleCheck.passed) {
    gates.failures.push(
      `Vendor bundle size ${vendorBundleCheck.actual}MB exceeds limit ${vendorBundleCheck.threshold}MB`
    );
  }

  // 3. 总体积检查
  const totalSizeCheck = {
    name: 'total_bundle_size',
    actual: analysis.summary.totalSizeMB,
    threshold: DEFAULT_CONFIG.totalBundleMaxMB,
    passed: analysis.summary.totalSizeMB <= DEFAULT_CONFIG.totalBundleMaxMB,
  };

  gates.checks.push(totalSizeCheck);

  if (!totalSizeCheck.passed) {
    gates.failures.push(
      `Total bundle size ${totalSizeCheck.actual}MB exceeds limit ${totalSizeCheck.threshold}MB`
    );
  }

  // 4. 体积增长检查 (如果有历史数据)
  if (previousAnalysis && previousAnalysis.analysis) {
    const prevSize = previousAnalysis.analysis.summary.totalSizeMB;
    const currentSize = analysis.summary.totalSizeMB;
    const increasePercent =
      Math.round(((currentSize - prevSize) / prevSize) * 10000) / 100;

    const sizeIncreaseCheck = {
      name: 'size_increase',
      actual: increasePercent,
      threshold: DEFAULT_CONFIG.bundleIncreaseMaxPct,
      passed: increasePercent <= DEFAULT_CONFIG.bundleIncreaseMaxPct,
      previousSize: prevSize,
      currentSize: currentSize,
    };

    gates.checks.push(sizeIncreaseCheck);

    if (!sizeIncreaseCheck.passed) {
      gates.failures.push(
        `Bundle size increased by ${increasePercent}% (limit: ${DEFAULT_CONFIG.bundleIncreaseMaxPct}%)`
      );
    } else if (increasePercent > DEFAULT_CONFIG.bundleIncreaseMaxPct / 2) {
      gates.warnings.push(
        `Bundle size increased by ${increasePercent}% (approaching limit)`
      );
    }
  }

  // 总体结果
  gates.passed = gates.failures.length === 0;

  log('info', 'Size gate checks completed', {
    passed: gates.passed,
    failures: gates.failures.length,
    warnings: gates.warnings.length,
  });

  return gates;
}

/**
 * 生成并保存分析报告
 */
function saveAnalysisReport(analysis, gates, buildResult) {
  try {
    // 确保报告目录存在
    const reportDir = path.dirname(DEFAULT_CONFIG.reportFile);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      buildResult,
      analysis,
      gates,
      config: {
        mainBundleMaxMB: DEFAULT_CONFIG.mainBundleMaxMB,
        vendorBundleMaxMB: DEFAULT_CONFIG.vendorBundleMaxMB,
        totalBundleMaxMB: DEFAULT_CONFIG.totalBundleMaxMB,
        bundleIncreaseMaxPct: DEFAULT_CONFIG.bundleIncreaseMaxPct,
      },
    };

    fs.writeFileSync(
      DEFAULT_CONFIG.reportFile,
      JSON.stringify(report, null, 2)
    );

    log('info', 'Analysis report saved', {
      reportFile: DEFAULT_CONFIG.reportFile,
      sizeMB:
        Math.round(
          (fs.statSync(DEFAULT_CONFIG.reportFile).size / 1024 / 1024) * 1000
        ) / 1000,
    });

    return report;
  } catch (error) {
    log('error', 'Failed to save analysis report', { error: error.message });
    throw error;
  }
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
Bundle 体积分析和门禁工具

用法:
  node scripts/quality/bundle-analyzer.mjs [command]

命令:
  --build     构建项目并生成 bundle 统计
  --analyze   分析现有构建的 bundle 大小
  --gate      执行体积门禁检查
  --help, -h  显示帮助信息

环境变量:
  MAIN_BUNDLE_MAX_MB       主包体积上限 (默认: 1.5MB)
  VENDOR_BUNDLE_MAX_MB     vendor包体积上限 (默认: 3.0MB)
  TOTAL_BUNDLE_MAX_MB      总体积上限 (默认: 5.0MB)  
  BUNDLE_INCREASE_MAX_PCT  体积增长上限百分比 (默认: 10%)
  SKIP_BUNDLE_GATE         跳过体积门禁检查
  LOG_LEVEL               日志级别 (error|warn|info|debug)

示例:
  # 构建并执行完整分析
  node scripts/quality/bundle-analyzer.mjs --build

  # 仅分析现有构建
  node scripts/quality/bundle-analyzer.mjs --analyze

  # 执行门禁检查
  node scripts/quality/bundle-analyzer.mjs --gate

  # 设置自定义阈值
  MAIN_BUNDLE_MAX_MB=2.0 node scripts/quality/bundle-analyzer.mjs --gate

输出:
  - dist/stats.html: 可视化 bundle 分析报告
  - reports/bundle-analysis.json: 结构化分析数据
`);
}

/**
 * 主执行函数
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    // 显示帮助
    if (command === '--help' || command === '-h') {
      showHelp();
      process.exit(0);
    }

    log('info', 'Bundle analyzer started', {
      command,
      config: DEFAULT_CONFIG,
      skipGate: DEFAULT_CONFIG.skipBundleGate,
    });

    let buildResult = null;
    let analysis = null;
    let gates = null;

    // 执行对应命令
    switch (command) {
      case '--build':
        // 构建 + 分析 + 门禁
        buildResult = buildWithStats();
        analysis = analyzeBundleFiles();

        if (!DEFAULT_CONFIG.skipBundleGate) {
          const previousAnalysis = loadPreviousAnalysis();
          gates = performSizeGate(analysis, previousAnalysis);
        }
        break;

      case '--analyze':
        // 仅分析现有构建
        analysis = analyzeBundleFiles();
        break;

      case '--gate':
        // 仅执行门禁检查
        if (DEFAULT_CONFIG.skipBundleGate) {
          log('info', 'Bundle gate checks skipped', {
            reason: 'SKIP_BUNDLE_GATE=true',
          });
          break;
        }

        analysis = analyzeBundleFiles();
        const previousAnalysis = loadPreviousAnalysis();
        gates = performSizeGate(analysis, previousAnalysis);
        break;

      default:
        log('error', 'Unknown command', {
          command,
          available: ['--build', '--analyze', '--gate'],
        });
        showHelp();
        process.exit(1);
    }

    // 保存分析报告
    if (analysis) {
      const report = saveAnalysisReport(analysis, gates, buildResult);

      // 输出 CI 友好的结果
      console.log(
        JSON.stringify(
          {
            ok: !gates || gates.passed,
            command,
            analysis: analysis?.summary,
            gates: gates && {
              passed: gates.passed,
              failures: gates.failures,
              warnings: gates.warnings,
            },
            artifacts: {
              statsFile: DEFAULT_CONFIG.statsFile,
              reportFile: DEFAULT_CONFIG.reportFile,
            },
          },
          null,
          2
        )
      );
    }

    // 根据门禁结果设置退出码
    if (gates && !gates.passed) {
      log('error', 'Bundle size gate failed', {
        failures: gates.failures,
        warnings: gates.warnings,
      });
      process.exit(1);
    }

    log('info', 'Bundle analyzer completed successfully');
  } catch (error) {
    log('error', 'Bundle analyzer failed', {
      error: error.message,
      stack: error.stack,
    });

    console.log(
      JSON.stringify({
        ok: false,
        error: error.message,
        command: command || 'unknown',
      })
    );

    if (error.message.includes('Build failed')) {
      process.exit(2);
    } else if (error.message.includes('analysis')) {
      process.exit(3);
    } else {
      process.exit(1);
    }
  }
}

// 主程序入口点检测
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export {
  buildWithStats,
  analyzeBundleFiles,
  performSizeGate,
  saveAnalysisReport,
  DEFAULT_CONFIG,
};

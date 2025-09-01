#!/usr/bin/env node
/**
 * Bundle Analysis Script
 * 增强Bundle分析和治理脚本
 * 集成rollup-plugin-visualizer生成的数据进行深度分析
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const ANALYSIS_CONFIG = {
  // bundle分析文件路径
  bundleAnalysisPath: './dist/bundle-analysis.html',

  // 重点关注的依赖
  watchDependencies: [
    'react',
    'react-dom',
    'antd',
    'phaser',
    '@ant-design/icons',
    '@sentry/browser',
    '@sentry/electron',
  ],

  // 大小阈值 (bytes)
  thresholds: {
    largeDependency: 100 * 1024, // 100KB
    hugeDependency: 500 * 1024, // 500KB
    massiveDependency: 1024 * 1024, // 1MB
  },

  // 输出配置
  output: {
    reportPath: './logs/bundle-analysis-report.json',
    summaryPath: './logs/bundle-summary.md',
  },
};

/**
 * 日志输出
 */
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(
    JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      component: 'bundle-analyzer',
      message,
      ...data,
    })
  );
}

/**
 * 格式化文件大小
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 分析dist目录中的文件
 */
function analyzeBundleFiles() {
  const distPath = './dist';

  if (!fs.existsSync(distPath)) {
    log('error', 'Dist directory not found', { path: distPath });
    return null;
  }

  const files = fs.readdirSync(distPath, { recursive: true });
  const analysis = {
    totalFiles: 0,
    totalSize: 0,
    assets: [],
    byType: {
      js: { count: 0, size: 0, files: [] },
      css: { count: 0, size: 0, files: [] },
      html: { count: 0, size: 0, files: [] },
      images: { count: 0, size: 0, files: [] },
      other: { count: 0, size: 0, files: [] },
    },
  };

  files.forEach(file => {
    const filePath = path.join(distPath, file);

    if (fs.statSync(filePath).isDirectory()) return;

    const stats = fs.statSync(filePath);
    const size = stats.size;
    const ext = path.extname(file).toLowerCase();

    analysis.totalFiles++;
    analysis.totalSize += size;

    const fileInfo = {
      path: file,
      size,
      sizeFormatted: formatBytes(size),
      ext,
    };

    analysis.assets.push(fileInfo);

    // 按类型分类
    let type = 'other';
    if (['.js', '.mjs', '.cjs'].includes(ext)) type = 'js';
    else if (['.css', '.scss', '.less'].includes(ext)) type = 'css';
    else if (['.html', '.htm'].includes(ext)) type = 'html';
    else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].includes(ext))
      type = 'images';

    analysis.byType[type].count++;
    analysis.byType[type].size += size;
    analysis.byType[type].files.push(fileInfo);
  });

  // 排序资产（按大小）
  analysis.assets.sort((a, b) => b.size - a.size);

  return analysis;
}

/**
 * 检查依赖大小
 */
async function checkDependencySizes() {
  const packageJsonPath = './package.json';

  if (!fs.existsSync(packageJsonPath)) {
    log('warn', 'package.json not found');
    return null;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const analysis = {
    total: Object.keys(dependencies).length,
    watched: [],
    large: [],
    huge: [],
    massive: [],
  };

  // 检查关注的依赖
  ANALYSIS_CONFIG.watchDependencies.forEach(dep => {
    if (dependencies[dep]) {
      analysis.watched.push({
        name: dep,
        version: dependencies[dep],
        type: packageJson.dependencies[dep] ? 'production' : 'development',
      });
    }
  });

  // 注意：实际依赖大小分析需要工具如 bundlephobia API
  // 这里提供框架，可以后续集成

  return analysis;
}

/**
 * 生成bundle建议
 */
function generateRecommendations(bundleAnalysis, dependencyAnalysis) {
  const recommendations = [];

  if (!bundleAnalysis) {
    recommendations.push({
      type: 'error',
      priority: 'high',
      message: '无法分析bundle文件，请先运行构建',
      action: 'npm run build',
    });
    return recommendations;
  }

  // 检查JS文件大小
  const jsFiles = bundleAnalysis.byType.js.files;
  const largeJsFiles = jsFiles.filter(
    f => f.size > ANALYSIS_CONFIG.thresholds.largeDependency
  );

  if (largeJsFiles.length > 0) {
    recommendations.push({
      type: 'warning',
      priority: 'medium',
      message: `发现${largeJsFiles.length}个大型JS文件`,
      details: largeJsFiles.map(f => `${f.path}: ${f.sizeFormatted}`),
      action: '考虑代码分割或懒加载',
    });
  }

  // 检查总bundle大小
  const totalMB = bundleAnalysis.totalSize / 1024 / 1024;
  if (totalMB > 5) {
    recommendations.push({
      type: 'warning',
      priority: 'high',
      message: `Bundle总大小过大: ${formatBytes(bundleAnalysis.totalSize)}`,
      action: '检查依赖和资源优化',
    });
  }

  // 检查CSS文件
  const cssFiles = bundleAnalysis.byType.css.files;
  if (cssFiles.length > 5) {
    recommendations.push({
      type: 'info',
      priority: 'low',
      message: `CSS文件数量较多: ${cssFiles.length}个`,
      action: '考虑CSS合并或优化',
    });
  }

  return recommendations;
}

/**
 * 生成分析报告
 */
function generateReport(bundleAnalysis, dependencyAnalysis, recommendations) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: bundleAnalysis?.totalFiles || 0,
      totalSize: bundleAnalysis?.totalSize || 0,
      totalSizeFormatted: bundleAnalysis
        ? formatBytes(bundleAnalysis.totalSize)
        : '0 Bytes',
      dependencies: dependencyAnalysis?.total || 0,
      recommendations: recommendations.length,
    },
    bundleAnalysis,
    dependencyAnalysis,
    recommendations,
    config: ANALYSIS_CONFIG,
  };

  return report;
}

/**
 * 生成Markdown摘要
 */
function generateMarkdownSummary(report) {
  const { summary, recommendations } = report;

  let markdown = `# Bundle Analysis Report
  
Generated: ${new Date().toLocaleString()}

## Summary

- **Total Files**: ${summary.totalFiles}
- **Total Size**: ${summary.totalSizeFormatted}
- **Dependencies**: ${summary.dependencies}
- **Recommendations**: ${summary.recommendations}

## File Type Breakdown
`;

  if (report.bundleAnalysis) {
    Object.entries(report.bundleAnalysis.byType).forEach(([type, data]) => {
      if (data.count > 0) {
        markdown += `
### ${type.toUpperCase()} Files
- Count: ${data.count}  
- Total Size: ${formatBytes(data.size)}
- Average Size: ${formatBytes(data.size / data.count)}
`;
      }
    });
  }

  if (recommendations.length > 0) {
    markdown += `
## Recommendations

`;
    recommendations.forEach((rec, index) => {
      markdown += `### ${index + 1}. ${rec.message}
- **Type**: ${rec.type}
- **Priority**: ${rec.priority}  
- **Action**: ${rec.action}
${rec.details ? `- **Details**: ${rec.details.join(', ')}` : ''}

`;
    });
  }

  return markdown;
}

/**
 * 主函数
 */
async function main() {
  const command = process.argv[2];

  try {
    console.log('🔍 Bundle Analysis Starting...');
    log('info', 'Bundle analysis started', { command });

    // 确保日志目录存在
    const logsDir = './logs';
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    switch (command) {
      case 'analyze':
      case undefined:
        log('info', 'Analyzing bundle files...');
        const bundleAnalysis = analyzeBundleFiles();

        log('info', 'Checking dependencies...');
        const dependencyAnalysis = await checkDependencySizes();

        log('info', 'Generating recommendations...');
        const recommendations = generateRecommendations(
          bundleAnalysis,
          dependencyAnalysis
        );

        log('info', 'Creating report...');
        const report = generateReport(
          bundleAnalysis,
          dependencyAnalysis,
          recommendations
        );

        // 保存JSON报告
        fs.writeFileSync(
          ANALYSIS_CONFIG.output.reportPath,
          JSON.stringify(report, null, 2)
        );

        // 保存Markdown摘要
        const markdownSummary = generateMarkdownSummary(report);
        fs.writeFileSync(ANALYSIS_CONFIG.output.summaryPath, markdownSummary);

        // 输出摘要
        console.log('\n📊 Bundle Analysis Summary');
        console.log('==========================');
        console.log(`Total Files: ${report.summary.totalFiles}`);
        console.log(`Total Size: ${report.summary.totalSizeFormatted}`);
        console.log(`Dependencies: ${report.summary.dependencies}`);
        console.log(`Recommendations: ${report.summary.recommendations}`);

        if (recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          recommendations.forEach((rec, index) => {
            console.log(
              `${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`
            );
            console.log(`   Action: ${rec.action}`);
          });
        }

        console.log(`\n📋 Full report: ${ANALYSIS_CONFIG.output.reportPath}`);
        console.log(`📄 Summary: ${ANALYSIS_CONFIG.output.summaryPath}`);

        break;

      case 'watch':
        log('info', 'Bundle analysis watch mode enabled');
        // 可以扩展为监控模式
        console.log('Bundle analyzer running in watch mode...');
        break;

      default:
        console.log(`
Bundle Analysis Tool

Usage: node scripts/bundle-analyzer.mjs [command]

Commands:
  analyze    分析当前bundle (默认)
  watch      监控模式 (待实现)
  
Examples:
  npm run analyze:bundle         # 构建并分析
  node scripts/bundle-analyzer.mjs analyze    # 仅分析现有bundle
`);
        break;
    }
  } catch (error) {
    log('error', 'Bundle analysis failed', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// 如果直接运行脚本
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export {
  analyzeBundleFiles,
  checkDependencySizes,
  generateRecommendations,
  generateReport,
  ANALYSIS_CONFIG,
};

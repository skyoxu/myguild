#!/usr/bin/env node

/**
 * Electron 安全基线扫描脚本
 * 检查 BrowserWindow/Preload/CSP 是否符合 CLAUDE.md 安全基线
 * 符合 ADR-0002 Electron 安全基线要求
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 安全基线配置
const SECURITY_BASELINE = {
  browserWindow: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
  },
  csp: {
    required: true,
    minDirectives: ['default-src', 'script-src', 'style-src'],
    unsafePatterns: ['unsafe-inline', 'unsafe-eval', '*'],
  },
  preload: {
    requireContextBridge: true,
    noNodeAccess: true,
  },
};

/**
 * 扫描主进程文件的安全配置
 */
function scanMainProcess() {
  console.log('🔍 扫描 Electron 主进程安全配置...');

  const mainFiles = [
    path.join(__dirname, '..', 'src', 'main'),
    path.join(__dirname, '..', 'electron', 'main'),
    path.join(__dirname, '..', 'src', 'main.ts'),
    path.join(__dirname, '..', 'electron', 'main.ts'),
  ];

  const issues = [];
  let foundMainFile = false;

  for (const mainPath of mainFiles) {
    if (fs.existsSync(mainPath)) {
      foundMainFile = true;
      const content = fs.statSync(mainPath).isDirectory()
        ? scanDirectory(mainPath, '**/*.{js,ts}')
        : fs.readFileSync(mainPath, 'utf8');

      const mainIssues = analyzeBrowserWindowConfig(content, mainPath);
      issues.push(...mainIssues);
    }
  }

  if (!foundMainFile) {
    issues.push({
      type: 'missing',
      severity: 'high',
      file: 'main process',
      message: '未找到 Electron 主进程文件',
    });
  }

  return issues;
}

/**
 * 扫描目录中的所有文件
 */
function scanDirectory(dirPath, pattern) {
  let content = '';

  function scanDir(currentPath) {
    const files = fs.readdirSync(currentPath);

    for (const file of files) {
      const fullPath = path.join(currentPath, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (file.match(/\.(js|ts)$/)) {
        content += fs.readFileSync(fullPath, 'utf8') + '\n';
      }
    }
  }

  scanDir(dirPath);
  return content;
}

/**
 * 分析 BrowserWindow 配置
 */
function analyzeBrowserWindowConfig(content, filePath) {
  const issues = [];

  // 检查 BrowserWindow 配置
  const browserWindowPattern = /new BrowserWindow\s*\(\s*{([^}]+)}/gs;
  const matches = content.matchAll(browserWindowPattern);

  let foundBrowserWindow = false;

  for (const match of matches) {
    foundBrowserWindow = true;
    const config = match[1];

    // 检查 nodeIntegration
    if (
      !config.includes('nodeIntegration') ||
      config.includes('nodeIntegration: true')
    ) {
      issues.push({
        type: 'security',
        severity: 'critical',
        file: filePath,
        message: 'nodeIntegration 必须设置为 false',
        recommendation: '设置 nodeIntegration: false',
      });
    }

    // 检查 contextIsolation
    if (
      !config.includes('contextIsolation') ||
      config.includes('contextIsolation: false')
    ) {
      issues.push({
        type: 'security',
        severity: 'critical',
        file: filePath,
        message: 'contextIsolation 必须设置为 true',
        recommendation: '设置 contextIsolation: true',
      });
    }

    // 检查 sandbox
    if (!config.includes('sandbox') || config.includes('sandbox: false')) {
      issues.push({
        type: 'security',
        severity: 'high',
        file: filePath,
        message: 'sandbox 必须设置为 true',
        recommendation: '设置 sandbox: true',
      });
    }

    // 检查 webSecurity
    if (config.includes('webSecurity: false')) {
      issues.push({
        type: 'security',
        severity: 'critical',
        file: filePath,
        message: 'webSecurity 不得设置为 false',
        recommendation: '移除 webSecurity: false 或设置为 true',
      });
    }

    // 检查 allowRunningInsecureContent
    if (config.includes('allowRunningInsecureContent: true')) {
      issues.push({
        type: 'security',
        severity: 'high',
        file: filePath,
        message: 'allowRunningInsecureContent 不得设置为 true',
        recommendation: '移除 allowRunningInsecureContent: true',
      });
    }
  }

  if (!foundBrowserWindow) {
    issues.push({
      type: 'missing',
      severity: 'medium',
      file: filePath,
      message: '未找到 BrowserWindow 配置',
    });
  }

  return issues;
}

/**
 * 扫描预加载脚本
 */
function scanPreloadScripts() {
  console.log('🔍 扫描预加载脚本安全配置...');

  const preloadPaths = [
    path.join(__dirname, '..', 'src', 'preload'),
    path.join(__dirname, '..', 'electron', 'preload'),
    path.join(__dirname, '..', 'src', 'preload.ts'),
    path.join(__dirname, '..', 'electron', 'preload.ts'),
  ];

  const issues = [];
  let foundPreload = false;

  for (const preloadPath of preloadPaths) {
    if (fs.existsSync(preloadPath)) {
      foundPreload = true;
      const content = fs.statSync(preloadPath).isDirectory()
        ? scanDirectory(preloadPath, '**/*.{js,ts}')
        : fs.readFileSync(preloadPath, 'utf8');

      const preloadIssues = analyzePreloadSecurity(content, preloadPath);
      issues.push(...preloadIssues);
    }
  }

  if (!foundPreload) {
    issues.push({
      type: 'missing',
      severity: 'medium',
      file: 'preload scripts',
      message: '未找到预加载脚本',
    });
  }

  return issues;
}

/**
 * 分析预加载脚本安全性
 */
function analyzePreloadSecurity(content, filePath) {
  const issues = [];

  // 检查是否使用 contextBridge
  if (!content.includes('contextBridge')) {
    issues.push({
      type: 'security',
      severity: 'high',
      file: filePath,
      message: '预加载脚本必须使用 contextBridge.exposeInMainWorld',
      recommendation: '使用 contextBridge.exposeInMainWorld 暴露白名单 API',
    });
  }

  // 检查是否直接访问 Node.js API
  const nodeApis = ['require', 'process', '__dirname', '__filename', 'global'];
  for (const api of nodeApis) {
    if (content.includes(api) && !content.includes(`// ${api} is safe`)) {
      issues.push({
        type: 'security',
        severity: 'medium',
        file: filePath,
        message: `预加载脚本中检测到 Node.js API 使用: ${api}`,
        recommendation:
          '避免在预加载脚本中直接使用 Node.js API，使用 contextBridge 白名单机制',
      });
    }
  }

  // 检查是否有 eval 或类似不安全代码
  const unsafePatterns = ['eval(', 'Function(', 'setTimeout(', 'setInterval('];
  for (const pattern of unsafePatterns) {
    if (content.includes(pattern)) {
      issues.push({
        type: 'security',
        severity: 'high',
        file: filePath,
        message: `检测到不安全的代码模式: ${pattern}`,
        recommendation:
          '避免使用 eval、Function 构造函数等不安全的代码执行方式',
      });
    }
  }

  return issues;
}

/**
 * 扫描 HTML 文件的 CSP 配置
 */
function scanCSPConfiguration() {
  console.log('🔍 扫描 CSP (Content Security Policy) 配置...');

  const htmlFiles = [
    path.join(__dirname, '..', 'index.html'),
    path.join(__dirname, '..', 'src', 'renderer', 'index.html'),
    path.join(__dirname, '..', 'electron', 'renderer', 'index.html'),
  ];

  const issues = [];
  let foundHTML = false;

  for (const htmlPath of htmlFiles) {
    if (fs.existsSync(htmlPath)) {
      foundHTML = true;
      const content = fs.readFileSync(htmlPath, 'utf8');
      const cspIssues = analyzeCSP(content, htmlPath);
      issues.push(...cspIssues);
    }
  }

  if (!foundHTML) {
    issues.push({
      type: 'missing',
      severity: 'medium',
      file: 'HTML files',
      message: '未找到 HTML 入口文件',
    });
  }

  return issues;
}

/**
 * 分析 CSP 配置
 */
function analyzeCSP(content, filePath) {
  const issues = [];

  // 检查是否有 CSP meta 标签
  const cspMetaPattern =
    /<meta[^>]*http-equiv=['"](Content-Security-Policy|content-security-policy)['"]/i;
  const cspMatch = content.match(cspMetaPattern);

  if (!cspMatch) {
    issues.push({
      type: 'security',
      severity: 'high',
      file: filePath,
      message: '缺少 Content-Security-Policy meta 标签',
      recommendation:
        "添加严格的 CSP meta 标签，例如：<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';\">",
    });
    return issues;
  }

  // 提取 CSP 内容
  const contentMatch = content.match(/content=['"](.*?)['"]/);
  if (!contentMatch) {
    issues.push({
      type: 'security',
      severity: 'high',
      file: filePath,
      message: 'CSP meta 标签缺少 content 属性',
    });
    return issues;
  }

  const cspContent = contentMatch[1];

  // 检查危险的 CSP 指令
  const unsafePatterns = [
    {
      pattern: 'unsafe-inline',
      severity: 'medium',
      message: '使用了 unsafe-inline，存在 XSS 风险',
    },
    {
      pattern: 'unsafe-eval',
      severity: 'high',
      message: '使用了 unsafe-eval，存在代码注入风险',
    },
    {
      pattern: /\*(?!\.[a-zA-Z])/,
      severity: 'medium',
      message: '使用了通配符 *，CSP 过于宽松',
    },
    {
      pattern: 'data:',
      severity: 'low',
      message: '允许 data: URL，可能存在安全风险',
    },
  ];

  for (const { pattern, severity, message } of unsafePatterns) {
    if (
      typeof pattern === 'string'
        ? cspContent.includes(pattern)
        : pattern.test(cspContent)
    ) {
      issues.push({
        type: 'security',
        severity,
        file: filePath,
        message: `CSP 配置不安全: ${message}`,
        recommendation:
          '使用更严格的 CSP 配置，避免 unsafe-inline 和 unsafe-eval',
      });
    }
  }

  // 检查必需的指令
  const requiredDirectives = ['default-src', 'script-src'];
  for (const directive of requiredDirectives) {
    if (!cspContent.includes(directive)) {
      issues.push({
        type: 'security',
        severity: 'medium',
        file: filePath,
        message: `CSP 缺少必需的指令: ${directive}`,
        recommendation: `添加 ${directive} 指令到 CSP 配置中`,
      });
    }
  }

  return issues;
}

/**
 * 生成安全扫描报告
 */
function generateSecurityReport(allIssues) {
  console.log('\n📊 生成安全扫描报告...');

  const reportDir = path.join(__dirname, '..', 'logs', 'security');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const reportFile = path.join(
    reportDir,
    `electron-security-scan-${timestamp}.json`
  );

  const report = {
    timestamp: new Date().toISOString(),
    baseline: SECURITY_BASELINE,
    summary: {
      total: allIssues.length,
      critical: allIssues.filter(i => i.severity === 'critical').length,
      high: allIssues.filter(i => i.severity === 'high').length,
      medium: allIssues.filter(i => i.severity === 'medium').length,
      low: allIssues.filter(i => i.severity === 'low').length,
    },
    issues: allIssues,
    recommendations: generateRecommendations(allIssues),
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📄 安全扫描报告已保存: ${reportFile}`);

  return report;
}

/**
 * 生成修复建议
 */
function generateRecommendations(issues) {
  const recommendations = [];

  if (issues.some(i => i.message.includes('nodeIntegration'))) {
    recommendations.push(
      '在所有 BrowserWindow 配置中设置 nodeIntegration: false'
    );
  }

  if (issues.some(i => i.message.includes('contextIsolation'))) {
    recommendations.push(
      '在所有 BrowserWindow 配置中设置 contextIsolation: true'
    );
  }

  if (issues.some(i => i.message.includes('sandbox'))) {
    recommendations.push('在所有 BrowserWindow 配置中设置 sandbox: true');
  }

  if (issues.some(i => i.message.includes('CSP'))) {
    recommendations.push(
      '在所有 HTML 文件中添加严格的 Content-Security-Policy meta 标签'
    );
  }

  if (issues.some(i => i.message.includes('contextBridge'))) {
    recommendations.push(
      '在预加载脚本中使用 contextBridge.exposeInMainWorld 暴露白名单 API'
    );
  }

  return recommendations;
}

/**
 * 主扫描函数
 */
function runElectronSecurityScan() {
  console.log('🛡️  开始 Electron 安全基线扫描...');
  console.log('📋 参考标准: ADR-0002 Electron 安全基线\n');

  const allIssues = [];

  try {
    // 扫描主进程
    const mainIssues = scanMainProcess();
    allIssues.push(...mainIssues);

    // 扫描预加载脚本
    const preloadIssues = scanPreloadScripts();
    allIssues.push(...preloadIssues);

    // 扫描 CSP 配置
    const cspIssues = scanCSPConfiguration();
    allIssues.push(...cspIssues);

    // 生成报告
    const report = generateSecurityReport(allIssues);

    // 显示结果
    console.log('\n📊 扫描结果汇总:');
    console.log(`  总问题数: ${report.summary.total}`);
    console.log(`  严重问题: ${report.summary.critical}`);
    console.log(`  高危问题: ${report.summary.high}`);
    console.log(`  中危问题: ${report.summary.medium}`);
    console.log(`  低危问题: ${report.summary.low}`);

    if (allIssues.length > 0) {
      console.log('\n❌ 发现安全问题:');

      // 按严重程度分组显示
      const criticalIssues = allIssues.filter(i => i.severity === 'critical');
      const highIssues = allIssues.filter(i => i.severity === 'high');

      if (criticalIssues.length > 0) {
        console.log('\n🚨 严重问题:');
        criticalIssues.forEach(issue => {
          console.log(`  - ${issue.file}: ${issue.message}`);
          if (issue.recommendation) {
            console.log(`    💡 建议: ${issue.recommendation}`);
          }
        });
      }

      if (highIssues.length > 0) {
        console.log('\n⚠️  高危问题:');
        highIssues.forEach(issue => {
          console.log(`  - ${issue.file}: ${issue.message}`);
          if (issue.recommendation) {
            console.log(`    💡 建议: ${issue.recommendation}`);
          }
        });
      }

      console.log('\n📄 详细报告已保存到 logs/security/ 目录');

      // 如果有严重或高危问题，退出码为 1
      if (criticalIssues.length > 0 || highIssues.length > 0) {
        console.log('\n❌ 安全扫描失败：存在严重或高危安全问题');
        process.exit(1);
      }
    } else {
      console.log('\n✅ 安全扫描通过！');
      console.log('🎉 所有配置均符合 Electron 安全基线要求');
    }
  } catch (error) {
    console.error('❌ 安全扫描执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 主执行逻辑
if (import.meta.url === `file://${process.argv[1]}`) {
  runElectronSecurityScan();
}

export {
  runElectronSecurityScan,
  scanMainProcess,
  scanPreloadScripts,
  scanCSPConfiguration,
  SECURITY_BASELINE,
};

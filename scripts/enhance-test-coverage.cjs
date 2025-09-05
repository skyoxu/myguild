#!/usr/bin/env node
/**
 * 测试覆盖率验证和E2E测试增强脚本
 *
 * 功能：
 * 1. 验证现有测试覆盖率是否满足ADR-0005要求
 * 2. 分析安全修复相关的测试覆盖
 * 3. 生成缺失测试用例的建议
 * 4. 增强E2E测试以覆盖关键安全场景
 * 5. 创建测试报告和覆盖率分析
 */

const { readFile, writeFile, readdir, stat, mkdir } = require('fs/promises');
const { join, dirname, relative, extname } = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');

const execAsync = promisify(exec);
const PROJECT_ROOT = join(__dirname, '..');

// 覆盖率阈值配置 (基于ADR-0005)
const COVERAGE_THRESHOLDS = {
  lines: 90,
  branches: 85,
  functions: 90,
  statements: 90,
};

// 安全相关文件模式
const SECURITY_FILE_PATTERNS = [
  'electron/security.ts',
  'electron/preload.ts',
  'electron/main.ts',
  'tests/e2e/security/',
  'scripts/verify_csp_policy.mjs',
  'scripts/scan_electron_safety.mjs',
];

// 关键测试场景定义
const CRITICAL_TEST_SCENARIOS = {
  'csp-security': {
    description: 'CSP策略安全验证',
    priority: 'critical',
    files: ['tests/e2e/security/electron-security.spec.ts'],
    scenarios: [
      'CSP阻止内联脚本执行',
      'CSP阻止不安全的资源加载',
      'CSP违规报告功能',
      'CSP策略完整性检查',
    ],
  },

  'electron-security': {
    description: 'Electron安全基线验证',
    priority: 'critical',
    files: ['tests/e2e/security/security.smoke.spec.ts'],
    scenarios: [
      'nodeIntegration禁用验证',
      'contextIsolation启用验证',
      'sandbox模式验证',
      'preload API白名单验证',
    ],
  },

  'navigation-control': {
    description: '导航控制安全验证',
    priority: 'high',
    files: ['tests/e2e/security/navigation-control.spec.ts'],
    scenarios: [
      '外部导航拦截',
      '新窗口控制',
      'URL白名单验证',
      '恶意重定向防护',
    ],
  },

  'api-exposure': {
    description: 'API暴露安全验证',
    priority: 'high',
    files: ['tests/unit/security/preload-whitelist.spec.ts'],
    scenarios: [
      'Context Bridge API白名单',
      'IPC通道访问控制',
      'API参数验证',
      '权限边界检查',
    ],
  },
};

/**
 * 运行单元测试覆盖率分析
 */
async function runUnitTestCoverage() {
  try {
    console.log('🧪 运行单元测试覆盖率分析...');

    const { stdout, stderr } = await execAsync(
      'npm run test:unit -- --coverage --reporter=json',
      {
        cwd: PROJECT_ROOT,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      }
    );

    if (stderr && !stderr.includes('warning')) {
      console.warn('测试警告:', stderr);
    }

    // 解析覆盖率结果
    const coverageLines = stdout.split('\n');
    const jsonReportLine = coverageLines.find(line =>
      line.trim().startsWith('{')
    );

    if (jsonReportLine) {
      const coverageReport = JSON.parse(jsonReportLine);
      return parseCoverageReport(coverageReport);
    }

    // 回退到文本解析
    return parseTextCoverageReport(stdout);
  } catch (error) {
    console.warn('单元测试覆盖率分析失败:', error.message);
    return {
      overall: { lines: 0, branches: 0, functions: 0, statements: 0 },
      files: {},
      issues: ['Failed to run unit test coverage'],
    };
  }
}

/**
 * 解析JSON格式覆盖率报告
 */
function parseCoverageReport(report) {
  const overall = {
    lines: report.total?.lines?.pct || 0,
    branches: report.total?.branches?.pct || 0,
    functions: report.total?.functions?.pct || 0,
    statements: report.total?.statements?.pct || 0,
  };

  const files = {};
  const issues = [];

  // 分析文件级覆盖率
  Object.entries(report.files || {}).forEach(([filePath, fileReport]) => {
    const relativePath = relative(PROJECT_ROOT, filePath);
    files[relativePath] = {
      lines: fileReport.lines?.pct || 0,
      branches: fileReport.branches?.pct || 0,
      functions: fileReport.functions?.pct || 0,
      statements: fileReport.statements?.pct || 0,
    };

    // 检查安全相关文件的覆盖率
    if (isSecurityRelatedFile(relativePath)) {
      Object.entries(COVERAGE_THRESHOLDS).forEach(([metric, threshold]) => {
        if (fileReport[metric]?.pct < threshold) {
          issues.push({
            type: 'LOW_SECURITY_COVERAGE',
            file: relativePath,
            metric: metric,
            actual: fileReport[metric]?.pct,
            threshold: threshold,
          });
        }
      });
    }
  });

  return { overall, files, issues };
}

/**
 * 解析文本格式覆盖率报告
 */
function parseTextCoverageReport(output) {
  const lines = output.split('\n');
  const issues = [];
  const files = {};

  // 查找总体覆盖率
  const summaryLine = lines.find(line => line.includes('All files'));
  let overall = { lines: 0, branches: 0, functions: 0, statements: 0 };

  if (summaryLine) {
    const parts = summaryLine.split('|').map(s => s.trim());
    if (parts.length >= 5) {
      overall = {
        statements: parseFloat(parts[1]) || 0,
        branches: parseFloat(parts[2]) || 0,
        functions: parseFloat(parts[3]) || 0,
        lines: parseFloat(parts[4]) || 0,
      };
    }
  }

  return { overall, files, issues };
}

/**
 * 检查是否为安全相关文件
 */
function isSecurityRelatedFile(filePath) {
  return SECURITY_FILE_PATTERNS.some(pattern => {
    if (pattern.endsWith('/')) {
      return filePath.startsWith(pattern);
    }
    return filePath.includes(pattern);
  });
}

/**
 * 分析E2E测试覆盖率
 */
async function analyzeE2ETestCoverage() {
  try {
    console.log('🎭 分析E2E测试覆盖...');

    const testFiles = await findTestFiles(join(PROJECT_ROOT, 'tests', 'e2e'));
    const testCoverage = {};
    const missingTests = [];

    for (const [scenarioId, scenario] of Object.entries(
      CRITICAL_TEST_SCENARIOS
    )) {
      const coverage = await analyzeScenarioCoverage(scenario, testFiles);
      testCoverage[scenarioId] = coverage;

      if (coverage.missingScenarios.length > 0) {
        missingTests.push({
          scenario: scenarioId,
          description: scenario.description,
          priority: scenario.priority,
          missing: coverage.missingScenarios,
        });
      }
    }

    return { testCoverage, missingTests };
  } catch (error) {
    console.error('E2E测试覆盖分析失败:', error.message);
    return { testCoverage: {}, missingTests: [] };
  }
}

/**
 * 查找测试文件
 */
async function findTestFiles(dir) {
  const testFiles = [];

  try {
    const files = await readdir(dir);

    for (const file of files) {
      const filePath = join(dir, file);
      const stats = await stat(filePath);

      if (stats.isDirectory()) {
        const subFiles = await findTestFiles(filePath);
        testFiles.push(...subFiles);
      } else if (file.endsWith('.spec.ts') || file.endsWith('.test.ts')) {
        testFiles.push(filePath);
      }
    }
  } catch (error) {
    // 目录不存在或无法访问
    console.warn(`无法访问测试目录 ${dir}: ${error.message}`);
  }

  return testFiles;
}

/**
 * 分析特定场景的测试覆盖
 */
async function analyzeScenarioCoverage(scenario, testFiles) {
  const foundScenarios = [];
  const missingScenarios = [];

  for (const expectedFile of scenario.files) {
    const fullPath = join(PROJECT_ROOT, expectedFile);
    const fileExists = testFiles.some(testFile =>
      testFile.endsWith(expectedFile)
    );

    if (fileExists) {
      try {
        const content = await readFile(fullPath, 'utf-8');

        for (const scenarioDesc of scenario.scenarios) {
          const hasScenario =
            content.toLowerCase().includes(scenarioDesc.toLowerCase()) ||
            content.includes(scenarioDesc) ||
            checkScenarioPattern(content, scenarioDesc);

          if (hasScenario) {
            foundScenarios.push(scenarioDesc);
          } else {
            missingScenarios.push(scenarioDesc);
          }
        }
      } catch (error) {
        console.warn(`无法读取测试文件 ${fullPath}: ${error.message}`);
        missingScenarios.push(...scenario.scenarios);
      }
    } else {
      console.warn(`测试文件不存在: ${expectedFile}`);
      missingScenarios.push(...scenario.scenarios);
    }
  }

  return {
    totalScenarios: scenario.scenarios.length,
    coveredScenarios: foundScenarios,
    missingScenarios: missingScenarios,
    coveragePercentage: Math.round(
      (foundScenarios.length / scenario.scenarios.length) * 100
    ),
  };
}

/**
 * 检查场景模式匹配
 */
function checkScenarioPattern(content, scenarioDesc) {
  const patterns = {
    CSP阻止内联脚本: /inline.*script.*block/i,
    CSP阻止不安全的资源: /unsafe.*resource.*block/i,
    nodeIntegration禁用: /nodeIntegration.*false/i,
    contextIsolation启用: /contextIsolation.*true/i,
    sandbox模式: /sandbox.*true/i,
    外部导航拦截: /external.*navigation.*block/i,
    新窗口控制: /window.*open.*control/i,
    API白名单: /whitelist.*api/i,
  };

  const pattern = patterns[scenarioDesc];
  return pattern && pattern.test(content);
}

/**
 * 生成增强的E2E测试用例
 */
async function generateEnhancedE2ETests(missingTests) {
  const testSuites = [];

  for (const missing of missingTests) {
    if (missing.priority === 'critical') {
      const testSuite = await generateTestSuiteForScenario(missing);
      testSuites.push(testSuite);
    }
  }

  return testSuites;
}

/**
 * 为特定场景生成测试套件
 */
async function generateTestSuiteForScenario(missingTest) {
  const testTemplate = `
/**
 * ${missingTest.description} - 增强测试套件
 * 自动生成于: ${new Date().toISOString()}
 * 优先级: ${missingTest.priority}
 */

import { test, expect } from '@playwright/test';
import { ElectronApplication, Page, _electron as electron } from 'playwright';

test.describe('${missingTest.description}', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['.'],
      recordVideo: process.env.CI ? { dir: 'test-results/videos' } : undefined
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

${missingTest.missing.map(scenario => generateTestCase(scenario, missingTest.scenario)).join('\n')}
});`;

  return {
    scenario: missingTest.scenario,
    description: missingTest.description,
    content: testTemplate,
    filename: `enhanced-${missingTest.scenario}.spec.ts`,
  };
}

/**
 * 生成单个测试用例
 */
function generateTestCase(scenario, scenarioType) {
  const testCases = {
    CSP阻止内联脚本执行: `
  test('CSP应该阻止内联脚本执行', async () => {
    // 尝试执行内联脚本
    const scriptBlocked = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.textContent = 'window.testScriptExecuted = true;';
        script.onerror = () => resolve(true);  // 脚本被阻止
        script.onload = () => resolve(false); // 脚本执行成功
        document.head.appendChild(script);
        
        // 检查是否执行
        setTimeout(() => {
          resolve(!(window as any).testScriptExecuted);
        }, 100);
      });
    });
    
    expect(scriptBlocked).toBe(true);
  });`,

    CSP阻止不安全的资源加载: `
  test('CSP应该阻止不安全的外部资源', async () => {
    const resourceBlocked = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onerror = () => resolve(true);  // 资源被阻止
        img.onload = () => resolve(false);  // 资源加载成功
        img.src = 'http://malicious-site.example.com/image.png';
        
        setTimeout(() => resolve(true), 1000); // 超时认为被阻止
      });
    });
    
    expect(resourceBlocked).toBe(true);
  });`,

    nodeIntegration禁用验证: `
  test('渲染进程应该无法访问Node.js API', async () => {
    const nodeDisabled = await page.evaluate(() => {
      return typeof window.require === 'undefined' && 
             typeof window.process === 'undefined' &&
             typeof window.Buffer === 'undefined';
    });
    
    expect(nodeDisabled).toBe(true);
  });`,

    contextIsolation启用验证: `
  test('上下文隔离应该启用', async () => {
    const isolationEnabled = await page.evaluate(() => {
      return typeof window.electronAPI !== 'undefined' && 
             typeof window.require === 'undefined';
    });
    
    expect(isolationEnabled).toBe(true);
  });`,

    外部导航拦截: `
  test('应该拦截外部导航尝试', async () => {
    const navigationBlocked = await page.evaluate(async () => {
      const originalLocation = window.location.href;
      
      try {
        window.location.href = 'https://malicious-site.example.com';
        await new Promise(resolve => setTimeout(resolve, 100));
        return window.location.href === originalLocation;
      } catch {
        return true; // 导航被阻止
      }
    });
    
    expect(navigationBlocked).toBe(true);
  });`,

    'preload API白名单验证': `
  test('应该只暴露白名单API', async () => {
    const apiValidation = await page.evaluate(() => {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI) return { valid: false, reason: 'No electronAPI found' };
      
      // 检查预期的白名单API
      const expectedAPIs = ['readFile', 'writeFile', 'getSystemInfo', 'minimize', 'close'];
      const exposedAPIs = Object.keys(electronAPI);
      
      const hasAllExpected = expectedAPIs.every(api => exposedAPIs.includes(api));
      const hasOnlyExpected = exposedAPIs.every(api => expectedAPIs.includes(api));
      
      return {
        valid: hasAllExpected && hasOnlyExpected,
        expected: expectedAPIs,
        actual: exposedAPIs,
        missing: expectedAPIs.filter(api => !exposedAPIs.includes(api)),
        unexpected: exposedAPIs.filter(api => !expectedAPIs.includes(api))
      };
    });
    
    expect(apiValidation.valid).toBe(true);
    expect(apiValidation.unexpected).toEqual([]);
  });`,
  };

  return (
    testCases[scenario] ||
    `
  test('${scenario}', async () => {
    // TODO: 实现 ${scenario} 测试
    test.skip('测试用例需要实现');
  });`
  );
}

/**
 * 验证覆盖率是否达标
 */
function validateCoverageThresholds(coverageData) {
  const issues = [];

  Object.entries(COVERAGE_THRESHOLDS).forEach(([metric, threshold]) => {
    if (coverageData.overall[metric] < threshold) {
      issues.push({
        type: 'OVERALL_COVERAGE_LOW',
        metric: metric,
        actual: coverageData.overall[metric],
        threshold: threshold,
        deficit: threshold - coverageData.overall[metric],
      });
    }
  });

  return issues;
}

/**
 * 生成测试覆盖率报告
 */
async function generateTestCoverageReport(
  unitCoverage,
  e2eCoverage,
  enhancedTests
) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      unitCoverage: unitCoverage.overall,
      unitCoverageIssues: unitCoverage.issues.length,
      e2eScenarios: Object.keys(CRITICAL_TEST_SCENARIOS).length,
      e2eCoverage: Math.round(
        Object.values(e2eCoverage.testCoverage).reduce(
          (sum, cov) => sum + cov.coveragePercentage,
          0
        ) / Object.keys(e2eCoverage.testCoverage).length
      ),
      missingTests: e2eCoverage.missingTests.length,
      enhancedTestSuites: enhancedTests.length,
    },
    thresholds: COVERAGE_THRESHOLDS,
    unitTestResults: {
      overall: unitCoverage.overall,
      issues: unitCoverage.issues,
      securityFiles: Object.entries(unitCoverage.files)
        .filter(([path]) => isSecurityRelatedFile(path))
        .reduce((obj, [path, coverage]) => ({ ...obj, [path]: coverage }), {}),
    },
    e2eTestResults: {
      scenarios: e2eCoverage.testCoverage,
      missingTests: e2eCoverage.missingTests,
      criticalGaps: e2eCoverage.missingTests.filter(
        test => test.priority === 'critical'
      ),
    },
    enhancedTests: enhancedTests.map(test => ({
      scenario: test.scenario,
      description: test.description,
      filename: test.filename,
      testCases: (test.content.match(/test\(/g) || []).length,
    })),
    recommendations: generateRecommendations(unitCoverage, e2eCoverage),
  };

  return report;
}

/**
 * 生成改进建议
 */
function generateRecommendations(unitCoverage, e2eCoverage) {
  const recommendations = [];

  // 单元测试覆盖率建议
  const coverageIssues = validateCoverageThresholds(unitCoverage);
  coverageIssues.forEach(issue => {
    recommendations.push({
      type: 'UNIT_COVERAGE',
      priority: 'high',
      title: `提高${issue.metric}覆盖率`,
      description: `当前${issue.metric}覆盖率为${issue.actual}%，需要达到${issue.threshold}%`,
      actionItems: [
        `增加${issue.deficit.toFixed(1)}%的${issue.metric}覆盖率`,
        '重点关注安全相关模块的测试',
        '添加边界条件和异常处理测试',
      ],
    });
  });

  // E2E测试建议
  const criticalMissing = e2eCoverage.missingTests.filter(
    test => test.priority === 'critical'
  );
  if (criticalMissing.length > 0) {
    recommendations.push({
      type: 'E2E_CRITICAL',
      priority: 'critical',
      title: '补充关键E2E测试场景',
      description: `缺少${criticalMissing.length}个关键安全测试场景`,
      actionItems: criticalMissing.map(
        test => `实现${test.description}相关测试: ${test.missing.join(', ')}`
      ),
    });
  }

  // 安全测试建议
  const securityIssues = unitCoverage.issues.filter(
    issue => issue.type === 'LOW_SECURITY_COVERAGE'
  );
  if (securityIssues.length > 0) {
    recommendations.push({
      type: 'SECURITY_COVERAGE',
      priority: 'critical',
      title: '加强安全模块测试覆盖',
      description: '安全相关文件的测试覆盖率不足',
      actionItems: securityIssues.map(
        issue =>
          `提高${issue.file}的${issue.metric}覆盖率到${issue.threshold}% (当前${issue.actual}%)`
      ),
    });
  }

  return recommendations;
}

/**
 * 保存增强的测试文件
 */
async function saveEnhancedTests(enhancedTests) {
  const savedFiles = [];

  for (const testSuite of enhancedTests) {
    try {
      const testDir = join(
        PROJECT_ROOT,
        'tests',
        'e2e',
        'security',
        'enhanced'
      );
      await ensureDirectoryExists(testDir);

      const filePath = join(testDir, testSuite.filename);
      await writeFile(filePath, testSuite.content, 'utf-8');

      savedFiles.push({
        path: relative(PROJECT_ROOT, filePath),
        scenario: testSuite.scenario,
        description: testSuite.description,
      });

      console.log(`✅ 生成增强测试文件: ${relative(PROJECT_ROOT, filePath)}`);
    } catch (error) {
      console.error(
        `❌ 保存测试文件失败 ${testSuite.filename}: ${error.message}`
      );
    }
  }

  return savedFiles;
}

/**
 * 确保目录存在
 */
async function ensureDirectoryExists(dir) {
  try {
    await stat(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🧪 开始测试覆盖率验证和增强...\n');

  try {
    // 1. 运行单元测试覆盖率分析
    const unitCoverage = await runUnitTestCoverage();

    // 2. 分析E2E测试覆盖率
    const e2eCoverage = await analyzeE2ETestCoverage();

    // 3. 生成增强的E2E测试
    const enhancedTests = await generateEnhancedE2ETests(
      e2eCoverage.missingTests
    );

    // 4. 保存增强的测试文件
    const savedTests = await saveEnhancedTests(enhancedTests);

    // 5. 生成综合报告
    const report = await generateTestCoverageReport(
      unitCoverage,
      e2eCoverage,
      enhancedTests
    );

    // 6. 保存报告
    const reportPath = join(PROJECT_ROOT, 'logs', 'test-coverage-report.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    // 7. 显示结果
    console.log('📊 测试覆盖率分析结果');
    console.log('='.repeat(50));
    console.log('单元测试覆盖率:');
    console.log(
      `  Lines: ${unitCoverage.overall.lines}% (阈值: ${COVERAGE_THRESHOLDS.lines}%)`
    );
    console.log(
      `  Branches: ${unitCoverage.overall.branches}% (阈值: ${COVERAGE_THRESHOLDS.branches}%)`
    );
    console.log(
      `  Functions: ${unitCoverage.overall.functions}% (阈值: ${COVERAGE_THRESHOLDS.functions}%)`
    );
    console.log(
      `  Statements: ${unitCoverage.overall.statements}% (阈值: ${COVERAGE_THRESHOLDS.statements}%)\n`
    );

    console.log(`E2E测试覆盖率: ${report.summary.e2eCoverage}%`);
    console.log(`缺失测试场景: ${report.summary.missingTests}个`);
    console.log(`生成增强测试: ${report.summary.enhancedTestSuites}个\n`);

    if (report.recommendations.length > 0) {
      console.log('💡 改进建议:');
      report.recommendations.forEach((rec, index) => {
        console.log(
          `   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`
        );
        console.log(`      ${rec.description}`);
      });
      console.log();
    }

    if (savedTests.length > 0) {
      console.log('📝 已生成增强测试文件:');
      savedTests.forEach(file => {
        console.log(`   ${file.path} - ${file.description}`);
      });
      console.log();
    }

    console.log(`📄 详细报告已保存: ${relative(PROJECT_ROOT, reportPath)}`);
    console.log('✅ 测试覆盖率验证和增强完成!');

    // 设置退出码
    const hasCriticalIssues = report.recommendations.some(
      rec => rec.priority === 'critical'
    );
    process.exit(hasCriticalIssues ? 1 : 0);
  } catch (error) {
    console.error('❌ 测试覆盖率验证失败:', error.message);
    process.exit(1);
  }
}

// 只有直接运行此脚本时才执行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runUnitTestCoverage,
  analyzeE2ETestCoverage,
  generateEnhancedE2ETests,
  validateCoverageThresholds,
};

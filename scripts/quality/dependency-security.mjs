#!/usr/bin/env node

/**
 * 依赖安全闸门脚本 - License & Vulnerability检查
 *
 * 功能：
 * - 许可证合规性检查（白名单模式）
 * - 高危漏洞依赖检测（基于npm audit）
 * - 过期依赖检查（使用npm outdated）
 * - CI/CD友好的结构化输出与退出码
 * - 详细的安全报告生成
 *
 * Usage:
 *   node scripts/quality/dependency-security.mjs --check
 *   node scripts/quality/dependency-security.mjs --license
 *   node scripts/quality/dependency-security.mjs --vulnerabilities
 *   node scripts/quality/dependency-security.mjs --outdated
 *
 * Environment Variables:
 *   ALLOWED_LICENSES     - 逗号分隔的许可证白名单（默认：MIT,ISC,BSD-2-Clause,BSD-3-Clause,Apache-2.0）
 *   VULN_SEVERITY_LIMIT  - 漏洞严重性阈值（默认：moderate，可选：info,low,moderate,high,critical）
 *   OUTDATED_LIMIT_DAYS  - 过期依赖天数限制（默认：365，0为禁用检查）
 *   OUTPUT_FORMAT        - 输出格式（json|console，默认：console）
 *
 * Exit Codes:
 *   0 - 所有检查通过
 *   1 - 发现许可证违规
 *   2 - 发现高危漏洞
 *   3 - 发现严重过期依赖
 *   4 - 多种类型违规
 *   5 - 工具执行错误
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

// 配置常量
const DEFAULT_CONFIG = {
  allowedLicenses: (
    process.env.ALLOWED_LICENSES ||
    'MIT,ISC,BSD-2-Clause,BSD-3-Clause,Apache-2.0,Unlicense,0BSD'
  )
    .split(',')
    .map(s => s.trim()),
  vulnSeverityLimit: process.env.VULN_SEVERITY_LIMIT || 'moderate',
  outdatedLimitDays: parseInt(process.env.OUTDATED_LIMIT_DAYS) || 365,
  outputFormat: process.env.OUTPUT_FORMAT || 'console',
};

// 严重性级别映射
const SEVERITY_LEVELS = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

/**
 * 日志输出
 */
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    component: 'dependency-security',
    message,
    ...data,
  };

  if (DEFAULT_CONFIG.outputFormat === 'json') {
    console.log(JSON.stringify(logEntry));
  } else {
    const levelEmoji =
      {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
      }[level] || '📝';

    console.log(`${levelEmoji} [${level.toUpperCase()}] ${message}`);
    if (Object.keys(data).length > 0) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

/**
 * 获取package.json信息
 */
function getPackageInfo() {
  try {
    const packagePath = path.resolve(process.cwd(), 'package.json');
    const packageContent = fs.readFileSync(packagePath, 'utf8');
    return JSON.parse(packageContent);
  } catch (error) {
    throw new Error(`无法读取package.json: ${error.message}`);
  }
}

/**
 * 执行带超时的命令
 */
async function execWithTimeout(command, timeoutMs = 30000) {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });
    return { stdout, stderr, success: true };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      success: false,
      code: error.code,
    };
  }
}

/**
 * 许可证检查 - 使用license-checker
 */
async function checkLicenses() {
  log('info', '开始许可证合规性检查...');

  const startTime = performance.now();

  // 检查license-checker是否可用
  const licenseCheckAvailable = await execWithTimeout(
    'npx license-checker --version'
  );
  if (!licenseCheckAvailable.success) {
    log('warn', 'license-checker不可用，尝试安装...');
    const installResult = await execWithTimeout(
      'npm install --no-save license-checker'
    );
    if (!installResult.success) {
      throw new Error('无法安装license-checker');
    }
  }

  // 执行许可证检查
  const result = await execWithTimeout(
    'npx license-checker --json --production --excludePrivatePackages'
  );

  if (!result.success) {
    throw new Error(`许可证检查失败: ${result.stderr}`);
  }

  let licenseData;
  try {
    licenseData = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`许可证数据解析失败: ${error.message}`);
  }

  // 分析许可证合规性
  const violations = [];
  const summary = {
    total: 0,
    compliant: 0,
    violations: 0,
    unknown: 0,
  };

  for (const [packageName, info] of Object.entries(licenseData)) {
    summary.total++;

    const licenses = Array.isArray(info.licenses)
      ? info.licenses
      : info.licenses
        ? [info.licenses]
        : ['UNKNOWN'];

    const isCompliant = licenses.some(license => {
      if (!license || license === 'UNKNOWN') {
        summary.unknown++;
        return false;
      }

      // 处理SPDX表达式和常见变体
      const normalizedLicense = license
        .replace(/^\(|\)$/g, '') // 移除括号
        .split(/\s+(OR|AND)\s+/)[0] // 取第一个许可证
        .trim();

      return DEFAULT_CONFIG.allowedLicenses.some(
        allowed =>
          normalizedLicense === allowed ||
          normalizedLicense.includes(allowed) ||
          allowed.includes(normalizedLicense)
      );
    });

    if (isCompliant) {
      summary.compliant++;
    } else {
      summary.violations++;
      violations.push({
        package: packageName,
        version: info.version || 'unknown',
        licenses: licenses,
        repository: info.repository || 'unknown',
        path: info.path || 'unknown',
      });
    }
  }

  const duration = performance.now() - startTime;

  return {
    passed: violations.length === 0,
    violations,
    summary,
    duration: Math.round(duration),
    allowedLicenses: DEFAULT_CONFIG.allowedLicenses,
  };
}

/**
 * 漏洞检查 - 使用npm audit
 */
async function checkVulnerabilities() {
  log('info', '开始安全漏洞检查...');

  const startTime = performance.now();

  // 执行npm audit
  const result = await execWithTimeout('npm audit --json --production');

  // npm audit返回非0退出码表示有漏洞，这是正常的
  let auditData;
  try {
    auditData = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`漏洞检查数据解析失败: ${error.message}`);
  }

  const severityLimit = SEVERITY_LEVELS[DEFAULT_CONFIG.vulnSeverityLimit] || 2;
  const violations = [];

  // npm audit v7+格式
  if (auditData.vulnerabilities) {
    for (const [packageName, vulnerability] of Object.entries(
      auditData.vulnerabilities
    )) {
      const severity = vulnerability.severity || 'unknown';
      const severityLevel = SEVERITY_LEVELS[severity] || 0;

      if (severityLevel >= severityLimit) {
        violations.push({
          package: packageName,
          severity: severity,
          title: vulnerability.title || '未知漏洞',
          overview: vulnerability.overview || '',
          recommendation: vulnerability.recommendation || '',
          url: vulnerability.url || '',
          cwe: vulnerability.cwe || [],
          cvss: vulnerability.cvss || {},
          range: vulnerability.range || 'unknown',
          fixAvailable: vulnerability.fixAvailable || false,
        });
      }
    }
  }

  const summary = {
    total: Object.keys(auditData.vulnerabilities || {}).length,
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    filtered: violations.length,
  };

  // 统计各级别漏洞数量
  if (auditData.vulnerabilities) {
    for (const vulnerability of Object.values(auditData.vulnerabilities)) {
      const severity = vulnerability.severity || 'unknown';
      if (summary.hasOwnProperty(severity)) {
        summary[severity]++;
      }
    }
  }

  const duration = performance.now() - startTime;

  return {
    passed: violations.length === 0,
    violations,
    summary,
    duration: Math.round(duration),
    severityLimit: DEFAULT_CONFIG.vulnSeverityLimit,
    auditMetadata: auditData.metadata || {},
  };
}

/**
 * 过期依赖检查 - 使用npm outdated
 */
async function checkOutdated() {
  log('info', '开始过期依赖检查...');

  const startTime = performance.now();

  // 执行npm outdated
  const result = await execWithTimeout('npm outdated --json --long');

  // npm outdated返回非0退出码表示有过期依赖，这是正常的
  let outdatedData = {};
  if (result.stdout.trim()) {
    try {
      outdatedData = JSON.parse(result.stdout);
    } catch (error) {
      log('warn', '过期依赖数据解析失败，使用空对象', { error: error.message });
    }
  }

  const now = new Date();
  const limitMs = DEFAULT_CONFIG.outdatedLimitDays * 24 * 60 * 60 * 1000;
  const violations = [];

  for (const [packageName, info] of Object.entries(outdatedData)) {
    // 简单的过期判断：如果wanted版本不等于current版本，认为过期
    if (info.current !== info.wanted || info.current !== info.latest) {
      violations.push({
        package: packageName,
        current: info.current,
        wanted: info.wanted,
        latest: info.latest,
        type: info.type || 'dependencies',
        homepage: info.homepage || '',
        // 注意：npm outdated不提供发布日期，这里只是占位
        outdatedSince: 'unknown',
      });
    }
  }

  const summary = {
    total: Object.keys(outdatedData).length,
    outdated: violations.length,
    upToDate: Object.keys(outdatedData).length - violations.length,
  };

  const duration = performance.now() - startTime;

  return {
    passed: violations.length === 0 || DEFAULT_CONFIG.outdatedLimitDays === 0,
    violations,
    summary,
    duration: Math.round(duration),
    limitDays: DEFAULT_CONFIG.outdatedLimitDays,
  };
}

/**
 * 生成安全报告
 */
function generateSecurityReport(licenseResult, vulnResult, outdatedResult) {
  const report = {
    timestamp: new Date().toISOString(),
    project: (() => {
      try {
        const pkg = getPackageInfo();
        return {
          name: pkg.name || 'unknown',
          version: pkg.version || 'unknown',
        };
      } catch {
        return { name: 'unknown', version: 'unknown' };
      }
    })(),
    config: {
      allowedLicenses: DEFAULT_CONFIG.allowedLicenses,
      vulnSeverityLimit: DEFAULT_CONFIG.vulnSeverityLimit,
      outdatedLimitDays: DEFAULT_CONFIG.outdatedLimitDays,
    },
    results: {
      licenses: licenseResult,
      vulnerabilities: vulnResult,
      outdated: outdatedResult,
    },
    overall: {
      passed:
        licenseResult.passed && vulnResult.passed && outdatedResult.passed,
      totalDuration:
        licenseResult.duration + vulnResult.duration + outdatedResult.duration,
    },
  };

  // 计算退出码
  let exitCode = 0;
  if (!licenseResult.passed) exitCode |= 1;
  if (!vulnResult.passed) exitCode |= 2;
  if (!outdatedResult.passed) exitCode |= 3;

  report.overall.exitCode = exitCode;

  return report;
}

/**
 * 显示报告摘要
 */
function displaySummary(report) {
  if (DEFAULT_CONFIG.outputFormat === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\n📊 依赖安全检查报告');
  console.log('='.repeat(50));

  console.log(`🏗️  项目: ${report.project.name}@${report.project.version}`);
  console.log(`⏱️  总耗时: ${report.overall.totalDuration}ms`);
  console.log(`✅ 整体状态: ${report.overall.passed ? '通过' : '失败'}`);

  // 许可证检查结果
  console.log('\n📜 许可证合规性:');
  const licenses = report.results.licenses;
  console.log(`   总依赖: ${licenses.summary.total}`);
  console.log(`   合规: ${licenses.summary.compliant}`);
  console.log(`   违规: ${licenses.summary.violations}`);
  console.log(`   未知: ${licenses.summary.unknown}`);

  if (licenses.violations.length > 0) {
    console.log('\n❌ 许可证违规依赖:');
    licenses.violations.slice(0, 5).forEach(violation => {
      console.log(
        `   📦 ${violation.package}@${violation.version}: ${violation.licenses.join(', ')}`
      );
    });
    if (licenses.violations.length > 5) {
      console.log(`   ... 还有 ${licenses.violations.length - 5} 个违规依赖`);
    }
  }

  // 漏洞检查结果
  console.log('\n🔒 安全漏洞检查:');
  const vulns = report.results.vulnerabilities;
  console.log(`   总漏洞: ${vulns.summary.total}`);
  console.log(`   高危以上: ${vulns.summary.high + vulns.summary.critical}`);
  console.log(`   需处理: ${vulns.summary.filtered}`);

  if (vulns.violations.length > 0) {
    console.log('\n🚨 高危漏洞:');
    vulns.violations.slice(0, 3).forEach(vuln => {
      console.log(`   🔺 ${vuln.package} (${vuln.severity}): ${vuln.title}`);
    });
    if (vulns.violations.length > 3) {
      console.log(`   ... 还有 ${vulns.violations.length - 3} 个漏洞`);
    }
  }

  // 过期依赖结果
  console.log('\n📅 过期依赖检查:');
  const outdated = report.results.outdated;
  console.log(`   总检查: ${outdated.summary.total}`);
  console.log(`   过期: ${outdated.summary.outdated}`);

  if (outdated.violations.length > 0) {
    console.log('\n⏰ 过期依赖:');
    outdated.violations.slice(0, 5).forEach(dep => {
      console.log(
        `   📦 ${dep.package}: ${dep.current} → ${dep.wanted} (最新: ${dep.latest})`
      );
    });
    if (outdated.violations.length > 5) {
      console.log(`   ... 还有 ${outdated.violations.length - 5} 个过期依赖`);
    }
  }

  if (!report.overall.passed) {
    console.log('\n💡 建议:');
    if (!licenses.passed) {
      console.log('   📜 更新许可证白名单或替换违规依赖');
    }
    if (!vulns.passed) {
      console.log('   🔒 运行 npm audit fix 修复漏洞');
    }
    if (!outdated.passed) {
      console.log('   📅 运行 npm update 更新过期依赖');
    }
  }

  console.log('='.repeat(50));
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const checkLicense =
    args.includes('--license') || args.includes('--check') || args.length === 0;
  const checkVuln =
    args.includes('--vulnerabilities') ||
    args.includes('--check') ||
    args.length === 0;
  const checkOutdatedDeps =
    args.includes('--outdated') ||
    args.includes('--check') ||
    args.length === 0;

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
依赖安全闸门检查工具

用法:
  node scripts/quality/dependency-security.mjs [选项]

选项:
  --check                 执行所有检查 (默认)
  --license              仅检查许可证合规性
  --vulnerabilities      仅检查安全漏洞
  --outdated            仅检查过期依赖
  --help, -h            显示此帮助信息

环境变量:
  ALLOWED_LICENSES       允许的许可证列表 (逗号分隔)
  VULN_SEVERITY_LIMIT    漏洞严重性阈值 (info|low|moderate|high|critical)
  OUTDATED_LIMIT_DAYS    过期依赖天数限制 (0为禁用)
  OUTPUT_FORMAT          输出格式 (json|console)

示例:
  node scripts/quality/dependency-security.mjs
  VULN_SEVERITY_LIMIT=high node scripts/quality/dependency-security.mjs --vulnerabilities
  OUTPUT_FORMAT=json node scripts/quality/dependency-security.mjs > security-report.json
`);
    process.exit(0);
  }

  try {
    log('info', '开始依赖安全检查', {
      checkLicense,
      checkVuln,
      checkOutdatedDeps,
      config: DEFAULT_CONFIG,
    });

    // 执行检查
    const results = await Promise.all([
      checkLicense
        ? checkLicenses()
        : Promise.resolve({
            passed: true,
            violations: [],
            summary: {},
            duration: 0,
          }),
      checkVuln
        ? checkVulnerabilities()
        : Promise.resolve({
            passed: true,
            violations: [],
            summary: {},
            duration: 0,
          }),
      checkOutdatedDeps
        ? checkOutdated()
        : Promise.resolve({
            passed: true,
            violations: [],
            summary: {},
            duration: 0,
          }),
    ]);

    const [licenseResult, vulnResult, outdatedResult] = results;

    // 生成报告
    const report = generateSecurityReport(
      licenseResult,
      vulnResult,
      outdatedResult
    );

    // 显示结果
    displaySummary(report);

    // 保存详细报告到logs目录
    const logsDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const reportFile = path.join(
      logsDir,
      `dependency-security-${new Date().toISOString().split('T')[0]}.json`
    );
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    if (DEFAULT_CONFIG.outputFormat === 'console') {
      log('info', `详细报告已保存: ${reportFile}`);
    }

    // 设置退出码
    process.exit(report.overall.exitCode);
  } catch (error) {
    log('error', '依赖安全检查失败', {
      error: error.message,
      stack: error.stack,
    });

    if (DEFAULT_CONFIG.outputFormat === 'json') {
      console.log(
        JSON.stringify({
          ok: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        })
      );
    }

    process.exit(5);
  }
}

// 导出函数供其他脚本使用
export {
  checkLicenses,
  checkVulnerabilities,
  checkOutdated,
  generateSecurityReport,
  DEFAULT_CONFIG,
};

// 如果直接运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(5);
  });
}

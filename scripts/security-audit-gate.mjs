#!/usr/bin/env node
/**
 * 安全审计门禁脚本
 * 集成npm audit到CI流程，自动阻断高危依赖漏洞
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { loadQualityGatesConfig } from './utils/config-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从配置中心加载安全配置
const environment = process.env.NODE_ENV || 'default';
const config = loadQualityGatesConfig(environment);
const securityConfig = config.security?.audit || {
  level: 'high',
  allowedVulnerabilities: [],
};

/**
 * 安全审计结果处理器
 */
class SecurityAuditProcessor {
  constructor(config) {
    this.config = config;
    this.allowedVulns = new Set(config.allowedVulnerabilities || []);
  }

  /**
   * 运行npm audit并解析结果
   */
  async runAudit() {
    return new Promise((resolve, reject) => {
      const auditLevel = this.config.level || 'high';
      const child = spawn(
        'npm',
        ['audit', '--json', `--audit-level=${auditLevel}`],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true, // Windows兼容性修复
        }
      );

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        try {
          // npm audit返回非零退出码时仍可能有有效的JSON输出
          const auditData = JSON.parse(stdout);
          resolve({
            success: code === 0,
            exitCode: code,
            data: auditData,
            stderr,
          });
        } catch (error) {
          // 如果JSON解析失败，返回原始输出
          resolve({
            success: code === 0,
            exitCode: code,
            rawOutput: stdout,
            stderr,
            parseError: error.message,
          });
        }
      });

      child.on('error', reject);
    });
  }

  /**
   * 分析漏洞数据
   */
  analyzeVulnerabilities(auditData) {
    if (!auditData.vulnerabilities) {
      return {
        total: 0,
        byLevel: {},
        blockers: [],
        allowed: [],
        summary: 'No vulnerabilities found',
      };
    }

    const vulnerabilities = auditData.vulnerabilities;
    const byLevel = { critical: 0, high: 0, moderate: 0, low: 0, info: 0 };
    const blockers = [];
    const allowed = [];

    Object.entries(vulnerabilities).forEach(([name, vuln]) => {
      const level = vuln.severity;
      byLevel[level] = (byLevel[level] || 0) + 1;

      const vulnInfo = {
        name,
        severity: level,
        title: vuln.title,
        url: vuln.url,
        via: vuln.via,
        effects: vuln.effects,
        range: vuln.range,
      };

      // 检查是否在允许列表中
      const isAllowed = this.isVulnerabilityAllowed(name, vulnInfo);

      if (isAllowed) {
        allowed.push(vulnInfo);
      } else {
        // 根据配置的级别决定是否阻断
        if (this.shouldBlockVulnerability(level)) {
          blockers.push(vulnInfo);
        }
      }
    });

    return {
      total: Object.keys(vulnerabilities).length,
      byLevel,
      blockers,
      allowed,
      summary: this.generateSummary(byLevel, blockers.length, allowed.length),
    };
  }

  /**
   * 检查漏洞是否在允许列表中
   */
  isVulnerabilityAllowed(name, vulnInfo) {
    // 支持多种匹配方式
    return (
      this.allowedVulns.has(name) ||
      this.allowedVulns.has(`${name}@${vulnInfo.range}`) ||
      this.allowedVulns.has(vulnInfo.title)
    );
  }

  /**
   * 根据配置级别判断是否应该阻断
   */
  shouldBlockVulnerability(severity) {
    const levelPriority = {
      info: 0,
      low: 1,
      moderate: 2,
      high: 3,
      critical: 4,
    };

    const configLevel = this.config.level || 'high';
    const minBlockLevel = levelPriority[configLevel];
    const vulnLevel = levelPriority[severity];

    return vulnLevel >= minBlockLevel;
  }

  /**
   * 生成安全摘要
   */
  generateSummary(byLevel, blockers, allowed) {
    const total = Object.values(byLevel).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      return '✅ No security vulnerabilities found';
    }

    const parts = [];

    ['critical', 'high', 'moderate', 'low'].forEach(level => {
      if (byLevel[level] > 0) {
        const icon =
          level === 'critical'
            ? '🔴'
            : level === 'high'
              ? '🟠'
              : level === 'moderate'
                ? '🟡'
                : '🔵';
        parts.push(`${icon} ${byLevel[level]} ${level}`);
      }
    });

    let summary = `Found ${total} vulnerabilities: ${parts.join(', ')}`;

    if (blockers > 0) {
      summary += ` | 🚫 ${blockers} blocking`;
    }

    if (allowed > 0) {
      summary += ` | ✓ ${allowed} allowed`;
    }

    return summary;
  }
}

/**
 * 安全审计报告生成器
 */
class SecurityReportGenerator {
  static generateConsoleReport(analysis) {
    console.log('\n🔒 Security Audit Report');
    console.log('=======================');

    if (analysis.total === 0) {
      console.log('✅ No vulnerabilities found');
      return;
    }

    console.log(`\n📊 Summary: ${analysis.summary}`);

    if (analysis.blockers.length > 0) {
      console.log('\n🚫 Blocking Vulnerabilities:');
      analysis.blockers.forEach(vuln => {
        const icon = vuln.severity === 'critical' ? '🔴' : '🟠';
        console.log(`  ${icon} ${vuln.name} (${vuln.severity})`);
        console.log(`     ${vuln.title}`);
        if (vuln.url) {
          console.log(`     More info: ${vuln.url}`);
        }
      });
    }

    if (analysis.allowed.length > 0) {
      console.log('\n✓ Allowed Vulnerabilities (exceptions):');
      analysis.allowed.forEach(vuln => {
        console.log(`  ✓ ${vuln.name} (${vuln.severity}) - ${vuln.title}`);
      });
    }

    const levelCounts = Object.entries(analysis.byLevel)
      .filter(([_, count]) => count > 0)
      .map(([level, count]) => `${level}: ${count}`)
      .join(', ');

    console.log(`\n📈 Breakdown: ${levelCounts}`);
  }

  static generateJsonReport(analysis, auditResult) {
    return {
      timestamp: new Date().toISOString(),
      config: {
        level: auditResult.processor?.config?.level || 'high',
        allowedVulnerabilities:
          auditResult.processor?.config?.allowedVulnerabilities || [],
      },
      audit: {
        exitCode: auditResult.exitCode,
        success: auditResult.success,
      },
      vulnerabilities: {
        total: analysis.total,
        byLevel: analysis.byLevel,
        blocking: analysis.blockers.length,
        allowed: analysis.allowed.length,
        summary: analysis.summary,
      },
      blockers: analysis.blockers,
      allowed: analysis.allowed,
      shouldFail: analysis.blockers.length > 0,
    };
  }
}

/**
 * 主要的安全审计门禁处理器
 */
class SecurityAuditGate {
  constructor() {
    this.processor = new SecurityAuditProcessor(securityConfig);
  }

  /**
   * 运行完整的安全审计门禁
   */
  async runGate() {
    console.log('🔒 Running security audit gate...');
    console.log(`Configuration: audit-level=${this.processor.config.level}`);

    if (this.processor.allowedVulns.size > 0) {
      console.log(
        `Allowed vulnerabilities: ${Array.from(this.processor.allowedVulns).join(', ')}`
      );
    }

    try {
      // 运行npm audit
      const auditResult = await this.processor.runAudit();

      if (auditResult.parseError) {
        console.error(
          '❌ Failed to parse audit results:',
          auditResult.parseError
        );
        console.log('Raw output:', auditResult.rawOutput);
        return { success: false, reason: 'parse_error' };
      }

      // 分析漏洞
      const analysis = this.processor.analyzeVulnerabilities(auditResult.data);

      // 生成报告
      SecurityReportGenerator.generateConsoleReport(analysis);

      // 保存JSON报告
      const jsonReport = SecurityReportGenerator.generateJsonReport(analysis, {
        ...auditResult,
        processor: this.processor,
      });

      // 创建日志目录
      const logsDir = path.resolve('logs/security');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // 保存报告
      const reportFile = path.join(
        logsDir,
        `audit-${new Date().toISOString().split('T')[0]}.json`
      );
      fs.writeFileSync(reportFile, JSON.stringify(jsonReport, null, 2));
      console.log(`\n📄 Report saved: ${reportFile}`);

      // 门禁决策
      if (analysis.blockers.length > 0) {
        console.log('\n❌ Security audit gate FAILED');
        console.log(
          `${analysis.blockers.length} blocking vulnerabilities found`
        );
        console.log(
          'Please fix the security issues or add exceptions to config if acceptable'
        );
        return {
          success: false,
          reason: 'blocking_vulnerabilities',
          blockers: analysis.blockers,
        };
      } else {
        console.log('\n✅ Security audit gate PASSED');
        return { success: true, analysis, report: jsonReport };
      }
    } catch (error) {
      console.error('❌ Security audit failed:', error.message);
      return { success: false, reason: 'audit_error', error: error.message };
    }
  }

  /**
   * 修复可修复的漏洞
   */
  async runFix() {
    console.log('🔧 Attempting to fix vulnerabilities...');

    return new Promise((resolve, reject) => {
      const child = spawn('npm', ['audit', 'fix'], {
        stdio: 'inherit',
        shell: true, // Windows兼容性修复
      });

      child.on('close', code => {
        if (code === 0) {
          console.log('✅ Vulnerabilities fixed successfully');
          resolve(true);
        } else {
          console.log(
            '⚠️ Some vulnerabilities could not be automatically fixed'
          );
          resolve(false);
        }
      });

      child.on('error', reject);
    });
  }
}

/**
 * 命令行接口
 */
async function main() {
  const command = process.argv[2];
  const gate = new SecurityAuditGate();

  try {
    switch (command) {
      case 'gate':
        const result = await gate.runGate();
        process.exit(result.success ? 0 : 1);
        break;

      case 'fix':
        await gate.runFix();
        // 修复后重新运行门禁
        const rerunResult = await gate.runGate();
        process.exit(rerunResult.success ? 0 : 1);
        break;

      case 'report':
        const reportResult = await gate.runGate();
        console.log('\n📊 JSON Report:');
        console.log(JSON.stringify(reportResult.report || {}, null, 2));
        break;

      default:
        console.log(`
Usage: node scripts/security-audit-gate.mjs <command>

Commands:
  gate     - Run security audit gate (default) - exits 1 if blocking vulnerabilities found
  fix      - Attempt to fix vulnerabilities, then run gate
  report   - Generate detailed JSON report

Configuration:
  Set via config/quality-gates.json under security.audit:
  - level: minimum severity level to block (info|low|moderate|high|critical)
  - allowedVulnerabilities: array of vulnerability names/titles to allow

Environment Variables:
  NODE_ENV - environment for configuration loading (default: 'default')

Examples:
  npm run security:audit:gate
  node scripts/security-audit-gate.mjs fix
  node scripts/security-audit-gate.mjs report
`);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// 如果直接运行脚本
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith('security-audit-gate.mjs')
) {
  main();
}

export { SecurityAuditGate, SecurityAuditProcessor, SecurityReportGenerator };

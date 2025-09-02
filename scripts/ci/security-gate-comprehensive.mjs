#!/usr/bin/env node
/**
 * 综合安全门禁脚本 - CI/CD集成
 *
 * 功能:
 * 1. E2E测试安全验证
 * 2. CloudEvents契约安全检查
 * 3. Electron安全基线验证
 * 4. 依赖安全扫描
 * 5. CSP策略验证
 *
 * 使用: node scripts/ci/security-gate-comprehensive.mjs [--fix]
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '../..');

// 安全门禁配置
const SECURITY_CONFIG = {
  // CSP策略要求
  CSP_REQUIRED_DIRECTIVES: [
    'default-src',
    'script-src',
    'style-src',
    'object-src',
    'frame-ancestors',
    'base-uri',
  ],

  // 禁止的危险CSP值
  CSP_FORBIDDEN_VALUES: ["'unsafe-inline'", "'unsafe-eval'", 'data:', '*'],

  // Electron安全要求
  ELECTRON_SECURITY_REQUIREMENTS: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
  },

  // 最大允许的安全漏洞数量
  MAX_VULNERABILITIES: {
    critical: 0,
    high: 0,
    moderate: 2,
    low: 10,
  },
};

class SecurityGate {
  constructor(options = {}) {
    this.fixMode = options.fix || false;
    this.verbose = options.verbose || process.env.CI === 'true';
    this.results = [];
    this.exitCode = 0;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix =
      {
        info: '✅',
        warn: '⚠️',
        error: '❌',
        security: '🔒',
      }[level] || 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);

    if (level === 'error') {
      this.exitCode = 1;
    }
  }

  async runCommand(command, options = {}) {
    try {
      const result = execSync(command, {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: this.verbose ? 'inherit' : 'pipe',
        ...options,
      });
      return { success: true, output: result };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: error.stdout || error.stderr,
      };
    }
  }

  // 1. E2E安全测试验证
  async validateE2ESecurityTests() {
    this.log('开始E2E安全测试验证...', 'security');

    try {
      // 运行安全专项测试
      const result = await this.runCommand('npm run test:e2e:security');

      if (!result.success) {
        this.log('E2E安全测试失败', 'error');
        this.log(result.output, 'error');
        return false;
      }

      // 检查测试结果中的安全验证项
      const testOutput = result.output || '';
      const securityChecks = [
        'Node.js 全局变量隔离',
        'CSP 策略验证',
        '预加载脚本：白名单 API 验证',
        '窗口属性：安全配置验证',
      ];

      let passedChecks = 0;
      securityChecks.forEach(check => {
        if (testOutput.includes(check)) {
          passedChecks++;
        }
      });

      if (passedChecks < securityChecks.length) {
        this.log(
          `E2E安全检查不完整: ${passedChecks}/${securityChecks.length}`,
          'error'
        );
        return false;
      }

      this.log('E2E安全测试验证通过', 'info');
      return true;
    } catch (error) {
      this.log(`E2E安全测试异常: ${error.message}`, 'error');
      return false;
    }
  }

  // 2. CloudEvents契约安全验证
  async validateCloudEventsContracts() {
    this.log('开始CloudEvents契约安全验证...', 'security');

    try {
      // 运行CloudEvents单元测试
      const result = await this.runCommand(
        'npm run test:unit -- tests/unit/contracts/cloudevents.spec.ts'
      );

      if (!result.success) {
        this.log('CloudEvents契约测试失败', 'error');
        return false;
      }

      // 检查源代码安全实现
      const cloudEventsFile = join(
        ROOT_DIR,
        'src/shared/contracts/cloudevents-core.ts'
      );
      if (!existsSync(cloudEventsFile)) {
        this.log('CloudEvents核心文件不存在', 'error');
        return false;
      }

      const content = readFileSync(cloudEventsFile, 'utf8');

      // 验证关键安全检查存在
      const securityChecks = [
        'isValidUri', // URI验证函数
        'assertCe', // 输入验证函数
        'JSON.stringify', // 序列化
        'JSON.parse', // 反序列化
      ];

      const missingChecks = securityChecks.filter(
        check => !content.includes(check)
      );
      if (missingChecks.length > 0) {
        this.log(
          `CloudEvents缺少安全检查: ${missingChecks.join(', ')}`,
          'error'
        );
        return false;
      }

      // 检查危险模式
      const dangerousPatterns = [
        'eval(',
        'Function(',
        'setTimeout(',
        'setInterval(',
      ];

      const foundDangerous = dangerousPatterns.filter(pattern =>
        content.includes(pattern)
      );
      if (foundDangerous.length > 0) {
        this.log(
          `CloudEvents包含危险模式: ${foundDangerous.join(', ')}`,
          'error'
        );
        return false;
      }

      this.log('CloudEvents契约安全验证通过', 'info');
      return true;
    } catch (error) {
      this.log(`CloudEvents验证异常: ${error.message}`, 'error');
      return false;
    }
  }

  // 3. Electron安全基线验证
  async validateElectronSecurity() {
    this.log('开始Electron安全基线验证...', 'security');

    try {
      // 检查main.ts安全配置
      const mainFile = join(ROOT_DIR, 'electron/main.ts');
      if (!existsSync(mainFile)) {
        this.log('Electron主文件不存在', 'error');
        return false;
      }

      const mainContent = readFileSync(mainFile, 'utf8');

      // 验证安全三开关
      const securitySettings = SECURITY_CONFIG.ELECTRON_SECURITY_REQUIREMENTS;
      for (const [setting, expectedValue] of Object.entries(securitySettings)) {
        const pattern = new RegExp(`${setting}\\s*:\\s*${expectedValue}`, 'g');
        if (!pattern.test(mainContent)) {
          this.log(
            `Electron安全设置错误: ${setting} 应为 ${expectedValue}`,
            'error'
          );
          return false;
        }
      }

      // 检查危险配置
      const dangerousConfigs = [
        'nodeIntegration: true',
        'contextIsolation: false',
        'sandbox: false',
        'webSecurity: false',
      ];

      const foundDangerous = dangerousConfigs.filter(config =>
        mainContent.includes(config)
      );
      if (foundDangerous.length > 0) {
        this.log(`发现危险Electron配置: ${foundDangerous.join(', ')}`, 'error');
        return false;
      }

      // 验证preload.ts安全实现
      const preloadFile = join(ROOT_DIR, 'electron/preload.ts');
      if (existsSync(preloadFile)) {
        const preloadContent = readFileSync(preloadFile, 'utf8');

        // 确保使用contextBridge
        if (!preloadContent.includes('contextBridge.exposeInMainWorld')) {
          this.log('预加载脚本未使用contextBridge', 'error');
          return false;
        }

        // 确保检查process.contextIsolated
        if (!preloadContent.includes('process.contextIsolated')) {
          this.log('预加载脚本未验证context isolation', 'warn');
        }
      }

      this.log('Electron安全基线验证通过', 'info');
      return true;
    } catch (error) {
      this.log(`Electron安全验证异常: ${error.message}`, 'error');
      return false;
    }
  }

  // 4. CSP策略一致性验证
  async validateCSPConsistency() {
    this.log('开始CSP策略一致性验证...', 'security');

    try {
      // 检查index.html中的CSP
      const indexFile = join(ROOT_DIR, 'index.html');
      if (!existsSync(indexFile)) {
        this.log('index.html文件不存在', 'error');
        return false;
      }

      const indexContent = readFileSync(indexFile, 'utf8');
      const cspMatch = indexContent.match(/content="([^"]+)"/);

      if (!cspMatch) {
        this.log('index.html中未找到CSP策略', 'error');
        return false;
      }

      const cspPolicy = cspMatch[1];

      // 验证必需的CSP指令
      const missingDirectives = SECURITY_CONFIG.CSP_REQUIRED_DIRECTIVES.filter(
        directive => !cspPolicy.includes(directive)
      );

      if (missingDirectives.length > 0) {
        this.log(`CSP缺少必需指令: ${missingDirectives.join(', ')}`, 'error');
        return false;
      }

      // 检查危险的CSP值
      const foundForbidden = SECURITY_CONFIG.CSP_FORBIDDEN_VALUES.filter(
        value => cspPolicy.includes(value)
      );

      if (foundForbidden.length > 0) {
        this.log(`CSP包含危险值: ${foundForbidden.join(', ')}`, 'error');
        return false;
      }

      // 检查main.ts中的CSP是否与index.html基本一致
      const mainFile = join(ROOT_DIR, 'electron/main.ts');
      if (existsSync(mainFile)) {
        const mainContent = readFileSync(mainFile, 'utf8');
        const mainCSPMatch = mainContent.match(/"default-src[^"]+"/);

        if (mainCSPMatch && !this.comparePolicies(cspPolicy, mainCSPMatch[0])) {
          this.log('main.ts与index.html的CSP策略不一致', 'warn');
        }
      }

      this.log('CSP策略验证通过', 'info');
      return true;
    } catch (error) {
      this.log(`CSP验证异常: ${error.message}`, 'error');
      return false;
    }
  }

  // 5. 依赖安全扫描
  async runDependencySecurityScan() {
    this.log('开始依赖安全扫描...', 'security');

    try {
      // npm audit检查
      const auditResult = await this.runCommand('npm audit --json', {
        stdio: 'pipe',
      });

      if (auditResult.output) {
        const auditData = JSON.parse(auditResult.output);
        const vulnerabilities = auditData.vulnerabilities || {};

        const counts = {
          critical: 0,
          high: 0,
          moderate: 0,
          low: 0,
        };

        Object.values(vulnerabilities).forEach(vuln => {
          if (vuln.severity && counts.hasOwnProperty(vuln.severity)) {
            counts[vuln.severity]++;
          }
        });

        // 检查是否超过阈值
        let hasExcessiveVulns = false;
        for (const [severity, count] of Object.entries(counts)) {
          const maxAllowed = SECURITY_CONFIG.MAX_VULNERABILITIES[severity];
          if (count > maxAllowed) {
            this.log(
              `${severity.toUpperCase()}级别漏洞超标: ${count}/${maxAllowed}`,
              'error'
            );
            hasExcessiveVulns = true;
          }
        }

        if (hasExcessiveVulns) {
          if (this.fixMode) {
            this.log('尝试自动修复依赖漏洞...', 'info');
            await this.runCommand('npm audit fix');
          } else {
            return false;
          }
        }

        this.log(
          `依赖安全扫描: Critical:${counts.critical}, High:${counts.high}, Moderate:${counts.moderate}, Low:${counts.low}`,
          'info'
        );
      }

      return true;
    } catch (error) {
      this.log(`依赖安全扫描异常: ${error.message}`, 'error');
      return false;
    }
  }

  // 辅助函数：比较CSP策略
  comparePolicies(policy1, policy2) {
    const normalize = policy => {
      return policy.replace(/\s+/g, ' ').trim().toLowerCase();
    };

    const normalized1 = normalize(policy1);
    const normalized2 = normalize(policy2);

    // 简单的相似度检查（可以更精细化）
    const common = [...normalized1].filter(char =>
      normalized2.includes(char)
    ).length;
    const similarity =
      common / Math.max(normalized1.length, normalized2.length);

    return similarity > 0.7; // 70%以上相似认为一致
  }

  // 生成安全报告
  generateSecurityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      status: this.exitCode === 0 ? 'PASS' : 'FAIL',
      checks: this.results,
      recommendations: [],
    };

    if (this.exitCode !== 0) {
      report.recommendations.push(
        '运行 npm run security:fix 尝试自动修复部分问题',
        '检查 claudedocs/ 目录下的安全修复建议',
        '确保所有E2E安全测试通过',
        '验证Electron安全配置正确'
      );
    }

    return report;
  }

  // 主执行函数
  async run() {
    this.log('开始综合安全门禁检查...', 'security');

    const checks = [
      ['E2E安全测试', () => this.validateE2ESecurityTests()],
      ['CloudEvents契约', () => this.validateCloudEventsContracts()],
      ['Electron安全基线', () => this.validateElectronSecurity()],
      ['CSP策略一致性', () => this.validateCSPConsistency()],
      ['依赖安全扫描', () => this.runDependencySecurityScan()],
    ];

    for (const [checkName, checkFn] of checks) {
      this.log(`执行检查: ${checkName}`);
      const result = await checkFn();
      this.results.push({ check: checkName, passed: result });

      if (!result) {
        this.log(`${checkName} 检查失败`, 'error');
      }
    }

    const report = this.generateSecurityReport();
    this.log(`\n安全门禁检查完成: ${report.status}`);
    this.log(
      `通过检查: ${this.results.filter(r => r.passed).length}/${this.results.length}`
    );

    if (this.exitCode !== 0) {
      this.log('存在安全问题，请查看上述日志并修复', 'error');
      report.recommendations.forEach(rec => this.log(`建议: ${rec}`, 'warn'));
    }

    return this.exitCode;
  }
}

// 命令行接口
async function main() {
  const args = process.argv.slice(2);
  const options = {
    fix: args.includes('--fix'),
    verbose: args.includes('--verbose') || process.env.CI === 'true',
  };

  const gate = new SecurityGate(options);
  const exitCode = await gate.run();
  process.exit(exitCode);
}

// 如果直接运行此脚本
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('安全门禁执行异常:', error);
    process.exit(1);
  });
}

export { SecurityGate };

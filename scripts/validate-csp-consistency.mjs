#!/usr/bin/env node
/**
 * CSP策略一致性验证脚本
 *
 * 验证开发环境(main.ts)和生产环境(index.html)的CSP策略一致性
 * 确保安全基线要求得到满足
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// CSP安全要求
const SECURITY_REQUIREMENTS = {
  // 必须存在的指令
  requiredDirectives: [
    'default-src',
    'script-src',
    'style-src',
    'object-src',
    'frame-ancestors',
    'base-uri',
  ],

  // 安全值要求
  securityConstraints: {
    'default-src': ["'none'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'none'"],
    'script-src': ["'self'"], // 生产环境不应有 'unsafe-inline'
  },

  // 禁止的危险值
  forbiddenValues: [
    "'unsafe-eval'",
    // "'unsafe-inline'" - 开发环境允许，生产环境禁止
  ],
};

class CSPValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  log(message, level = 'info') {
    const prefix =
      {
        info: '✅',
        warn: '⚠️',
        error: '❌',
      }[level] || 'ℹ️';

    console.log(`${prefix} ${message}`);
  }

  // 解析CSP策略字符串
  parseCSP(csp) {
    const directives = {};

    csp.split(';').forEach(directive => {
      const trimmed = directive.trim();
      if (trimmed) {
        const [key, ...values] = trimmed.split(' ');
        directives[key] = values;
      }
    });

    return directives;
  }

  // 验证单个CSP策略
  validatePolicy(policyName, csp, environment = 'production') {
    this.log(`验证${policyName}CSP策略...`, 'info');

    const directives = this.parseCSP(csp);
    let isValid = true;

    // 检查必需指令
    const missingDirectives = SECURITY_REQUIREMENTS.requiredDirectives.filter(
      required => !Object.keys(directives).includes(required)
    );

    if (missingDirectives.length > 0) {
      this.errors.push(
        `${policyName}: 缺少必需的CSP指令: ${missingDirectives.join(', ')}`
      );
      isValid = false;
    }

    // 检查安全约束
    for (const [directive, expectedValues] of Object.entries(
      SECURITY_REQUIREMENTS.securityConstraints
    )) {
      if (directives[directive]) {
        const hasAllRequired = expectedValues.every(value =>
          directives[directive].includes(value)
        );

        if (!hasAllRequired) {
          const missing = expectedValues.filter(
            value => !directives[directive].includes(value)
          );
          this.errors.push(
            `${policyName}: ${directive}指令缺少安全值: ${missing.join(', ')}`
          );
          isValid = false;
        }
      }
    }

    // 检查禁止值
    for (const [directive, values] of Object.entries(directives)) {
      const foundForbidden = SECURITY_REQUIREMENTS.forbiddenValues.filter(
        forbidden => values.includes(forbidden)
      );

      if (foundForbidden.length > 0) {
        this.errors.push(
          `${policyName}: ${directive}包含禁止的危险值: ${foundForbidden.join(', ')}`
        );
        isValid = false;
      }
    }

    // 生产环境特殊检查
    if (environment === 'production') {
      if (
        directives['script-src'] &&
        directives['script-src'].includes("'unsafe-inline'")
      ) {
        this.errors.push(
          `${policyName}: 生产环境禁止在script-src中使用'unsafe-inline'`
        );
        isValid = false;
      }
    }

    return isValid;
  }

  // 从index.html提取CSP
  extractIndexCSP() {
    const indexPath = join(ROOT_DIR, 'index.html');

    if (!existsSync(indexPath)) {
      this.errors.push('index.html文件不存在');
      return null;
    }

    const content = readFileSync(indexPath, 'utf8');
    const cspMatch = content.match(
      /http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/
    );

    if (!cspMatch) {
      this.errors.push('index.html中未找到CSP meta标签');
      return null;
    }

    return cspMatch[1];
  }

  // 验证CSPManager模块存在性
  validateCSPManagerExists() {
    const cspManagerPath = join(
      ROOT_DIR,
      'electron',
      'security',
      'csp-policy.ts'
    );

    if (!existsSync(cspManagerPath)) {
      this.errors.push(
        'CSPManager模块文件不存在: electron/security/csp-policy.ts'
      );
      return false;
    }

    const content = readFileSync(cspManagerPath, 'utf8');

    // 检查关键方法存在
    const requiredMethods = [
      'generateCSP',
      'generateDevelopmentCSP',
      'generateProductionCSP',
      'validateCSP',
    ];

    const missingMethods = requiredMethods.filter(
      method => !content.includes(`static ${method}`)
    );

    if (missingMethods.length > 0) {
      this.errors.push(`CSPManager缺少必需方法: ${missingMethods.join(', ')}`);
      return false;
    }

    this.log('CSPManager模块验证通过', 'info');
    return true;
  }

  // 验证main.ts集成
  validateMainIntegration() {
    const mainPath = join(ROOT_DIR, 'electron', 'main.ts');

    if (!existsSync(mainPath)) {
      this.errors.push('main.ts文件不存在');
      return false;
    }

    const content = readFileSync(mainPath, 'utf8');

    // 检查CSPManager导入
    if (!content.includes('import { CSPManager }')) {
      this.errors.push('main.ts未导入CSPManager');
      return false;
    }

    // 检查CSPManager使用
    if (!content.includes('CSPManager.generateDevelopmentCSP')) {
      this.errors.push('main.ts未使用CSPManager.generateDevelopmentCSP');
      return false;
    }

    this.log('main.ts CSPManager集成验证通过', 'info');
    return true;
  }

  // 主验证函数
  async validate() {
    this.log('开始CSP策略一致性验证...', 'info');

    // 1. 验证CSPManager模块
    const cspManagerValid = this.validateCSPManagerExists();

    // 2. 验证main.ts集成
    const mainIntegrationValid = this.validateMainIntegration();

    // 3. 验证index.html CSP
    const indexCSP = this.extractIndexCSP();
    let indexValid = false;

    if (indexCSP) {
      indexValid = this.validatePolicy('index.html', indexCSP, 'production');
    }

    // 汇总结果
    const allValid = cspManagerValid && mainIntegrationValid && indexValid;

    this.log(
      `\n验证完成: ${allValid ? '通过' : '失败'}`,
      allValid ? 'info' : 'error'
    );
    this.log(`错误: ${this.errors.length}, 警告: ${this.warnings.length}`);

    if (this.errors.length > 0) {
      this.log('\n错误详情:', 'error');
      this.errors.forEach(error => this.log(`  ${error}`, 'error'));
    }

    if (this.warnings.length > 0) {
      this.log('\n警告详情:', 'warn');
      this.warnings.forEach(warning => this.log(`  ${warning}`, 'warn'));
    }

    return allValid ? 0 : 1;
  }
}

// 执行验证
async function main() {
  const validator = new CSPValidator();
  const exitCode = await validator.validate();
  process.exit(exitCode);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('CSP验证脚本执行失败:', error);
    process.exit(1);
  });
}

export { CSPValidator };

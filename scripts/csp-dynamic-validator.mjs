#!/usr/bin/env node
/**
 * CSP 动态验证器
 * 基于质量门禁配置的动态 CSP 策略验证
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadQualityGatesConfig } from './utils/config-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从配置中心加载 CSP 配置
const environment = process.env.NODE_ENV || 'default';
const config = loadQualityGatesConfig(environment);

/**
 * CSP 策略解析器
 */
class CSPPolicyParser {
  constructor(policyString) {
    this.policy = this.parsePolicyString(policyString);
  }

  parsePolicyString(policyString) {
    const directives = {};
    if (!policyString) return directives;

    // 更准确的 CSP 解析 - 按分号分隔指令，按空格分隔值
    policyString.split(';').forEach(directive => {
      const trimmed = directive.trim();
      if (trimmed) {
        const parts = trimmed.split(/\s+/);
        const name = parts[0];
        const values = parts.slice(1);
        if (name) {
          directives[name] = values;
        }
      }
    });

    console.log('🔍 解析的 CSP 指令:', Object.keys(directives));
    return directives;
  }

  hasDirective(directiveName) {
    return directiveName in this.policy;
  }

  getDirectiveValues(directiveName) {
    return this.policy[directiveName] || [];
  }

  hasValue(directiveName, value) {
    const values = this.getDirectiveValues(directiveName);
    return values.includes(value);
  }
}

/**
 * CSP 动态验证器
 */
class CSPDynamicValidator {
  constructor(config) {
    this.config = config;
    this.violations = [];
    this.warnings = [];
  }

  /**
   * 从 HTML 文件提取 CSP 策略
   */
  extractCSPFromHTML(htmlContent) {
    // 使用调试验证成功的逻辑：直接定位CSP标签并提取
    const cspPosition = htmlContent.indexOf('Content-Security-Policy');
    if (cspPosition === -1) {
      console.log('❌ 未找到Content-Security-Policy标签');
      return null;
    }

    // 找到包含CSP的meta标签的完整范围
    const cspStart = htmlContent.indexOf(
      '<meta',
      Math.max(0, cspPosition - 100)
    );
    const cspEnd = htmlContent.indexOf('/>', cspStart) + 2;

    if (cspStart === -1 || cspEnd === -1 || cspStart > cspPosition) {
      console.log('❌ 无法定位CSP meta标签');
      return null;
    }

    const cspTag = htmlContent.substring(cspStart, cspEnd);

    // 验证这确实是CSP标签
    if (!cspTag.includes('Content-Security-Policy')) {
      console.log('❌ 提取的meta标签不是CSP标签');
      return null;
    }

    // 使用和调试脚本中相同的正则表达式提取content
    const contentMatch = cspTag.match(/content="([^"]*)"/s);
    if (!contentMatch || !contentMatch[1]) {
      console.log('❌ 未能从CSP meta标签提取content属性');
      console.log('Debug CSP标签:', cspTag.substring(0, 100));
      return null;
    }

    // 清理并标准化CSP策略字符串
    const cspPolicy = contentMatch[1]
      .replace(/\s+/g, ' ') // 将多个空白符替换为单个空格
      .replace(/\s*;\s*/g, '; ') // 标准化分号周围的空格
      .trim();

    console.log('🎯 提取的完整 CSP 策略:', cspPolicy);
    return cspPolicy;

    // 备用方案：分行查找 CSP meta 标签
    const lines = htmlContent.split('\n');
    let inMetaTag = false;
    let metaContent = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 检测CSP meta标签开始
      if (
        trimmedLine.includes('http-equiv') &&
        trimmedLine.includes('Content-Security-Policy')
      ) {
        inMetaTag = true;
        metaContent += trimmedLine + ' ';
        continue;
      }

      // 如果在meta标签内
      if (inMetaTag) {
        metaContent += trimmedLine + ' ';

        // 检测meta标签结束
        if (trimmedLine.includes('/>') || trimmedLine.includes('</meta>')) {
          // 提取content属性
          const contentMatch = metaContent.match(/content=["']([^"']+)["']/i);
          if (contentMatch && contentMatch[1]) {
            console.log('🎯 提取的完整 CSP 策略 (多行解析):', contentMatch[1]);
            return contentMatch[1];
          }
          inMetaTag = false;
          metaContent = '';
        }
      }

      // 单行匹配作为最后备用
      if (
        line.includes('Content-Security-Policy') &&
        line.includes('content=')
      ) {
        // 提取 content 属性值 - 支持双引号包围的内容
        const contentMatch = line.match(/content="([^"]+)"/i);
        if (contentMatch && contentMatch[1]) {
          console.log('🎯 提取的完整 CSP 策略:', contentMatch[1]);
          return contentMatch[1];
        }

        // 尝试单引号版本
        const singleContentMatch = line.match(/content='([^']+)'/i);
        if (singleContentMatch && singleContentMatch[1]) {
          console.log(
            '🎯 提取的完整 CSP 策略 (单引号):',
            singleContentMatch[1]
          );
          return singleContentMatch[1];
        }
      }
    }

    console.log('❌ 未能从 HTML 中提取 CSP 策略');
    return null;
  }

  /**
   * 验证 CSP 策略完整性
   */
  validatePolicyIntegrity(parser) {
    const cspConfig = this.config.security?.csp || {};
    const requiredDirectives = [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
    ];

    // 检查必需指令
    requiredDirectives.forEach(directive => {
      if (!parser.hasDirective(directive)) {
        this.violations.push({
          type: 'missing_directive',
          directive,
          severity: 'high',
          message: `缺少必需的 CSP 指令: ${directive}`,
        });
      }
    });

    // 检查危险配置
    const dangerousValues = ["'unsafe-inline'", "'unsafe-eval'"];
    Object.keys(parser.policy).forEach(directive => {
      const values = parser.getDirectiveValues(directive);
      dangerousValues.forEach(dangerous => {
        if (values.includes(dangerous)) {
          this.violations.push({
            type: 'unsafe_directive',
            directive,
            value: dangerous,
            severity: 'critical',
            message: `检测到不安全的 CSP 值: ${directive} ${dangerous}`,
          });
        }
      });
    });

    // 检查通配符使用
    Object.keys(parser.policy).forEach(directive => {
      const values = parser.getDirectiveValues(directive);
      if (values.includes('*')) {
        this.warnings.push({
          type: 'wildcard_usage',
          directive,
          severity: 'medium',
          message: `${directive} 使用通配符 * 可能存在安全风险`,
        });
      }
    });
  }

  /**
   * 验证环境特定配置
   */
  validateEnvironmentSpecific(parser, environment) {
    const values = {
      connect: parser.getDirectiveValues('connect-src'),
    };

    if (environment === 'production') {
      // 生产环境不应该包含开发相关域名
      const devPatterns = ['localhost', '127.0.0.1', 'dev.', 'staging.'];
      values.connect.forEach(src => {
        devPatterns.forEach(pattern => {
          if (src.includes(pattern)) {
            this.violations.push({
              type: 'dev_domain_in_prod',
              directive: 'connect-src',
              value: src,
              severity: 'high',
              message: `生产环境检测到开发域名: ${src}`,
            });
          }
        });
      });
    }

    // 验证 Sentry 集成
    if (!values.connect.some(src => src.includes('sentry.io'))) {
      this.warnings.push({
        type: 'missing_sentry',
        directive: 'connect-src',
        severity: 'low',
        message: '未在 connect-src 中发现 Sentry 配置，可能影响错误报告',
      });
    }
  }

  /**
   * 验证安全基线合规性
   */
  validateSecurityBaseline(parser) {
    const securityChecks = [
      {
        directive: 'object-src',
        expectedValue: "'none'",
        message: 'object-src 应设置为 none 以防止插件执行',
      },
      {
        directive: 'base-uri',
        expectedValue: "'self'",
        message: 'base-uri 应限制为 self 以防止基础URI劫持',
      },
      {
        directive: 'form-action',
        expectedValue: "'self'",
        message: 'form-action 应限制为 self 以防止表单提交到恶意站点',
      },
      {
        directive: 'frame-ancestors',
        expectedValue: "'none'",
        message: 'frame-ancestors 应设置为 none 以防止点击劫持',
      },
    ];

    securityChecks.forEach(check => {
      const values = parser.getDirectiveValues(check.directive);
      if (!values.includes(check.expectedValue)) {
        this.violations.push({
          type: 'security_baseline_violation',
          directive: check.directive,
          expected: check.expectedValue,
          actual: values.join(' '),
          severity: 'high',
          message: check.message,
        });
      }
    });
  }

  /**
   * 执行完整验证
   */
  async validateCSPPolicy(htmlFile) {
    console.log(`🔍 验证 CSP 策略: ${htmlFile}`);

    if (!fs.existsSync(htmlFile)) {
      throw new Error(`HTML 文件不存在: ${htmlFile}`);
    }

    const htmlContent = fs.readFileSync(htmlFile, 'utf8');
    const cspPolicy = this.extractCSPFromHTML(htmlContent);

    if (!cspPolicy) {
      this.violations.push({
        type: 'missing_csp',
        severity: 'critical',
        message: `文件中未找到 CSP meta 标签: ${htmlFile}`,
      });
      return;
    }

    console.log(`📋 检测到 CSP 策略: ${cspPolicy.substring(0, 100)}...`);

    const parser = new CSPPolicyParser(cspPolicy);

    // 执行各项验证
    this.validatePolicyIntegrity(parser);
    this.validateEnvironmentSpecific(parser, environment);
    this.validateSecurityBaseline(parser);

    return {
      policy: cspPolicy,
      parsed: parser.policy,
      violations: this.violations,
      warnings: this.warnings,
    };
  }

  /**
   * 生成验证报告
   */
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CSP 动态验证报告');
    console.log('='.repeat(60));

    console.log(`\n🛡️  环境: ${environment}`);
    console.log(`📝 违规项: ${this.violations.length}`);
    console.log(`⚠️  警告项: ${this.warnings.length}`);

    if (this.violations.length > 0) {
      console.log('\n❌ 违规详情:');
      this.violations.forEach((violation, index) => {
        console.log(
          `  ${index + 1}. [${violation.severity.toUpperCase()}] ${violation.message}`
        );
        if (violation.directive) {
          console.log(`     指令: ${violation.directive}`);
        }
        if (violation.value) {
          console.log(`     值: ${violation.value}`);
        }
        if (violation.expected && violation.actual) {
          console.log(
            `     期望: ${violation.expected}, 实际: ${violation.actual}`
          );
        }
      });
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  警告详情:');
      this.warnings.forEach((warning, index) => {
        console.log(
          `  ${index + 1}. [${warning.severity.toUpperCase()}] ${warning.message}`
        );
      });
    }

    if (this.violations.length === 0 && this.warnings.length === 0) {
      console.log('\n✅ 所有 CSP 检查通过！');
    }

    return {
      passed: this.violations.length === 0,
      violations: this.violations.length,
      warnings: this.warnings.length,
    };
  }
}

/**
 * 命令行接口
 */
async function main() {
  const command = process.argv[2] || 'validate';
  const targetFile = process.argv[3] || 'index.html';

  try {
    const validator = new CSPDynamicValidator(config);

    switch (command) {
      case 'validate':
        console.log('🚀 启动 CSP 动态验证器...');
        console.log(`📁 目标文件: ${targetFile}`);
        console.log(`🌍 环境: ${environment}\n`);

        const result = await validator.validateCSPPolicy(targetFile);
        const report = validator.generateReport();

        // 保存报告到文件
        const reportFile = `./reports/csp-validation-${Date.now()}.json`;
        fs.mkdirSync('./reports', { recursive: true });
        fs.writeFileSync(
          reportFile,
          JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              environment,
              file: targetFile,
              ...result,
              summary: report,
            },
            null,
            2
          )
        );

        console.log(`\n💾 详细报告已保存: ${reportFile}`);

        if (!report.passed) {
          console.log('\n❌ CSP 验证失败');
          process.exit(1);
        } else {
          console.log('\n✅ CSP 验证通过');
          process.exit(0);
        }
        break;

      case 'help':
      default:
        console.log(`
CSP 动态验证器 - 使用方法:

命令:
  validate [file]  - 验证指定的 HTML 文件的 CSP 策略 (默认: index.html)
  help            - 显示此帮助信息

环境变量:
  NODE_ENV        - 指定环境 (development/production，默认: development)

示例:
  node scripts/csp-dynamic-validator.mjs validate index.html
  NODE_ENV=production node scripts/csp-dynamic-validator.mjs validate dist/index.html
        `);
        break;
    }
  } catch (error) {
    console.error('❌ CSP 验证器错误:', error.message);
    process.exit(1);
  }
}

// 如果直接运行脚本
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith('csp-dynamic-validator.mjs')
) {
  main();
}

export { CSPDynamicValidator, CSPPolicyParser };

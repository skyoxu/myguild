#!/usr/bin/env node
/**
 * 可观测性配置统一验证脚本
 *
 * 功能：验证所有环境(dev/staging/prod)的可观测性配置一致性
 * 替代：原来的三个分离环境检查项
 * 基于：ADR-0003 可观测性和发布健康标准
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATHS = {
  development: 'config/development.json',
  staging: 'config/staging.json',
  production: 'config/production.json',
};

const REQUIRED_OBSERVABILITY_FIELDS = [
  'sentry.dsn',
  'sentry.environment',
  'sentry.release',
  'logging.level',
  'logging.structured',
  'metrics.enabled',
  'crashReporting.enabled',
];

class ObservabilityConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.configs = {};
  }

  /**
   * 加载所有环境配置文件
   */
  loadConfigs() {
    console.log('🔍 加载环境配置文件...');

    for (const [env, configPath] of Object.entries(CONFIG_PATHS)) {
      try {
        if (!fs.existsSync(configPath)) {
          this.errors.push(`❌ 配置文件不存在: ${configPath}`);
          continue;
        }

        const configContent = fs.readFileSync(configPath, 'utf8');
        this.configs[env] = JSON.parse(configContent);
        console.log(`✓ 已加载 ${env} 配置`);
      } catch (error) {
        this.errors.push(`❌ 解析配置文件失败 ${configPath}: ${error.message}`);
      }
    }
  }

  /**
   * 验证必需字段存在性
   */
  validateRequiredFields() {
    console.log('\n📋 验证必需可观测性字段...');

    for (const [env, config] of Object.entries(this.configs)) {
      for (const field of REQUIRED_OBSERVABILITY_FIELDS) {
        const value = this.getNestedValue(config, field);

        if (value === undefined || value === null) {
          this.errors.push(`❌ ${env}环境缺少必需字段: ${field}`);
        } else {
          console.log(
            `✓ ${env}.${field}: ${typeof value === 'string' ? value : JSON.stringify(value)}`
          );
        }
      }
    }
  }

  /**
   * 验证环境间配置一致性
   */
  validateConsistency() {
    console.log('\n🔄 验证环境间配置一致性...');

    const environments = Object.keys(this.configs);
    if (environments.length < 2) {
      this.warnings.push('⚠️  只有一个环境配置，跳过一致性检查');
      return;
    }

    // 检查关键配置字段的一致性（除了environment字段）
    const consistencyFields = REQUIRED_OBSERVABILITY_FIELDS.filter(
      field => !field.includes('environment') && !field.includes('dsn')
    );

    for (const field of consistencyFields) {
      const values = environments.map(env =>
        this.getNestedValue(this.configs[env], field)
      );

      const uniqueValues = [...new Set(values.map(v => JSON.stringify(v)))];

      if (uniqueValues.length > 1) {
        this.warnings.push(
          `⚠️  字段 ${field} 在环境间不一致: ${uniqueValues.join(', ')}`
        );
      } else {
        console.log(`✓ ${field} 在所有环境间一致`);
      }
    }
  }

  /**
   * 验证Sentry配置的有效性
   */
  validateSentryConfig() {
    console.log('\n🛡️  验证Sentry配置...');

    for (const [env, config] of Object.entries(this.configs)) {
      const sentryDsn = this.getNestedValue(config, 'sentry.dsn');

      if (sentryDsn && typeof sentryDsn === 'string') {
        // 验证DSN格式 - 支持字母数字组合（符合Sentry官方格式）
        const dsnPattern =
          /^https:\/\/[a-zA-Z0-9]+@[a-zA-Z0-9]+\.ingest\.sentry\.io\/[0-9]+$/;
        if (!dsnPattern.test(sentryDsn)) {
          this.errors.push(`❌ ${env}环境Sentry DSN格式无效: ${sentryDsn}`);
        } else {
          console.log(`✓ ${env} Sentry DSN格式正确`);
        }
      }
    }
  }

  /**
   * 获取嵌套对象值
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * 生成验证报告
   */
  generateReport() {
    console.log('\n📊 生成验证报告...');

    const report = {
      timestamp: new Date().toISOString(),
      status: this.errors.length === 0 ? 'PASS' : 'FAIL',
      summary: {
        environments: Object.keys(this.configs).length,
        errors: this.errors.length,
        warnings: this.warnings.length,
      },
      errors: this.errors,
      warnings: this.warnings,
    };

    // 保存报告文件
    const reportPath = 'logs/observability-validation-report.json';
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📄 报告已保存: ${reportPath}`);
    return report;
  }

  /**
   * 执行完整验证流程
   */
  async validate() {
    console.log('🚀 开始可观测性配置验证...\n');

    this.loadConfigs();

    if (Object.keys(this.configs).length === 0) {
      this.errors.push('❌ 未能加载任何配置文件');
      return this.generateReport();
    }

    this.validateRequiredFields();
    this.validateConsistency();
    this.validateSentryConfig();

    const report = this.generateReport();

    console.log('\n=== 验证结果摘要 ===');
    console.log(`状态: ${report.status}`);
    console.log(`环境数量: ${report.summary.environments}`);
    console.log(`错误数量: ${report.summary.errors}`);
    console.log(`警告数量: ${report.summary.warnings}`);

    if (report.errors.length > 0) {
      console.log('\n❌ 发现错误:');
      report.errors.forEach(error => console.log(`  ${error}`));
    }

    if (report.warnings.length > 0) {
      console.log('\n⚠️  发现警告:');
      report.warnings.forEach(warning => console.log(`  ${warning}`));
    }

    return report;
  }
}

// 主执行逻辑
if (process.argv[1] === __filename) {
  const validator = new ObservabilityConfigValidator();

  validator
    .validate()
    .then(report => {
      // 基于验证结果设置进程退出码
      process.exit(report.status === 'PASS' ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 验证过程出现异常:', error);
      process.exit(1);
    });
}

export default ObservabilityConfigValidator;

#!/usr/bin/env node
/**
 * 混合配置管理构建管道
 * 功能：将Base文档中的占位符替换为项目实际配置
 * 策略：Base文档保持占位符，项目实现时进行安全替换
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';

// 配置源定义（分层配置管理）
const CONFIG_SOURCES = {
  // 构建时配置（package.json等）
  buildTime: {
    APP_NAME: () => process.env.npm_package_name || 'unknown-app',
    PRODUCT_NAME: () =>
      process.env.npm_package_productName || 'Unknown Product',
    PRODUCT_SLUG: () =>
      process.env.npm_package_name?.replace(/[^a-zA-Z0-9-]/g, '') ||
      'unknown-product',
    VERSION: () => process.env.npm_package_version || '0.0.0',
  },

  // CI/运行时配置（环境变量）
  runtime: {
    SENTRY_ORG: () => process.env.SENTRY_ORG || 'dev-team',
    SENTRY_PROJECT: () => process.env.SENTRY_PROJECT || 'dev-project',
    RELEASE_PREFIX: () => process.env.RELEASE_PREFIX || 'dev',
    ENV: () => process.env.NODE_ENV || 'development',
  },

  // 域级配置（代码层面定义）
  domain: {
    DOMAIN_PREFIX: () => 'gamedev', // 项目特定的域前缀
    CRASH_FREE_SESSIONS: () => '99.5', // 默认SLO目标
  },
};

class ConfigSubstitutionEngine {
  constructor() {
    this.substitutionLog = [];
  }

  /**
   * 解析占位符并获取实际值
   */
  resolvePlaceholder(placeholder) {
    const key = placeholder.replace(/\$\{|\}/g, '');

    // 按优先级查找配置源
    for (const [sourceType, configs] of Object.entries(CONFIG_SOURCES)) {
      if (configs[key]) {
        const value = configs[key]();
        this.substitutionLog.push({
          placeholder,
          key,
          value,
          source: sourceType,
          timestamp: new Date().toISOString(),
        });
        return value;
      }
    }

    // 占位符未找到，记录警告
    console.warn(`⚠️ 未找到占位符配置: ${placeholder}`);
    this.substitutionLog.push({
      placeholder,
      key,
      value: placeholder, // 保持原样
      source: 'unresolved',
      timestamp: new Date().toISOString(),
    });
    return placeholder;
  }

  /**
   * 处理单个文件的占位符替换
   */
  async processFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const originalContent = content;

      // 查找所有占位符（${VAR} 格式）
      const placeholderRegex = /\$\{[A-Z_][A-Z0-9_]*\}/g;
      const matches = content.match(placeholderRegex) || [];

      if (matches.length === 0) {
        console.log(`✅ ${filePath}: 无占位符，跳过处理`);
        return;
      }

      let processedContent = content;
      const uniquePlaceholders = [...new Set(matches)];

      for (const placeholder of uniquePlaceholders) {
        const value = this.resolvePlaceholder(placeholder);
        processedContent = processedContent.replaceAll(placeholder, value);
      }

      // 仅在内容有变化时写入文件
      if (processedContent !== originalContent) {
        await fs.writeFile(filePath, processedContent, 'utf-8');
        console.log(
          `🔄 ${filePath}: 替换了 ${uniquePlaceholders.length} 个占位符`
        );
      }
    } catch (error) {
      console.error(`❌ 处理文件失败 ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * 批量处理目标文件
   */
  async processFiles(patterns) {
    console.log('📋 开始配置替换过程...');

    for (const pattern of patterns) {
      const files = await glob(pattern, { cwd: process.cwd() });
      console.log(`🔍 找到 ${files.length} 个文件匹配模式: ${pattern}`);

      for (const file of files) {
        await this.processFile(file);
      }
    }

    // 生成替换日志
    await this.generateSubstitutionReport();
  }

  /**
   * 生成配置替换报告
   */
  async generateSubstitutionReport() {
    const reportPath = 'logs/config-substitution-report.json';

    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      totalSubstitutions: this.substitutionLog.length,
      substitutions: this.substitutionLog,
      configSources: Object.keys(CONFIG_SOURCES),
      summary: this.generateSummary(),
    };

    // 确保logs目录存在
    await fs.mkdir('logs', { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 替换报告已生成: ${reportPath}`);
    console.log(
      `📈 替换汇总: ${report.summary.resolved}个成功, ${report.summary.unresolved}个未解析`
    );
  }

  generateSummary() {
    const resolved = this.substitutionLog.filter(
      log => log.source !== 'unresolved'
    ).length;
    const unresolved = this.substitutionLog.filter(
      log => log.source === 'unresolved'
    ).length;

    return {
      resolved,
      unresolved,
      bySource: this.substitutionLog.reduce((acc, log) => {
        acc[log.source] = (acc[log.source] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}

// 配置验证器
class ConfigValidator {
  static validate() {
    console.log('🔍 验证配置完整性...');
    const issues = [];

    // 验证必需的环境变量
    const requiredEnvVars = ['NODE_ENV'];
    const productionRequired = ['SENTRY_ORG', 'SENTRY_PROJECT'];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push(`缺少必需环境变量: ${envVar}`);
      }
    }

    if (process.env.NODE_ENV === 'production') {
      for (const envVar of productionRequired) {
        if (!process.env[envVar]) {
          issues.push(`生产环境缺少必需环境变量: ${envVar}`);
        }
      }
    }

    if (issues.length > 0) {
      console.error('❌ 配置验证失败:');
      issues.forEach(issue => console.error(`  - ${issue}`));
      process.exit(1);
    }

    console.log('✅ 配置验证通过');
  }
}

// CLI 入口
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
配置替换工具使用说明:

npm run config:substitute [options]

选项:
  --docs-only     仅处理文档文件
  --src-only      仅处理源码文件  
  --validate      运行配置验证
  --help, -h      显示此帮助信息

默认行为: 处理所有匹配文件

示例:
  npm run config:substitute --docs-only
  npm run config:substitute --validate
    `);
    return;
  }

  try {
    if (args.includes('--validate')) {
      ConfigValidator.validate();
    }

    const engine = new ConfigSubstitutionEngine();
    let patterns;

    if (args.includes('--docs-only')) {
      patterns = [
        'docs/architecture/base/**/*.md',
        'docs/architecture/overlays/**/*.md',
      ];
    } else if (args.includes('--src-only')) {
      patterns = ['src/**/*.{ts,tsx,js,jsx}', 'tests/**/*.{ts,tsx,js,jsx}'];
    } else {
      // 默认处理所有文件
      patterns = [
        'docs/architecture/**/*.md',
        'src/**/*.{ts,tsx,js,jsx}',
        'tests/**/*.{ts,tsx,js,jsx}',
        'public/**/*.html',
      ];
    }

    await engine.processFiles(patterns);
    console.log('🎉 配置替换完成');
  } catch (error) {
    console.error('💥 配置替换失败:', error.message);
    process.exit(1);
  }
}

// 自动执行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

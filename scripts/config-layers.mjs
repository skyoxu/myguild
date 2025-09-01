#!/usr/bin/env node
/**
 * 分层配置管理策略实现
 * 实现ChatGPT-5建议的配置分层：package.json + CI Secrets + Runtime + Domain
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 配置分层管理器
 * 按照十二要素应用方法论进行配置分层
 */
class ConfigLayersManager {
  constructor() {
    this.layers = {
      package: {}, // package.json 构建时配置
      ciSecrets: {}, // CI/CD 敏感配置
      runtime: {}, // 运行时环境变量
      domain: {}, // 域级硬编码配置
    };
  }

  /**
   * 从 package.json 加载构建时配置
   */
  async loadPackageConfig() {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));

      this.layers.package = {
        APP_NAME: packageJson.name,
        PRODUCT_NAME: packageJson.productName || packageJson.displayName,
        PRODUCT_SLUG: packageJson.name?.replace(/[^a-zA-Z0-9-]/g, ''),
        VERSION: packageJson.version,
        DESCRIPTION: packageJson.description,
      };

      console.log(
        '✅ Package layer loaded:',
        Object.keys(this.layers.package).length,
        'configs'
      );
    } catch (error) {
      console.warn('⚠️ Failed to load package.json config:', error.message);
    }
  }

  /**
   * 从环境变量加载 CI Secrets 配置
   */
  loadCiSecretsConfig() {
    const secretKeys = [
      'SENTRY_ORG',
      'SENTRY_PROJECT',
      'SENTRY_AUTH_TOKEN',
      'APPLE_ID',
      'APPLE_APP_SPECIFIC_PASSWORD',
      'CERTIFICATE_PASSWORD',
      'GITHUB_TOKEN',
    ];

    this.layers.ciSecrets = {};
    secretKeys.forEach(key => {
      if (process.env[key]) {
        this.layers.ciSecrets[key] = process.env[key];
      }
    });

    console.log(
      '✅ CI Secrets layer loaded:',
      Object.keys(this.layers.ciSecrets).length,
      'secrets'
    );
  }

  /**
   * 从环境变量加载运行时配置
   */
  loadRuntimeConfig() {
    this.layers.runtime = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      ENV: process.env.NODE_ENV || 'development',
      RELEASE_PREFIX: process.env.RELEASE_PREFIX || 'dev',
      ELECTRON_IS_DEV: process.env.NODE_ENV !== 'production' ? 'true' : 'false',
      DEBUG: process.env.DEBUG || '',
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    };

    console.log(
      '✅ Runtime layer loaded:',
      Object.keys(this.layers.runtime).length,
      'configs'
    );
  }

  /**
   * 加载域级配置（项目特定的硬编码配置）
   */
  loadDomainConfig() {
    this.layers.domain = {
      DOMAIN_PREFIX: 'gamedev',
      CRASH_FREE_SESSIONS: '99.5',
      CRASH_FREE_USERS: '99.5',
      DEFAULT_FPS: '60',
      EVENT_TP95_TARGET: '50',
      UI_TP95_TARGET: '100',
      ERROR_COVERAGE_TARGET: '95',
    };

    console.log(
      '✅ Domain layer loaded:',
      Object.keys(this.layers.domain).length,
      'configs'
    );
  }

  /**
   * 合并所有配置层，处理优先级
   * 优先级：Domain > Runtime > CI Secrets > Package
   */
  getMergedConfig() {
    const merged = {
      ...this.layers.package,
      ...this.layers.ciSecrets,
      ...this.layers.runtime,
      ...this.layers.domain, // 最高优先级
    };

    return merged;
  }

  /**
   * 生成配置概览报告
   */
  generateConfigReport() {
    const merged = this.getMergedConfig();

    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      layers: {
        package: {
          count: Object.keys(this.layers.package).length,
          keys: Object.keys(this.layers.package),
        },
        ciSecrets: {
          count: Object.keys(this.layers.ciSecrets).length,
          keys: Object.keys(this.layers.ciSecrets).map(key =>
            key.includes('TOKEN') || key.includes('PASSWORD')
              ? `${key}=[MASKED]`
              : key
          ),
        },
        runtime: {
          count: Object.keys(this.layers.runtime).length,
          keys: Object.keys(this.layers.runtime),
        },
        domain: {
          count: Object.keys(this.layers.domain).length,
          keys: Object.keys(this.layers.domain),
        },
      },
      merged: {
        totalConfigs: Object.keys(merged).length,
        // 敏感信息masking
        configs: Object.fromEntries(
          Object.entries(merged).map(([key, value]) => [
            key,
            key.includes('TOKEN') ||
            key.includes('PASSWORD') ||
            key.includes('SECRET')
              ? '[MASKED]'
              : value,
          ])
        ),
      },
    };

    return report;
  }

  /**
   * 生成用于模板替换的配置对象
   */
  getTemplateConfig() {
    const merged = this.getMergedConfig();

    // 转换为 ${VAR} 格式的映射
    const templateConfig = {};
    Object.entries(merged).forEach(([key, value]) => {
      templateConfig[`\${${key}}`] = value;
    });

    return templateConfig;
  }

  /**
   * 验证配置完整性
   */
  validateConfig() {
    const requiredConfigs = {
      development: ['APP_NAME', 'PRODUCT_NAME', 'DOMAIN_PREFIX'],
      production: [
        'APP_NAME',
        'PRODUCT_NAME',
        'DOMAIN_PREFIX',
        'SENTRY_ORG',
        'SENTRY_PROJECT',
      ],
      test: ['APP_NAME', 'PRODUCT_NAME', 'DOMAIN_PREFIX'],
    };

    const currentEnv = process.env.NODE_ENV || 'development';
    const required = requiredConfigs[currentEnv] || requiredConfigs.development;
    const merged = this.getMergedConfig();

    const missing = required.filter(key => !merged[key]);

    if (missing.length > 0) {
      console.error(`❌ ${currentEnv} 环境缺少必需配置:`, missing);
      return false;
    }

    console.log(`✅ ${currentEnv} 环境配置验证通过`);
    return true;
  }

  /**
   * 初始化所有配置层
   */
  async initializeAll() {
    console.log('🔧 初始化配置层...');

    await this.loadPackageConfig();
    this.loadCiSecretsConfig();
    this.loadRuntimeConfig();
    this.loadDomainConfig();

    // 验证配置完整性
    const isValid = this.validateConfig();

    if (!isValid) {
      throw new Error('配置验证失败');
    }

    return this.getMergedConfig();
  }

  /**
   * 导出配置到不同格式
   */
  async exportConfig(format = 'json', outputPath = 'logs/config-export') {
    const config = this.getMergedConfig();
    const report = this.generateConfigReport();

    // 确保输出目录存在
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    switch (format.toLowerCase()) {
      case 'json':
        await fs.writeFile(
          `${outputPath}.json`,
          JSON.stringify(report, null, 2)
        );
        console.log(`📄 配置已导出到: ${outputPath}.json`);
        break;

      case 'env':
        const envContent = Object.entries(config)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
        await fs.writeFile(`${outputPath}.env`, envContent);
        console.log(`📄 环境变量已导出到: ${outputPath}.env`);
        break;

      case 'typescript':
        const tsContent = `// Auto-generated configuration
export const CONFIG = ${JSON.stringify(config, null, 2)} as const;

export type ConfigKeys = keyof typeof CONFIG;
`;
        await fs.writeFile(`${outputPath}.ts`, tsContent);
        console.log(`📄 TypeScript配置已导出到: ${outputPath}.ts`);
        break;

      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }
}

// CLI 入口
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
分层配置管理工具使用说明:

npm run config:layers [command] [options]

命令:
  init           初始化并验证所有配置层
  export         导出合并后的配置
  validate       仅运行配置验证
  report         生成配置报告

选项:
  --format       导出格式 (json|env|typescript, 默认: json)
  --output       输出文件路径 (默认: logs/config-export)
  --help, -h     显示此帮助信息

示例:
  npm run config:layers init
  npm run config:layers export --format typescript
  npm run config:layers validate
    `);
    return;
  }

  try {
    const manager = new ConfigLayersManager();
    const command = args[0] || 'init';

    switch (command) {
      case 'init':
        await manager.initializeAll();
        console.log('🎉 配置层初始化完成');
        break;

      case 'export':
        await manager.initializeAll();
        const format = args.includes('--format')
          ? args[args.indexOf('--format') + 1]
          : 'json';
        const output = args.includes('--output')
          ? args[args.indexOf('--output') + 1]
          : 'logs/config-export';
        await manager.exportConfig(format, output);
        break;

      case 'validate':
        await manager.initializeAll();
        // 验证已在initializeAll中完成
        break;

      case 'report':
        await manager.initializeAll();
        const report = manager.generateConfigReport();
        console.log('📊 配置报告:');
        console.log(JSON.stringify(report, null, 2));
        break;

      default:
        console.error(`❌ 未知命令: ${command}`);
        console.log('使用 --help 查看可用命令');
        process.exit(1);
    }
  } catch (error) {
    console.error('💥 配置层管理失败:', error.message);
    process.exit(1);
  }
}

// 自动执行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// 导出供其他模块使用
export { ConfigLayersManager };

#!/usr/bin/env node
/**
 * 质量门禁配置加载器
 * 支持多环境配置覆盖和JSON Schema验证
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置文件路径
const CONFIG_DIR = path.resolve(__dirname, '../../config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'quality-gates.json');
const SCHEMA_FILE = path.join(CONFIG_DIR, 'quality-gates.schema.json');

/**
 * 深度合并对象
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * 简化的JSON Schema验证器
 * 只验证关键字段，不依赖外部库
 */
function validateConfig(config) {
  const errors = [];

  // 检查必需字段
  if (!config.version) {
    errors.push('Missing required field: version');
  }

  if (!config.environments) {
    errors.push('Missing required field: environments');
  } else if (!config.environments.default) {
    errors.push('Missing required field: environments.default');
  }

  // 检查版本格式
  if (config.version && !/^\d+\.\d+\.\d+$/.test(config.version)) {
    errors.push('Invalid version format. Expected: x.y.z');
  }

  // 检查阈值格式
  function validateThresholds(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (value && typeof value === 'object') {
        if (value.threshold !== undefined) {
          // 这是一个阈值对象
          if (typeof value.threshold !== 'number') {
            errors.push(`${currentPath}.threshold must be a number`);
          }
          if (!value.unit) {
            errors.push(`${currentPath}.unit is required`);
          }
        } else {
          // 递归检查嵌套对象
          validateThresholds(value, currentPath);
        }
      }
    }
  }

  if (config.environments?.default) {
    validateThresholds(config.environments.default, 'environments.default');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 加载质量门禁配置
 * @param {string} environment - 环境名称 (development, production, ci, 或自定义)
 * @param {Object} options - 加载选项
 * @returns {Object} 合并后的配置对象
 */
export function loadQualityGatesConfig(environment = 'default', options = {}) {
  const {
    validateSchema = true,
    configFile = CONFIG_FILE,
    throwOnError = true,
  } = options;

  try {
    // 检查配置文件是否存在
    if (!fs.existsSync(configFile)) {
      const error = new Error(
        `Quality gates config file not found: ${configFile}`
      );
      if (throwOnError) throw error;
      console.warn(`Warning: ${error.message}`);
      return getDefaultConfig();
    }

    // 读取配置文件
    const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));

    // JSON Schema验证
    if (validateSchema) {
      const validation = validateConfig(configData);
      if (!validation.valid) {
        const error = new Error(
          `Config validation failed: ${validation.errors.join(', ')}`
        );
        if (throwOnError) throw error;
        console.warn(`Warning: ${error.message}`);
      }
    }

    // 获取基础配置（default环境）
    const baseConfig = configData.environments.default || {};

    // 如果请求的就是默认环境，直接返回
    if (environment === 'default') {
      return addConfigMetadata(baseConfig, { environment, source: configFile });
    }

    // 应用环境特定的覆盖
    let finalConfig = { ...baseConfig };

    // 首先检查environments中是否有该环境
    if (configData.environments[environment]) {
      finalConfig = deepMerge(
        finalConfig,
        configData.environments[environment]
      );
    }

    // 然后应用overrides中的配置
    if (configData.overrides && configData.overrides[environment]) {
      finalConfig = deepMerge(finalConfig, configData.overrides[environment]);
    }

    return addConfigMetadata(finalConfig, {
      environment,
      source: configFile,
      version: configData.version,
      lastUpdated: configData.lastUpdated,
    });
  } catch (error) {
    if (throwOnError) {
      throw new Error(`Failed to load quality gates config: ${error.message}`);
    }

    console.error(`Error loading config: ${error.message}`);
    console.warn('Falling back to default configuration');
    return getDefaultConfig();
  }
}

/**
 * 添加配置元数据
 */
function addConfigMetadata(config, metadata) {
  return {
    ...config,
    _meta: metadata,
  };
}

/**
 * 获取默认配置（硬编码后备）
 */
function getDefaultConfig() {
  return {
    bundleSize: {
      mainProcess: { threshold: 2097152, unit: 'bytes' },
      renderer: {
        js: { threshold: 1572864, unit: 'bytes' },
        css: { threshold: 204800, unit: 'bytes' },
        html: { threshold: 51200, unit: 'bytes' },
      },
    },
    webVitals: {
      baseline: {
        windowDays: 7,
        minSampleSize: 50,
        confidenceLevel: 0.95,
      },
      regressionThresholds: {
        LCP: { warning: 10, critical: 20, unit: 'percent' },
        INP: { warning: 15, critical: 30, unit: 'percent' },
        CLS: { warning: 25, critical: 50, unit: 'percent' },
        FCP: { warning: 10, critical: 25, unit: 'percent' },
        TTFB: { warning: 15, critical: 30, unit: 'percent' },
      },
    },
    coverage: {
      lines: { threshold: 90, unit: 'percent' },
      branches: { threshold: 85, unit: 'percent' },
      functions: { threshold: 88, unit: 'percent' },
      statements: { threshold: 90, unit: 'percent' },
    },
    _meta: {
      environment: 'fallback',
      source: 'hardcoded-default',
    },
  };
}

/**
 * 获取特定模块的配置
 * @param {string} module - 模块名 (bundleSize, webVitals, coverage等)
 * @param {string} environment - 环境名
 * @returns {Object} 模块配置
 */
export function getModuleConfig(module, environment = 'default') {
  const config = loadQualityGatesConfig(environment);
  return config[module] || {};
}

/**
 * 获取阈值数值（自动提取threshold字段）
 * @param {string} path - 配置路径，如 'bundleSize.mainProcess'
 * @param {string} environment - 环境名
 * @returns {number|null} 阈值数值
 */
export function getThreshold(path, environment = 'default') {
  const config = loadQualityGatesConfig(environment);
  const pathParts = path.split('.');

  let current = config;
  for (const part of pathParts) {
    current = current?.[part];
    if (current === undefined) return null;
  }

  return current?.threshold ?? current;
}

/**
 * 命令行接口
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const environment = process.argv[2] || 'default';
  const module = process.argv[3];

  try {
    if (module) {
      const moduleConfig = getModuleConfig(module, environment);
      console.log(JSON.stringify(moduleConfig, null, 2));
    } else {
      const config = loadQualityGatesConfig(environment);
      console.log(JSON.stringify(config, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/* Electron Fuses 生产环境安全强化配置 */
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

/**
 * 生产环境 Electron Fuses 安全强化配置
 * 基于最小权限原则，实现系统级安全收敛
 */
const PRODUCTION_FUSES_CONFIG = {
  version: FuseVersion.V1,

  // 🔒 系统级收敛：打包期熔断危险入口点
  runAsNode: false, // 禁用runAsNode模式（关键！）
  enableRunAsNode: false, // 确保无法启用runAsNode
  enableNodeOptionsEnvironmentVariable: false, // 禁用NODE_OPTIONS环境变量
  enableNodeCliInspectArguments: false, // 禁用Node CLI调试参数

  // 🛡️ 完整性验证和ASAR保护
  onlyLoadAppFromAsar: true, // 只从ASAR加载应用（关键！）
  enableEmbeddedAsarIntegrityValidation: true, // 启用ASAR完整性验证（关键！）

  // 🔐 附加安全强化
  resetAdHocDarwinCASignature: false, // 保持代码签名完整性
  enableCookieEncryption: true, // 启用Cookie加密
  loadBrowserProcessSpecificV8Snapshot: false, // 禁用浏览器特定V8快照
  enablePrintPrototypeOverwrite: false, // 禁用原型覆盖
};

/**
 * 开发环境 Electron Fuses 配置
 * 允许调试和开发工具
 */
const DEVELOPMENT_FUSES_CONFIG = {
  version: FuseVersion.V1,

  // 🔓 开发环境放宽限制
  resetAdHocDarwinCASignature: false,
  enableCookieEncryption: false, // 开发环境可以禁用Cookie加密
  enableNodeOptionsEnvironmentVariable: true, // 允许NODE_OPTIONS用于调试
  enableNodeCliInspectArguments: true, // 允许Node调试参数
  enableEmbeddedAsarIntegrityValidation: false, // 开发环境可以禁用ASAR验证
  onlyLoadAppFromAsar: false, // 允许从文件系统加载

  // 🛠️ 开发工具支持
  loadBrowserProcessSpecificV8Snapshot: true,
  enablePrintPrototypeOverwrite: true,

  // 🔧 允许调试模式
  runAsNode: true,
  enableRunAsNode: true,
};

/**
 * 应用Electron Fuses配置
 * @param {boolean} isProduction - 是否为生产环境
 */
async function applyFusesConfig(
  isProduction = process.env.NODE_ENV === 'production'
) {
  const { flipFuses, FuseV1Options, FuseVersion } = require('@electron/fuses');
  const path = require('path');

  const electronBinary = path.join(__dirname, '..', 'dist-electron', 'main.js');
  const config = isProduction
    ? PRODUCTION_FUSES_CONFIG
    : DEVELOPMENT_FUSES_CONFIG;

  console.log(
    `🔧 正在应用 ${isProduction ? '生产环境' : '开发环境'} Electron Fuses 配置...`
  );

  try {
    await flipFuses(electronBinary, config);
    console.log('✅ Electron Fuses 配置成功应用');

    // 验证配置
    await verifyFusesConfig(electronBinary, config);
  } catch (error) {
    console.error('❌ Electron Fuses 配置失败:', error);
    process.exit(1);
  }
}

/**
 * 验证Electron Fuses配置是否正确应用
 * @param {string} electronBinary - Electron二进制文件路径
 * @param {object} expectedConfig - 预期的配置
 */
async function verifyFusesConfig(electronBinary, expectedConfig) {
  const { readFuses } = require('@electron/fuses');

  console.log('🔍 正在验证 Electron Fuses 配置...');

  try {
    const actualFuses = await readFuses(electronBinary);

    // 验证关键安全设置
    const criticalChecks = [
      { key: 'runAsNode', expected: expectedConfig.runAsNode },
      {
        key: 'enableNodeOptionsEnvironmentVariable',
        expected: expectedConfig.enableNodeOptionsEnvironmentVariable,
      },
      {
        key: 'onlyLoadAppFromAsar',
        expected: expectedConfig.onlyLoadAppFromAsar,
      },
      {
        key: 'enableEmbeddedAsarIntegrityValidation',
        expected: expectedConfig.enableEmbeddedAsarIntegrityValidation,
      },
    ];

    let allValid = true;
    for (const check of criticalChecks) {
      if (actualFuses[check.key] !== check.expected) {
        console.error(
          `❌ Fuse验证失败: ${check.key} = ${actualFuses[check.key]}, 期望 = ${check.expected}`
        );
        allValid = false;
      }
    }

    if (allValid) {
      console.log('✅ 所有 Electron Fuses 配置验证成功');
    } else {
      console.error('❌ Electron Fuses 配置验证失败');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 无法验证 Electron Fuses 配置:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const isProduction =
    process.argv.includes('--production') ||
    process.env.NODE_ENV === 'production';
  applyFusesConfig(isProduction);
}

module.exports = {
  PRODUCTION_FUSES_CONFIG,
  DEVELOPMENT_FUSES_CONFIG,
  applyFusesConfig,
  verifyFusesConfig,
};

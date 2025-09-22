#!/usr/bin/env node

/**
 * 代码覆盖率配置管理
 * 支持不同环境的灵活覆盖率阈值
 */

/**
 * 不同环境的覆盖率阈值配置
 */
const COVERAGE_CONFIGS = {
  // Production - Temporary reduced thresholds (TODO: restore to 90% in 2 weeks)
  production: {
    statements: 60,
    branches: 60,
    functions: 60,
    lines: 60,
    description:
      'Production temporary thresholds (60% - TODO: restore to 90% after 2 weeks)',
  },

  // Staging - Semi-strict thresholds
  staging: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
    description: 'Staging environment thresholds',
  },

  // Development - Flexible thresholds (gradual improvement)
  development: {
    statements: 60,
    branches: 60,
    functions: 60,
    lines: 60,
    description: 'Development baseline thresholds',
  },

  // Bootstrap - Most flexible thresholds
  bootstrap: {
    statements: 30,
    branches: 30,
    functions: 30,
    lines: 30,
    description: 'New project bootstrap mode',
  },

  // TDD - High requirement thresholds
  tdd: {
    statements: 95,
    branches: 95,
    functions: 95,
    lines: 95,
    description: 'TDD development high standards',
  },
};

/**
 * 获取当前环境的覆盖率配置
 */
function getCoverageConfig() {
  const environment = process.env.NODE_ENV || 'development';
  let coverageMode = process.env.COVERAGE_MODE || '';

  // 在 GitHub 场景下：
  // - PR 一律按 development（60%）
  // - 非 main 分支一律按 development（60%）
  if (process.env.GITHUB_ACTIONS) {
    const event = process.env.GITHUB_EVENT_NAME || '';
    const ref = process.env.GITHUB_REF || '';
    const isPR = event === 'pull_request';
    const isMain = ref === 'refs/heads/main';
    if (isPR || !isMain) {
      coverageMode = 'development';
    }
  } else if (!coverageMode) {
    // 本地缺省时，退回 development
    coverageMode = 'development';
  }

  // 优先使用 COVERAGE_MODE，然后是 NODE_ENV
  const configKey = COVERAGE_CONFIGS[coverageMode] ? coverageMode : environment;
  const config = COVERAGE_CONFIGS[configKey] || COVERAGE_CONFIGS.development;

  console.log(`📊 使用覆盖率配置: ${configKey} (${config.description})`);

  return {
    ...config,
    environment: configKey,
  };
}

/**
 * 检查是否应该跳过覆盖率门禁
 */
function shouldSkipCoverageGate() {
  const skipReasons = [];

  // 检查环境变量
  if (process.env.SKIP_COVERAGE === 'true') {
    skipReasons.push('SKIP_COVERAGE环境变量设置为true');
  }

  // 检查CI环境中的特殊情况
  if (process.env.CI && process.env.GITHUB_EVENT_NAME === 'pull_request') {
    const prTitle = process.env.GITHUB_HEAD_REF || '';
    if (prTitle.includes('[skip-coverage]') || prTitle.includes('[WIP]')) {
      skipReasons.push('PR标题包含跳过覆盖率标记');
    }
  }

  // 检查是否是依赖更新PR
  if (process.env.GITHUB_ACTOR === 'dependabot[bot]') {
    skipReasons.push('Dependabot自动PR');
  }

  return skipReasons;
}

const fs = require('fs');
const path = require('path');

/**
 * 根据项目状态推荐覆盖率模式
 */
function recommendCoverageMode() {
  const projectRoot = path.join(__dirname, '..', '..');
  const testFiles = [];

  // 递归搜索测试文件
  function findTestFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (
        stat.isDirectory() &&
        !['node_modules', 'dist', 'coverage'].includes(file)
      ) {
        findTestFiles(fullPath);
      } else if (file.match(/\.(test|spec)\.(js|ts|tsx)$/)) {
        testFiles.push(fullPath);
      }
    });
  }

  try {
    findTestFiles(path.join(projectRoot, 'src'));
  } catch (error) {
    // 忽略文件系统错误
  }

  const testFileCount = testFiles.length;

  if (testFileCount === 0) {
    return {
      mode: 'bootstrap',
      reason: '未发现测试文件，建议使用新项目模式',
    };
  } else if (testFileCount < 5) {
    return {
      mode: 'development',
      reason: `发现${testFileCount}个测试文件，建议使用开发模式`,
    };
  } else if (testFileCount < 20) {
    return {
      mode: 'staging',
      reason: `发现${testFileCount}个测试文件，建议使用预发布模式`,
    };
  } else {
    return {
      mode: 'production',
      reason: `发现${testFileCount}个测试文件，建议使用生产模式`,
    };
  }
}

/**
 * 生成覆盖率配置信息
 */
function printCoverageInfo() {
  const config = getCoverageConfig();
  const skipReasons = shouldSkipCoverageGate();
  const recommendation = recommendCoverageMode();

  console.log('\n📊 覆盖率配置信息:');
  console.log(`当前模式: ${config.environment}`);
  console.log(`阈值设置: ${config.statements}%`);
  console.log(`描述: ${config.description}`);

  if (recommendation.mode !== config.environment) {
    console.log(`\n💡 推荐模式: ${recommendation.mode}`);
    console.log(`推荐理由: ${recommendation.reason}`);
    console.log(`设置方法: export COVERAGE_MODE=${recommendation.mode}`);
  }

  if (skipReasons.length > 0) {
    console.log('\n⚠️  覆盖率门禁将被跳过:');
    skipReasons.forEach(reason => console.log(`  - ${reason}`));
  }

  console.log('\n🔧 可用的覆盖率模式:');
  Object.keys(COVERAGE_CONFIGS).forEach(mode => {
    const modeConfig = COVERAGE_CONFIGS[mode];
    console.log(
      `  ${mode}: ${modeConfig.statements}% (${modeConfig.description})`
    );
  });
}

// 主执行逻辑
if (require.main === module) {
  printCoverageInfo();
}

module.exports = {
  getCoverageConfig,
  shouldSkipCoverageGate,
  recommendCoverageMode,
  COVERAGE_CONFIGS,
};

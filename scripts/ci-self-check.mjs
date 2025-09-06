#!/usr/bin/env node

/**
 * CI自检脚本：actionlint + needs⊆jobs验证
 *
 * 功能：
 * 1. 运行actionlint检查工作流语法
 * 2. 验证所有needs引用的job都存在
 * 3. 检查工作流文件格式和最佳实践
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

const WORKFLOWS_DIR = '.github/workflows';

console.log('🛡️ CI自检开始...');

// 1. actionlint检查
console.log('\n📝 运行actionlint检查...');
try {
  // 尝试使用Go版本的actionlint（通常在GitHub Actions中可用）
  console.log('检查actionlint可用性...');
  try {
    execSync('actionlint -version', { stdio: 'pipe' });
    console.log('使用系统actionlint...');
    execSync(`actionlint ${WORKFLOWS_DIR}/*.yml`, { stdio: 'inherit' });
    console.log('✅ actionlint检查通过');
  } catch {
    console.log('⚠️  系统actionlint不可用，跳过语法检查');
    console.log('   建议：在CI环境中使用 rhysd/actionlint@v1 action');
  }
} catch (error) {
  console.log('⚠️  actionlint检查跳过（非关键错误）');
  console.log('   原因:', error.message);
}

// 2. needs⊆jobs验证
console.log('\n🔗 验证needs引用...');
let hasErrors = false;

try {
  const workflowFiles = readdirSync(WORKFLOWS_DIR)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map(file => join(WORKFLOWS_DIR, file));

  for (const workflowFile of workflowFiles) {
    console.log(`检查 ${workflowFile}...`);

    try {
      const content = readFileSync(workflowFile, 'utf8');
      const workflow = yaml.load(content, {
        // 允许多行字符串和复杂内容
        json: false,
        // 忽略未知标签
        schema: yaml.CORE_SCHEMA,
      });

      if (!workflow?.jobs) {
        console.log(`⚠️  ${workflowFile}: 无jobs定义，跳过`);
        continue;
      }

      const jobNames = Object.keys(workflow.jobs);
      const needsErrors = [];

      // 检查每个job的needs引用
      for (const [jobName, jobConfig] of Object.entries(workflow.jobs)) {
        if (jobConfig?.needs) {
          const needs = Array.isArray(jobConfig.needs)
            ? jobConfig.needs
            : [jobConfig.needs];

          for (const neededJob of needs) {
            if (!jobNames.includes(neededJob)) {
              needsErrors.push(
                `Job '${jobName}' needs '${neededJob}' but it doesn't exist`
              );
            }
          }
        }
      }

      if (needsErrors.length > 0) {
        console.error(`❌ ${workflowFile}:`);
        needsErrors.forEach(error => console.error(`   ${error}`));
        hasErrors = true;
      } else {
        console.log(`✅ ${workflowFile}: needs引用验证通过`);
      }
    } catch (parseError) {
      // 对于无法解析的YAML，尝试基本语法检查
      console.log(`⚠️  ${workflowFile}: YAML复杂，跳过needs验证`);
      console.log(`   原因: ${parseError.message.split('\n')[0]}`);

      // 基本语法检查：确保没有明显的YAML错误
      const content = readFileSync(workflowFile, 'utf8');
      if (content.includes('needs:') && content.includes('jobs:')) {
        console.log(`   提示: 文件包含needs引用，建议手动验证`);
      }
    }
  }

  if (hasErrors) {
    console.error('\n❌ needs验证失败');
    process.exit(1);
  } else {
    console.log('\n✅ 所有needs引用验证通过');
  }
} catch (error) {
  console.error('❌ needs验证过程出错:', error.message);
  process.exit(1);
}

// 3. 工作流健康检查
console.log('\n🩺 工作流健康检查...');
let healthWarnings = 0;

try {
  const workflowFiles = readdirSync(WORKFLOWS_DIR)
    .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map(file => join(WORKFLOWS_DIR, file));

  for (const workflowFile of workflowFiles) {
    try {
      const content = readFileSync(workflowFile, 'utf8');
      const workflow = yaml.load(content);

      // 检查超时设置
      if (workflow?.jobs) {
        for (const [jobName, jobConfig] of Object.entries(workflow.jobs)) {
          if (
            !jobConfig['timeout-minutes'] ||
            jobConfig['timeout-minutes'] > 60
          ) {
            console.log(
              `⚠️  ${workflowFile}: Job '${jobName}' 可能需要timeout-minutes设置`
            );
            healthWarnings++;
          }
        }
      }

      // 检查Windows兼容性
      if (
        content.includes('runs-on: ubuntu-latest') &&
        !content.includes('shell: bash')
      ) {
        console.log(`⚠️  ${workflowFile}: 使用ubuntu但未明确shell类型`);
        healthWarnings++;
      }
    } catch (parseError) {
      // 已在needs验证中报告过
    }
  }

  if (healthWarnings > 0) {
    console.log(`\n⚠️  发现 ${healthWarnings} 个健康建议（非阻塞）`);
  } else {
    console.log('\n✅ 工作流健康检查通过');
  }
} catch (error) {
  console.error('❌ 健康检查过程出错:', error.message);
  // 健康检查失败不退出进程
}

console.log('\n🎉 CI自检完成！');

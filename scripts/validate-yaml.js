#!/usr/bin/env node
import fs from 'fs';
import yaml from 'js-yaml';

const workflowFiles = [
  '.github/workflows/soft-gates.yml',
  '.github/workflows/security-unified.yml',
  '.github/workflows/observability-gate.yml',
];

console.log('🔍 验证GitHub Actions工作流YAML语法...\n');

let allValid = true;

for (const file of workflowFiles) {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      yaml.load(content);
      console.log(`✅ ${file} - YAML语法正确`);
    } else {
      console.log(`⚠️  ${file} - 文件不存在`);
    }
  } catch (error) {
    console.log(`❌ ${file} - YAML语法错误:`, error.message);
    allValid = false;
  }
}

console.log(
  '\n' + (allValid ? '✅ 所有工作流YAML语法验证通过' : '❌ 发现YAML语法错误')
);
process.exit(allValid ? 0 : 1);

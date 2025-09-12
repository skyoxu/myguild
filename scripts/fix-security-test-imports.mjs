#!/usr/bin/env node
/**
 * 批量修复安全测试文件的Electron启动模式
 * 统一使用helpers/launch.ts而不是直接调用electron.launch
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const securityTestFiles = [
  'tests/e2e/security/redlines-simple.spec.ts',
  'tests/e2e/security/enhanced/enhanced-electron-security.spec.ts',
  'tests/e2e/security/enhanced/enhanced-csp-security.spec.ts',
  'tests/e2e/security/electron-security.spec.ts',
];

console.log(`修复 ${securityTestFiles.length} 个安全测试文件`);

let fixedCount = 0;

for (const file of securityTestFiles) {
  try {
    let content = readFileSync(file, 'utf8');

    if (
      content.includes('_electron as electron') &&
      content.includes('electron.launch')
    ) {
      console.log(`修复文件: ${file}`);

      // 替换导入
      content = content.replace(
        /import\s*\{[^}]*_electron as electron[^}]*\}\s*from\s*'@playwright\/test';/g,
        match => {
          return match
            .replace(/_electron as electron,?\s*/g, '')
            .replace(/,\s*\}/g, '}')
            .replace(/\{\s*,/g, '{');
        }
      );

      // 添加helpers导入
      if (!content.includes("from '../")) {
        content = content.replace(
          /import.*from '@playwright\/test';/,
          match => `${match}\nimport { launchApp } from '../../helpers/launch';`
        );
      }

      // 替换electron.launch调用
      content = content.replace(
        /electronApp\s*=\s*await\s+electron\.launch\(\{[^}]*\}\);/g,
        'electronApp = await launchApp();'
      );

      writeFileSync(file, content, 'utf8');
      fixedCount++;
    }
  } catch (error) {
    console.error(`修复文件 ${file} 时出错:`, error);
  }
}

console.log(`成功修复 ${fixedCount} 个安全测试文件`);

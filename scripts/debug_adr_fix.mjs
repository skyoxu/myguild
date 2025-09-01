#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRD_CHUNKS_DIR = path.join(PROJECT_ROOT, 'docs', 'prd_chunks');

console.log('=== ADR修复脚本调试 ===');
console.log('项目根目录:', PROJECT_ROOT);
console.log('PRD目录:', PRD_CHUNKS_DIR);

async function debugMain() {
  try {
    console.log('\n1. 检查目录存在性...');

    const dirExists = await fs
      .access(PRD_CHUNKS_DIR)
      .then(() => true)
      .catch(() => false);
    console.log('PRD目录存在:', dirExists);

    if (!dirExists) {
      console.error('PRD目录不存在!');
      return;
    }

    console.log('\n2. 列出PRD文件...');
    const files = await fs.readdir(PRD_CHUNKS_DIR);
    const prdFiles = files.filter(
      file =>
        file.startsWith('PRD-Guild-Manager_chunk_') && file.endsWith('.md')
    );
    console.log('找到PRD文件数量:', prdFiles.length);
    console.log(
      '文件列表:',
      prdFiles.slice(0, 5).map(f => f)
    );

    console.log('\n3. 测试读取单个文件...');
    const testFile = path.join(
      PRD_CHUNKS_DIR,
      'PRD-Guild-Manager_chunk_012.md'
    );
    const testFileExists = await fs
      .access(testFile)
      .then(() => true)
      .catch(() => false);
    console.log('测试文件存在:', testFileExists);

    if (testFileExists) {
      const content = await fs.readFile(testFile, 'utf8');
      console.log('文件大小:', content.length, '字符');
      console.log('前100字符:', content.substring(0, 100));

      // 测试YAML解析
      const lines = content.split('\n');
      console.log('文件行数:', lines.length);
      console.log('第一行:', lines[0]);

      let endIndex = -1;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '---') {
          endIndex = i;
          break;
        }
      }
      console.log('YAML结束行:', endIndex);

      if (endIndex > 0) {
        const yamlLines = lines.slice(1, endIndex);
        console.log('YAML行数:', yamlLines.length);

        // 查找ADRs行
        const adrsLine = yamlLines.find(line =>
          line.trim().startsWith('ADRs:')
        );
        console.log('当前ADRs行:', adrsLine);
      }
    }

    console.log('\n4. 测试内容分析...');
    if (testFileExists) {
      const content = await fs.readFile(testFile, 'utf8');
      const contentLower = content.toLowerCase();

      // 测试关键词匹配
      const testKeywords = ['user-experience', 'UI', 'ActionType', 'interface'];
      for (const keyword of testKeywords) {
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi');
        const matches = content.match(regex) || [];
        console.log(`关键词 "${keyword}" 出现次数:`, matches.length);
      }
    }

    console.log('\n=== 调试完成 ===');
  } catch (error) {
    console.error('调试过程出错:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

debugMain();

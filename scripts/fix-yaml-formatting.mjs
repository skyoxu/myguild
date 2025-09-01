/**
 * YAML格式修正脚本
 * 修正docs目录中带数字编号文件的YAML格式问题
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class YAMLFormatter {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.targetDirectories = [
      'docs/adr',
      'docs/prd_chunks',
      'docs/architecture/base',
    ];
    this.fixedFiles = [];
    this.errors = [];
  }

  /**
   * 执行批量格式修正
   */
  async fixAllFiles() {
    console.log('🔧 开始YAML格式修正...\n');

    for (const dir of this.targetDirectories) {
      await this.processDirectory(dir);
    }

    this.displayResults();
  }

  /**
   * 处理单个目录
   */
  async processDirectory(dirPath) {
    const fullDirPath = path.join(this.projectRoot, dirPath);

    if (!fs.existsSync(fullDirPath)) {
      console.log(`⚠️  目录不存在: ${dirPath}`);
      return;
    }

    console.log(`📁 处理目录: ${dirPath}`);

    const files = fs
      .readdirSync(fullDirPath)
      .filter(file => file.endsWith('.md'))
      .filter(file => this.hasNumberPrefix(file));

    for (const file of files) {
      const filePath = path.join(fullDirPath, file);
      await this.processFile(filePath, `${dirPath}/${file}`);
    }
  }

  /**
   * 检查文件是否有数字前缀
   */
  hasNumberPrefix(filename) {
    // 匹配 ADR-0001, 01-, PRD-Guild-Manager_chunk_001 等模式
    return /^(ADR-\d+|^\d+-|.*_chunk_\d+|.*_\d+\.md$)/.test(filename);
  }

  /**
   * 处理单个文件
   */
  async processFile(filePath, relativePath) {
    try {
      const originalContent = fs.readFileSync(filePath, 'utf8');
      const fixedContent = this.fixYAMLFormatting(originalContent);

      if (originalContent !== fixedContent) {
        fs.writeFileSync(filePath, fixedContent, 'utf8');
        this.fixedFiles.push(relativePath);
        console.log(`   ✅ 已修正: ${relativePath}`);
      } else {
        console.log(`   ✓  无需修正: ${relativePath}`);
      }
    } catch (error) {
      this.errors.push({ file: relativePath, error: error.message });
      console.log(`   ❌ 处理失败: ${relativePath} - ${error.message}`);
    }
  }

  /**
   * 修正YAML格式
   */
  fixYAMLFormatting(content) {
    let lines = content.split('\n');
    let inFrontMatter = false;
    let frontMatterStart = -1;
    let frontMatterEnd = -1;
    let fixed = false;

    // 1. 找到front-matter范围
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (!inFrontMatter) {
          frontMatterStart = i;
          inFrontMatter = true;
        } else {
          frontMatterEnd = i;
          break;
        }
      }
    }

    // 确保front-matter从第一行开始
    if (frontMatterStart > 0) {
      // 将front-matter移到开头
      const beforeFrontMatter = lines.slice(0, frontMatterStart);
      const frontMatter = lines.slice(frontMatterStart, frontMatterEnd + 1);
      const afterFrontMatter = lines.slice(frontMatterEnd + 1);

      lines = [''].concat(frontMatter, beforeFrontMatter, afterFrontMatter);
      frontMatterStart = 1;
      frontMatterEnd = frontMatter.length;
      fixed = true;
    }

    // 2. 修正front-matter内的格式问题
    if (frontMatterStart >= 0 && frontMatterEnd >= 0) {
      for (let i = frontMatterStart + 1; i < frontMatterEnd; i++) {
        let line = lines[i];
        const originalLine = line;

        // 移除Tab字符，替换为2个空格
        line = line.replace(/\t/g, '  ');

        // 修正冒号后缺少空格的问题
        line = line.replace(/([^:\s]):([^\s])/g, '$1: $2');

        // 修正YAML列表格式 - 保持现有格式，确保一致性
        // 如果是行内格式 [item1, item2]，保持不变
        // 如果是多行格式，确保正确缩进

        if (line !== originalLine) {
          lines[i] = line;
          fixed = true;
        }
      }
    }

    // 3. 确保front-matter以 --- 结尾
    if (frontMatterEnd < 0 && frontMatterStart >= 0) {
      // 找到第一个空行或非YAML行作为结尾
      for (let i = frontMatterStart + 1; i < lines.length; i++) {
        if (
          lines[i].trim() === '' ||
          (!lines[i].startsWith(' ') &&
            !lines[i].includes(':') &&
            !lines[i].startsWith('-'))
        ) {
          lines.splice(i, 0, '---');
          fixed = true;
          break;
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * 显示处理结果
   */
  displayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 YAML格式修正结果');
    console.log('='.repeat(60));

    console.log(`✅ 修正的文件数: ${this.fixedFiles.length}`);
    console.log(`❌ 处理失败数: ${this.errors.length}`);

    if (this.fixedFiles.length > 0) {
      console.log('\n🔧 已修正的文件:');
      this.fixedFiles.forEach(file => {
        console.log(`   - ${file}`);
      });
    }

    if (this.errors.length > 0) {
      console.log('\n❌ 处理失败的文件:');
      this.errors.forEach(({ file, error }) => {
        console.log(`   - ${file}: ${error}`);
      });
    }

    console.log('\n🎉 YAML格式修正完成！');
  }
}

// 执行格式修正
const formatter = new YAMLFormatter();
await formatter.fixAllFiles();

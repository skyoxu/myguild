/**
 * YAML格式修正脚本 v2
 * 修正时间戳冒号处理问题，更精确的格式检测
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class YAMLFormatterV2 {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.targetDirectories = [
      'docs/prd_chunks', // 重点修正这个目录
    ];
    this.fixedFiles = [];
    this.errors = [];
  }

  /**
   * 执行批量格式修正
   */
  async fixAllFiles() {
    console.log('🔧 开始YAML格式修正 v2...\n');

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
    return /.*_chunk_\d+/.test(filename);
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
    const lines = content.split('\n');
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

    // 2. 修正front-matter内的格式问题
    if (frontMatterStart >= 0 && frontMatterEnd >= 0) {
      for (let i = frontMatterStart + 1; i < frontMatterEnd; i++) {
        let line = lines[i];
        const originalLine = line;

        // 移除Tab字符，替换为2个空格
        line = line.replace(/\t/g, '  ');

        // 修正YAML键值对冒号后缺少空格的问题
        // 只处理行首的键值对，不处理字符串内容
        // 改进的正则：匹配行首（可能有缩进）的键名，然后是冒号，然后不是空格的字符
        line = line.replace(/^(\s*)([^:\s]+):\s*([^\s])/g, '$1$2: $3');

        // 特殊处理：如果冒号后面是引号开始的字符串，需要确保格式正确
        line = line.replace(
          /^(\s*)([^:\s]+):\s*"([^"]*)"(\s*)$/g,
          '$1$2: "$3"'
        );

        // 修正时间戳格式 - 将错误添加的空格移除
        line = line.replace(/T(\d{2}): (\d{2}): (\d{2})Z/g, 'T$1:$2:$3Z');

        if (line !== originalLine) {
          lines[i] = line;
          fixed = true;
        }
      }
    }

    // 3. 如果没有找到front-matter结束标记，添加一个
    if (frontMatterStart >= 0 && frontMatterEnd < 0) {
      // 查找第一个不是YAML格式的行
      for (let i = frontMatterStart + 1; i < lines.length; i++) {
        const line = lines[i].trim();

        // 如果是空行、注释或者明显的markdown内容，在此前添加---
        if (line === '' || line.startsWith('#') || line.startsWith('<!--')) {
          lines.splice(i, 0, '---');
          fixed = true;
          break;
        }

        // 如果是明显不是YAML的内容
        if (
          line &&
          !line.includes(':') &&
          !line.startsWith('-') &&
          !line.match(/^\s/)
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
    console.log('📊 YAML格式修正结果 v2');
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
const formatter = new YAMLFormatterV2();
await formatter.fixAllFiles();

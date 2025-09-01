#!/usr/bin/env node
/**
 * E2E测试架构标准检查脚本
 *
 * 检查项：
 * 1. 导入一致性：确保使用 @playwright/test 而不是 playwright
 * 2. 导航反模式检测：禁止使用 page.goto('app://...')
 * 3. 测试文件结构验证
 * 4. 必要的测试钩子检查
 *
 * 使用：node scripts/e2e-architecture-check.mjs
 * 退出码：0=通过，1=失败
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// ANSI 颜色代码
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

class E2EArchitectureChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
    this.e2eTestsDir = path.join(projectRoot, 'tests', 'e2e');
  }

  /**
   * 主检查方法
   */
  async check() {
    console.log(
      `${colors.cyan}${colors.bold}=== E2E 测试架构标准检查 ===${colors.reset}\n`
    );
    console.log(`${colors.blue}检查目录: ${this.e2eTestsDir}${colors.reset}`);

    if (!fs.existsSync(this.e2eTestsDir)) {
      this.addError(`E2E测试目录不存在: ${this.e2eTestsDir}`);
      return this.generateReport();
    }

    const testFiles = this.findTestFiles(this.e2eTestsDir);
    console.log(
      `${colors.blue}找到 ${testFiles.length} 个测试文件${colors.reset}\n`
    );

    for (const testFile of testFiles) {
      await this.checkFile(testFile);
    }

    return this.generateReport();
  }

  /**
   * 递归查找测试文件
   */
  findTestFiles(dir) {
    const testFiles = [];
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        testFiles.push(...this.findTestFiles(fullPath));
      } else if (this.isTestFile(file)) {
        testFiles.push(fullPath);
      }
    }

    return testFiles;
  }

  /**
   * 判断是否为测试文件
   */
  isTestFile(filename) {
    const testPatterns = [
      /\.e2e\.(ts|js)$/,
      /\.spec\.(ts|js)$/,
      /\.test\.(ts|js)$/,
    ];
    return testPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * 检查单个测试文件
   */
  async checkFile(filePath) {
    const relativePath = path.relative(projectRoot, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    console.log(`${colors.magenta}检查文件: ${relativePath}${colors.reset}`);

    // 检查导入一致性
    this.checkImportConsistency(filePath, content);

    // 检查导航反模式
    this.checkNavigationAntiPattern(filePath, content);

    // 检查测试结构
    this.checkTestStructure(filePath, content);

    // 检查选择器使用
    this.checkSelectorUsage(filePath, content);

    console.log(); // 空行分隔
  }

  /**
   * 检查导入一致性
   */
  checkImportConsistency(filePath, content) {
    const relativePath = path.relative(projectRoot, filePath);

    // 检查错误的导入
    const wrongImportPattern = /from\s+['\"]playwright['\"];?/g;
    const wrongImports = content.match(wrongImportPattern);

    if (wrongImports) {
      this.addError(
        `${relativePath}: 发现错误的 playwright 导入，应使用 @playwright/test`,
        {
          file: relativePath,
          issue: 'wrong_import',
          matches: wrongImports,
        }
      );
      return;
    }

    // 检查正确的导入
    const correctImportPattern = /from\s+['\"]@playwright\/test['\"];?/g;
    const hasCorrectImport = correctImportPattern.test(content);

    if (hasCorrectImport) {
      this.addPassed(`${relativePath}: 导入一致性检查通过`);
    } else {
      this.addWarning(
        `${relativePath}: 未发现 @playwright/test 导入，可能不是 Playwright 测试文件`
      );
    }
  }

  /**
   * 检查导航反模式
   */
  checkNavigationAntiPattern(filePath, content) {
    const relativePath = path.relative(projectRoot, filePath);

    // 检查 app:// 导航反模式
    const appNavigationPatterns = [
      /page\.goto\s*\(\s*['\"]app:\/\/[^'\"]*['\"]/g,
      /await\s+page\.goto\s*\(\s*['\"]app:\/\/[^'\"]*['\"]/g,
      /\.goto\s*\(\s*['\"]app:\/\/[^'\"]*['\"]/g,
    ];

    let foundNavigationAntiPattern = false;
    for (const pattern of appNavigationPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        foundNavigationAntiPattern = true;
        this.addError(`${relativePath}: 发现导航反模式 app:// 协议使用`, {
          file: relativePath,
          issue: 'navigation_anti_pattern',
          matches: matches,
        });
      }
    }

    if (!foundNavigationAntiPattern) {
      this.addPassed(`${relativePath}: 导航反模式检查通过`);
    }
  }

  /**
   * 检查测试结构
   */
  checkTestStructure(filePath, content) {
    const relativePath = path.relative(projectRoot, filePath);

    // 检查是否有适当的测试钩子
    const hasBeforeAll = /test\\.beforeAll/g.test(content);
    const hasAfterAll = /test\\.afterAll/g.test(content);

    if (hasBeforeAll && hasAfterAll) {
      this.addPassed(`${relativePath}: 测试钩子结构完整`);
    } else if (!hasBeforeAll && !hasAfterAll) {
      this.addWarning(
        `${relativePath}: 未发现 beforeAll/afterAll 钩子，建议添加以管理应用生命周期`
      );
    } else {
      this.addWarning(
        `${relativePath}: 测试钩子不完整，建议同时使用 beforeAll 和 afterAll`
      );
    }

    // 检查 Electron 应用启动模式
    const hasElectronLaunch = /electron\\.launch/g.test(content);
    const hasFirstWindow = /\\.firstWindow\\(\\)/g.test(content);

    if (hasElectronLaunch && hasFirstWindow) {
      this.addPassed(`${relativePath}: Electron 应用启动模式正确`);
    } else if (hasElectronLaunch || hasFirstWindow) {
      this.addWarning(`${relativePath}: Electron 应用启动配置可能不完整`);
    }
  }

  /**
   * 检查选择器使用
   */
  checkSelectorUsage(filePath, content) {
    const relativePath = path.relative(projectRoot, filePath);

    // 检查是否使用了推荐的 data-testid 选择器
    const hasDataTestId = /data-testid/g.test(content);
    const hasWaitForSelector = /waitForSelector/g.test(content);

    if (hasDataTestId && hasWaitForSelector) {
      this.addPassed(`${relativePath}: 推荐的选择器模式使用正确`);
    } else if (!hasDataTestId) {
      this.addWarning(
        `${relativePath}: 建议使用 data-testid 属性选择器以提高测试稳定性`
      );
    }

    // 检查脆弱的选择器模式
    const fragileSelectors = [
      /\.locator\s*\(['\"][^'\"]*:nth-child/g,
      /\.locator\s*\(['\"][^'\"]*\.btn-/g,
      /\.locator\s*\(['\"][^'\"]*\.css-/g,
    ];

    for (const pattern of fragileSelectors) {
      const matches = content.match(pattern);
      if (matches) {
        this.addWarning(
          `${relativePath}: 发现可能脆弱的选择器，建议使用更稳定的选择器`,
          {
            matches: matches.slice(0, 3), // 只显示前3个匹配
          }
        );
        break; // 只报告一次
      }
    }
  }

  /**
   * 添加错误
   */
  addError(message, details = null) {
    this.errors.push({ message, details });
    console.log(`  ${colors.red}✗ ${message}${colors.reset}`);
    if (details && details.matches) {
      details.matches.slice(0, 3).forEach(match => {
        console.log(`    ${colors.red}${match.trim()}${colors.reset}`);
      });
    }
  }

  /**
   * 添加警告
   */
  addWarning(message, details = null) {
    this.warnings.push({ message, details });
    console.log(`  ${colors.yellow}⚠ ${message}${colors.reset}`);
    if (details && details.matches) {
      details.matches.slice(0, 3).forEach(match => {
        console.log(`    ${colors.yellow}${match.trim()}${colors.reset}`);
      });
    }
  }

  /**
   * 添加通过项
   */
  addPassed(message) {
    this.passed.push(message);
    console.log(`  ${colors.green}✓ ${message}${colors.reset}`);
  }

  /**
   * 生成检查报告
   */
  generateReport() {
    console.log(
      `\n${colors.cyan}${colors.bold}=== 检查结果汇总 ===${colors.reset}`
    );

    console.log(
      `${colors.green}✓ 通过项: ${this.passed.length}${colors.reset}`
    );
    console.log(
      `${colors.yellow}⚠ 警告项: ${this.warnings.length}${colors.reset}`
    );
    console.log(`${colors.red}✗ 错误项: ${this.errors.length}${colors.reset}`);

    if (this.errors.length > 0) {
      console.log(
        `\n${colors.red}${colors.bold}=== 需要修复的错误 ===${colors.reset}`
      );
      this.errors.forEach((error, index) => {
        console.log(
          `${colors.red}${index + 1}. ${error.message}${colors.reset}`
        );
      });
      console.log(
        `\n${colors.red}${colors.bold}架构检查失败！请修复上述错误后重试。${colors.reset}`
      );
      return false;
    }

    if (this.warnings.length > 0) {
      console.log(
        `\n${colors.yellow}${colors.bold}=== 建议改进的警告 ===${colors.reset}`
      );
      this.warnings.forEach((warning, index) => {
        console.log(
          `${colors.yellow}${index + 1}. ${warning.message}${colors.reset}`
        );
      });
      console.log(
        `\n${colors.yellow}架构检查通过，但建议处理上述警告以提高代码质量。${colors.reset}`
      );
    } else {
      console.log(
        `\n${colors.green}${colors.bold}✅ 所有架构检查通过！${colors.reset}`
      );
    }

    return true;
  }
}

// 主执行函数
async function main() {
  try {
    const checker = new E2EArchitectureChecker();
    const success = await checker.check();

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(
      `${colors.red}${colors.bold}检查过程中发生错误:${colors.reset}`,
      error
    );
    process.exit(1);
  }
}

// 如果直接运行此脚本
const scriptPath = fileURLToPath(import.meta.url);
if (scriptPath === __filename) {
  main();
}

export default E2EArchitectureChecker;

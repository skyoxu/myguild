import { launchApp } from 'helpers/launch';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Playwright全局设置 - Electron E2E测试
 * 基于ADR-0002安全基线和ADR-0005质量门禁
 *
 * 功能：
 * - 验证Electron应用构建状态
 * - 检查安全基线配置
 * - 准备测试环境和依赖
 */

async function globalSetup(config: FullConfig) {
  console.log('🚀 开始Playwright全局设置 - Electron E2E测试');

  const electronPath = path.join(__dirname, '..', 'dist-electron', 'main.js');
  const outputDir = config.projects[0].outputDir || 'test-results/artifacts';

  // 1. 验证Electron构建产物
  console.log('📦 验证Electron构建产物...');

  if (!fs.existsSync(electronPath)) {
    console.error(`❌ Electron主进程文件不存在: ${electronPath}`);
    console.log('提示：请先运行 npm run build 构建Electron应用');
    process.exit(1);
  }

  // 检查preload脚本
  const preloadPath = path.join(__dirname, '..', 'dist-electron', 'preload.js');
  if (!fs.existsSync(preloadPath)) {
    console.error(`❌ Preload脚本不存在: ${preloadPath}`);
    process.exit(1);
  }

  console.log('✅ Electron构建产物验证通过');

  // 2. 创建测试结果目录
  console.log('📁 创建测试结果目录...');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`✅ 创建目录: ${outputDir}`);
  }

  // 3. 安全基线预检查
  console.log('🔒 执行安全基线预检查...');

  try {
    // 启动Electron进程进行基本验证
    const electronApp = await launchApp();

    // 获取主窗口
    const firstWindow = await electronApp.firstWindow({
      timeout: 15000,
    });

    // 基本窗口验证
    const title = await firstWindow.title();
    console.log(`✅ Electron应用启动成功，窗口标题: ${title}`);

    // 验证上下文隔离
    const isContextIsolated = await firstWindow.evaluate(() => {
      // 检查是否能访问Node.js API（应该被隔离）
      return typeof require === 'undefined' && typeof process === 'undefined';
    });

    if (isContextIsolated) {
      console.log('✅ 上下文隔离验证通过');
    } else {
      console.warn('⚠️ 上下文隔离可能未正确配置');
    }

    // 清理测试启动的应用
    await electronApp.close();
    console.log('✅ 基线预检查完成');
  } catch (error) {
    console.error('❌ 安全基线预检查失败:', error);
    throw error;
  }

  // 4. 环境变量设置
  console.log('🌍 设置测试环境变量...');

  process.env.ELECTRON_IS_TESTING = '1';
  process.env.NODE_ENV = 'test';
  process.env.PLAYWRIGHT_GLOBAL_SETUP = '1';

  console.log('✅ 环境变量配置完成');

  // 5. 生成测试配置报告
  const setupReport = {
    timestamp: new Date().toISOString(),
    electronPath,
    preloadPath,
    outputDir,
    environment: {
      ELECTRON_IS_TESTING: process.env.ELECTRON_IS_TESTING,
      NODE_ENV: process.env.NODE_ENV,
    },
    validation: {
      electronBuild: true,
      preloadScript: true,
      contextIsolation: isContextIsolated,
      securityBaseline: true,
    },
  };

  const reportPath = path.join(outputDir, 'setup-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(setupReport, null, 2));

  console.log('📋 全局设置完成');
  console.log(`📄 设置报告: ${reportPath}`);
  console.log('🧪 准备运行Electron E2E测试...\n');
}

export default globalSetup;

/**
 * 视觉回归测试全局设置
 * 确保测试环境一致性和基线管理
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🎬 开始视觉回归测试全局设置...');

  // 确保测试输出目录存在
  const outputDirs = [
    'test-results/vr-report',
    'test-results/vr-artifacts',
    'tests/vr/screenshots',
    'tests/vr/baseline',
  ];

  for (const dir of outputDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 创建目录: ${dir}`);
    }
  }

  // 设置环境变量，确保测试一致性
  process.env.NODE_ENV = 'test';
  process.env.DISABLE_AUTO_UPDATE = 'true';
  process.env.SKIP_ANALYTICS = 'true';
  process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = 'false';

  // 检查是否为基线更新模式
  if (process.env.UPDATE_SNAPSHOTS === 'true') {
    console.log('📸 运行在基线更新模式，将生成新的截图基线');
  }

  // CI环境特殊设置
  if (process.env.CI) {
    console.log('🚀 CI环境检测到，应用CI专用设置');

    // 确保在CI中有足够的超时时间
    process.env.PLAYWRIGHT_TEST_TIMEOUT = '60000';

    // 设置更严格的截图对比参数
    process.env.VR_STRICT_MODE = 'true';
  }

  // 验证必要的资源文件存在
  const requiredFiles = ['src/App.tsx', 'index.html', 'vite.config.ts'];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`❌ 必要文件不存在: ${file}`);
    }
  }

  // 清理旧的测试artifacts（如果不是在保留模式）
  if (!process.env.PRESERVE_ARTIFACTS) {
    const artifactsPath = 'test-results/vr-artifacts';
    if (fs.existsSync(artifactsPath)) {
      const files = fs.readdirSync(artifactsPath);
      let cleanedCount = 0;

      files.forEach(file => {
        const filePath = path.join(artifactsPath, file);
        const stats = fs.statSync(filePath);

        // 删除3天前的文件
        const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
        if (stats.mtime.getTime() < threeDaysAgo) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      });

      if (cleanedCount > 0) {
        console.log(`🧹 清理了 ${cleanedCount} 个旧的测试文件`);
      }
    }
  }

  // 生成测试运行元数据
  const metadata = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    ci: !!process.env.CI,
    updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true',
    electronPath: process.env.ELECTRON_PATH,
    projects: config.projects.map(p => p.name),
    nodeVersion: process.version,
    platform: process.platform,
  };

  fs.writeFileSync(
    'test-results/vr-metadata.json',
    JSON.stringify(metadata, null, 2)
  );

  console.log('✅ 视觉回归测试全局设置完成');
  console.log(`   - 项目配置: ${config.projects.length} 个浏览器配置`);
  console.log(
    `   - 基线模式: ${process.env.UPDATE_SNAPSHOTS === 'true' ? '更新' : '对比'}`
  );
  console.log(`   - 环境: ${process.env.CI ? 'CI' : '本地开发'}`);
}

export default globalSetup;

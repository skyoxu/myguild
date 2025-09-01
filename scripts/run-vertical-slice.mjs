#!/usr/bin/env node

/**
 * 竖切测试快速启动脚本
 * 自动启动应用并直接进入竖切测试模式
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🚀 启动竖切测试...');
console.log('==========================');

const mode = process.argv[2] || 'dev';

// 支持的启动模式
const startCommands = {
  dev: 'npm run dev',
  electron: 'npm run dev:electron',
  preview: 'npm run preview',
  build: 'npm run build && npm run preview',
};

const command = startCommands[mode];
if (!command) {
  console.error(`❌ 不支持的模式: ${mode}`);
  console.log('支持的模式:', Object.keys(startCommands).join(', '));
  process.exit(1);
}

console.log(`📦 启动模式: ${mode}`);
console.log(`📜 执行命令: ${command}`);
console.log('');

// 设置环境变量以自动启动竖切模式
process.env.VITE_VERTICAL_SLICE_AUTO = 'true';

// 启动开发服务器
const [cmd, ...args] = command.split(' ');
const child = spawn(cmd, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_VERTICAL_SLICE_AUTO: 'true',
  },
});

// 延迟显示访问信息
setTimeout(() => {
  console.log('\n🌐 访问地址:');
  console.log('├─ 竖切测试 (自动): http://localhost:5173?vertical-slice=auto');
  console.log('├─ 竖切测试 (手动): http://localhost:5173 → 点击竖切按钮');
  console.log('└─ 常规游戏: http://localhost:5173');
  console.log('');
  console.log('🔧 快速命令:');
  console.log('├─ npm run vertical-slice        # 启动竖切测试 (dev模式)');
  console.log('├─ npm run vertical-slice electron # Electron环境测试');
  console.log('└─ npm run vertical-slice preview  # 生产预览模式');
  console.log('');
  console.log('⏹️  停止服务: Ctrl+C');
}, 3000);

// 处理进程退出
child.on('close', code => {
  console.log(`\n🏁 服务已停止 (退出代码: ${code})`);
  process.exit(code);
});

child.on('error', error => {
  console.error('❌ 启动失败:', error);
  process.exit(1);
});

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n⏹️  正在停止服务...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  正在停止服务...');
  child.kill('SIGTERM');
});

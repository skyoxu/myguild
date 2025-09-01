#!/usr/bin/env node

/**
 * 竖切测试执行脚本
 * 支持单独运行竖切E2E测试或与其他测试集成
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const mode = process.argv[2] || 'test';
const options = process.argv.slice(3);

console.log('🧪 竖切测试执行器');
console.log('====================');

// 支持的测试模式
const testCommands = {
  // 单独运行竖切测试
  test: 'npx playwright test tests/e2e/vertical-slice.spec.ts',

  // 带调试模式运行
  debug: 'npx playwright test tests/e2e/vertical-slice.spec.ts --debug',

  // 带UI模式运行
  ui: 'npx playwright test tests/e2e/vertical-slice.spec.ts --ui',

  // 生成测试报告
  report: 'npx playwright show-report test-results/playwright-report',

  // 运行所有E2E测试（包含竖切）
  all: 'npx playwright test',

  // 只运行冒烟测试
  smoke: 'npx playwright test --project=electron-smoke-tests',

  // 构建后测试
  'build-test':
    'npm run build && npx playwright test tests/e2e/vertical-slice.spec.ts',
};

const command = testCommands[mode];
if (!command) {
  console.error(`❌ 不支持的测试模式: ${mode}`);
  console.log('支持的模式:');
  Object.keys(testCommands).forEach(key => {
    console.log(`  ${key} - ${testCommands[key]}`);
  });
  process.exit(1);
}

console.log(`📦 测试模式: ${mode}`);
console.log(`📜 执行命令: ${command}`);

// 添加额外参数
const fullCommand =
  options.length > 0 ? `${command} ${options.join(' ')}` : command;

console.log(`📜 完整命令: ${fullCommand}`);
console.log('');

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.CI = process.env.CI || 'false';
process.env.VITE_VERTICAL_SLICE_AUTO = 'false'; // E2E测试手动控制

// 特殊处理：构建后测试需要分步执行
if (mode === 'build-test') {
  console.log('🔨 首先执行构建...');
  const buildProcess = spawn('npm', ['run', 'build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
  });

  buildProcess.on('close', buildCode => {
    if (buildCode !== 0) {
      console.error('❌ 构建失败，退出测试');
      process.exit(buildCode);
    }

    console.log('✅ 构建完成，开始运行测试...');

    // 运行测试
    const testProcess = spawn(
      'npx',
      ['playwright', 'test', 'tests/e2e/vertical-slice.spec.ts'],
      {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
        },
      }
    );

    testProcess.on('close', testCode => {
      console.log(`\n🏁 测试完成 (退出代码: ${testCode})`);
      process.exit(testCode);
    });

    testProcess.on('error', error => {
      console.error('❌ 测试执行失败:', error);
      process.exit(1);
    });
  });

  buildProcess.on('error', error => {
    console.error('❌ 构建失败:', error);
    process.exit(1);
  });
} else {
  // 直接运行其他命令
  const [cmd, ...args] = fullCommand.split(' ');
  const testProcess = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
    },
  });

  testProcess.on('close', code => {
    console.log(`\n🏁 测试完成 (退出代码: ${code})`);

    // 测试完成后的提示信息
    if (code === 0) {
      console.log('');
      console.log('🎉 竖切测试通过！');
      console.log('📊 查看测试报告: npm run test:e2e:report');
      console.log('🚀 运行实际应用: npm run vertical-slice');
    } else {
      console.log('');
      console.log('❌ 测试失败，请检查错误信息');
      console.log('🐛 调试模式: node scripts/test-vertical-slice.mjs debug');
      console.log('📊 查看失败报告: npm run test:e2e:report');
    }

    process.exit(code);
  });

  testProcess.on('error', error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n⏹️ 正在停止测试...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️ 正在停止测试...');
  process.exit(0);
});

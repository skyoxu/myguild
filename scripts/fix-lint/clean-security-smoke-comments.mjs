import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('tests/e2e/security.smoke.spec.ts');
let raw = fs.readFileSync(file, 'utf8');

// 标准化：移除注释中的常见乱码占位符（�）
const lines = raw.split(/\r?\n/);
const out = [];
let inBlock = false;
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  const trimmed = line.trimStart();
  if (trimmed.startsWith('/*')) inBlock = true;
  if (inBlock || trimmed.startsWith('//')) {
    // 去除替换符与明显乱码占位
    line = line.replace(/\uFFFD+/g, '');
  }
  if (trimmed.endsWith('*/')) inBlock = false;
  out.push(line);
}

let content = out.join('\n');

// 在文件顶部追加简洁中文说明，避免原乱码破坏可读性
if (!/^\/\*\*\s*Electron 安全基线冒烟/.test(content)) {
  const header = `/**\r\n * Electron 安全基线冒烟（security.smoke）\r\n * - 验证：应用可见性、ContextBridge 暴露、IPC 基本调用、CSP 生效、导航/窗口拦截、违规上报与状态查询\r\n * - 仅在审计项目运行（PROJECT_NAME=electron-security-audit）时执行完整用例；否则以占位早退\r\n * 关联 ADR：ADR-0002（安全基线），ADR-0005（质量门禁）\r\n */\r\n`;
  content = header + content;
}

// 统一 CRLF 行尾
content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(file, content, { encoding: 'utf8' });

console.log('cleaned');

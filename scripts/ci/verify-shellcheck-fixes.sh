#!/usr/bin/env bash
set -euo pipefail

# 验证ShellCheck修复脚本
# 检查常见的SC2086和SC2034问题是否已修复

echo "==> 验证ShellCheck修复..."

# 1. 检查未引用的变量使用（SC2086）
echo "1. 检查未引用的GITHUB变量..."
if grep -r ">> \$GITHUB_OUTPUT\|>> \$GITHUB_STEP_SUMMARY" .github/workflows/ --include="*.yml" 2>/dev/null; then
    echo "❌ 发现未引用的GITHUB变量"
    exit 1
else
    echo "✅ GITHUB变量引用正确"
fi

# 2. 检查条件测试中的未引用变量
echo "2. 检查条件测试中的变量引用..."
if grep -r "\[ \$[A-Z_]" .github/workflows/ --include="*.yml" 2>/dev/null; then
    echo "❌ 发现条件测试中的未引用变量"
    exit 1
else
    echo "✅ 条件测试中的变量引用正确"
fi

# 3. 检查脚本文件中的变量引用
echo "3. 检查脚本文件中的变量引用..."
if grep -r ">> \$GITHUB_STEP_SUMMARY" scripts/ci/ --include="*.sh" 2>/dev/null; then
    echo "❌ 发现脚本中的未引用变量"
    exit 1
else
    echo "✅ 脚本中的变量引用正确"
fi

echo "✅ 所有ShellCheck修复验证通过！"
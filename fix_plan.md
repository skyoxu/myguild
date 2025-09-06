# GitHub Actions 修复方案

基于 actionlint 和 ShellCheck 错误分析，制定以下修复方案：

## 错误分析

### soft-gates.yml 错误

- **第4行**: SC2086 - $GITHUB_OUTPUT 需要双引号
- **第5行**: SC2086 - $GITHUB_OUTPUT 需要双引号
- **第14行**: SC2086 和 SC2129 - $GITHUB_STEP_SUMMARY 需要双引号和重定向优化

### 其他文件错误

- **security-unified.yml (Line 385)**: YAML 解析错误
- **release.yml (Line 107)**: SC2193 字符串比较错误
- **release-ramp.yml (Line 307)**: YAML 解析错误
- **release-emergency-rollback.yml (Line 295)**: YAML 解析错误
- **observability-gate.yml (Line 106)**: YAML 解析错误

## 修复策略

1. **SC2086 修复**: 所有 $GITHUB_OUTPUT 和 $GITHUB_STEP_SUMMARY 变量引用加双引号
2. **SC2129 修复**: 使用 `{ cmd1; cmd2; } >> file` 替代多个单独的重定向
3. **SC2193 修复**: 修正 bash 字符串比较语法
4. **YAML 解析错误**: 检查并修复 YAML 语法问题

## 具体修复内容

### soft-gates.yml

- 第153-156行: `$GITHUB_OUTPUT` → `"$GITHUB_OUTPUT"`
- 第166-171行: `$GITHUB_OUTPUT` → `"$GITHUB_OUTPUT"`
- 第273-318行: `$GITHUB_STEP_SUMMARY` → `"$GITHUB_STEP_SUMMARY"`

### release.yml

- 修复字符串比较语法错误

### 其他YAML文件

- 检查并修复语法错误

## 验证标准

- 不破坏现有功能
- 通过 actionlint 验证
- 通过 ShellCheck 验证
- Windows 兼容性

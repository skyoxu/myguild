# GitHub Actions 新错误修复方案

基于最新的 actionlint 错误分析，制定以下修复方案：

## 错误分析

### 1. staged-release.yml (Line 415)
- **错误**: YAML 解析错误 "could not find expected ':'"
- **原因**: EOF 行缺少正确的 YAML 缩进

### 2. security-unified.yml (Line 385) 
- **错误**: YAML 解析错误 "did not find expected comment or line break"
- **原因**: YAML 语法结构问题

### 3. release-ramp.yml (Line 307)
- **错误**: YAML 解析错误 "did not find expected comment or line break"  
- **原因**: YAML 语法结构问题

### 4. release-emergency-rollback.yml (Line 295)
- **错误**: YAML 解析错误 "did not find expected alphabetic or numeric character"
- **原因**: YAML 语法结构问题

### 5. observability-gate.yml (Line 106)
- **错误**: YAML 解析错误 "did not find expected comment or line break"
- **原因**: YAML 语法结构问题

### 6. release.yml (Line 107 和 Line 5)
- **错误**: SC2193 "The arguments to this comparison can never be equal"
- **原因**: bash 字符串比较语法问题

## 修复策略

1. **YAML语法修复**: 检查并修复所有YAML结构错误，确保正确的缩进和语法
2. **Shell脚本修复**: 修正 SC2193 bash 比较语法问题  
3. **Heredoc修复**: 确保所有 heredoc 标记正确缩进和格式化
4. **验证安全**: 每个修复都要保证不破坏现有功能

## 具体修复内容

### staged-release.yml
- 第415行: 修正EOF行的YAML缩进和结构

### 其他YAML文件
- 逐一检查并修复YAML语法错误

### release.yml
- 修复SC2193字符串比较语法问题

## 验证标准
- 通过 actionlint 验证所有文件
- 不破坏现有功能 
- Windows 兼容性
- 保持脚本逻辑完整性
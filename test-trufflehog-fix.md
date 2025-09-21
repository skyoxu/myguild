# TruffleHog 修复测试

此文件用于测试 TruffleHog 在 PR 模式下的修复。

## 修复内容

- 修正了 `security-unified.yml` 中第187行的 TruffleHog git 命令语法
- 从错误的双参数格式改为正确的 `--since-commit` 参数格式

## 期望结果

- PR 中的安全扫描工作流应该能够成功运行
- TruffleHog 增量扫描应该正常工作，不再报错

测试时间：$(Get-Date)

# GitHub Actions 新错误修复计划

## 错误分析

基于最新的 GitHub Actions 错误报告，发现以下问题：

### 1. staged-release.yml (Line 416): "mapping values are not allowed in this context"

**根本原因**: 第 415 行的 `EOF` 标记缩进不正确，导致 YAML 解析器认为它仍然在 heredoc 内容中，而第 416 行的 `echo` 命令被误解为 YAML 映射值。

**具体问题**:

```yaml
run: |
  cat >> $GITHUB_STEP_SUMMARY << 'EOF'
## 📊 分阶段发布总结

          EOF    # ❌ 缩进过多，应该与其他命令对齐
          echo "**版本**: ${{ env.APP_VERSION }}" >> $GITHUB_STEP_SUMMARY
```

**修复方案**: 将 `EOF` 标记的缩进调整为与其他 shell 命令一致。

### 2. 其他 YAML 解析错误

根据错误报告，还有以下文件的类似 YAML 解析问题：

- `security-unified.yml` (Line 385)
- `release-ramp.yml` (Line 307)
- `release-emergency-rollback.yml` (Line 295)
- `observability-gate.yml` (Line 106)

**可能原因**: 在之前的修复中，某些 EOF 标记的缩进可能仍然不正确，或者在 linter 自动格式化过程中被改动。

### 3. SC2193 Shell 比较错误

`release.yml` 中仍然存在 SC2193 错误，需要验证之前的修复是否被覆盖。

## 修复策略

### 阶段 1: 诊断和分析

1. ✅ 已识别问题文件和错误类型
2. ✅ 已通过 context7 查询最新的 actionlint 最佳实践
3. 🔄 需要检查所有文件的具体错误位置

### 阶段 2: 具体修复

1. 修复 `staged-release.yml` 第 415 行的 EOF 缩进问题
2. 验证并修复其他文件中类似的 EOF 缩进问题
3. 确保所有 heredoc 块的 EOF 标记都正确对齐
4. 验证 `release.yml` 中的 shell 比较修复

### 阶段 3: 验证

1. 使用 zen mcp 评审修复方案
2. 确保修复不会产生新问题
3. 确保不会破坏已修复的问题

## 关键原则

1. **一致性原则**: 所有 EOF 标记必须与其他 shell 命令保持相同的缩进级别
2. **最小变动**: 只修复必要的缩进问题，不改变功能逻辑
3. **向后兼容**: 确保修复后的工作流与之前的行为完全一致

## 预期结果

修复后，所有 7 个 actionlint 错误都应该消除，工作流能够正常执行。

# 分支保护规则推荐配置

## 核心原则

1. **稳定性优先**：使用稳定的英文作业ID作为必需状态检查，避免依赖显示名称
2. **条件作业排除**：有条件执行（if条件）的作业不应设为必需检查
3. **门禁去重**：避免重复的安全门禁造成分支保护混乱

## 推荐的必需状态检查

### 主CI流水线 (ci.yml)
```
CI/CD Pipeline / Quality Gates Check                    (quality-gates)
CI/CD Pipeline / Unit Tests (ubuntu-latest, Node 20)   (unit-tests-core) 
CI/CD Pipeline / Coverage Gate                          (coverage-gate)
CI/CD Pipeline / Release Health Gate                    (release-health-gate)
```

### 统一安全检查 (security-unified.yml)
```
Security Gate (Unified) / 🚦 统一安全门禁             (unified-security-gate)
```

**注意**: `electron-security-gate`已从ci.yml中移除，避免与统一安全门禁重复。所有安全检查现在统一在security-unified.yml中进行。

## 不建议设为必需检查的作业

以下作业由于有条件执行，建议**不要**设为必需状态检查：

### 扩展测试作业（有跳过条件）
- `deployment-readiness` - 仅在main分支执行
- `unit-tests-extended` - 有特定触发条件
- `performance-benchmarks` - 有跳过条件
- `build-verification-extended` - 有跳过条件

### 重复门禁作业（避免重复）
- `electron-security-gate` - 与unified-security-gate重复，建议只使用统一安全门禁

### 非核心门禁作业
- `dependency-audit` - 信息性检查，不应阻塞合并
- `observability-verification` - 监控验证，非阻塞性

## 作业ID稳定性策略

### 当前良好实践 ✅
所有核心作业都使用了稳定的英文ID：
- 使用连字符分隔 (`unit-tests-core`, `coverage-gate`)
- 避免特殊字符和中文
- 语义清晰且简洁

### 命名规范
```yaml
jobs:
  # 好的示例 ✅
  unit-tests-core:
    name: "Unit Tests (ubuntu-latest, Node 20)"
  
  coverage-gate:  
    name: "Coverage Gate"
    
  electron-security-gate:
    name: "Electron Security Gate"
    
  # 避免的示例 ❌
  单元测试核心:  # 中文ID
    name: "Unit Tests"
    
  unit_tests_123:  # 数字后缀不稳定
    name: "Unit Tests"
```

## 分支保护规则更新建议

在GitHub仓库设置中，建议配置以下必需状态检查：

1. 进入 Settings > Branches
2. 编辑 `main` 分支保护规则
3. 在 "Require status checks to pass before merging" 中添加：

```
✅ CI/CD Pipeline / Quality Gates Check
✅ CI/CD Pipeline / Unit Tests (ubuntu-latest, Node 20)
✅ CI/CD Pipeline / Coverage Gate  
✅ CI/CD Pipeline / Electron Security Gate
✅ CI/CD Pipeline / Release Health Gate
✅ Security Gate (Unified) / 🚦 统一安全门禁
```

4. 确保**不要**添加以下条件性作业：
```
❌ CI/CD Pipeline / deployment-readiness
❌ CI/CD Pipeline / unit-tests-extended
❌ CI/CD Pipeline / performance-benchmarks
❌ CI/CD Pipeline / build-verification-extended
```

## 验证工具

使用 `scripts/ci/workflow-consistency-check.mjs` 验证配置：

```bash
node scripts/ci/workflow-consistency-check.mjs
```

该脚本会：
- 验证 needs → jobs 依赖一致性
- 检查推荐的必需状态检查是否存在
- 识别不应设为必需检查的条件性作业
- 提供修复建议

## 更新流程

当需要修改作业时：

1. **仅修改 name 字段**（显示名），保持 job ID 不变
2. 运行一致性检查脚本验证
3. 更新分支保护规则中的显示名称（如果必要）

```yaml
# 推荐的更新方式 ✅
jobs:
  unit-tests-core:  # ID保持不变
    name: "Unit Tests (ubuntu-latest, Node 20.x)" # 仅更新显示名
    
# 避免的更新方式 ❌  
jobs:
  unit-tests-core-v2:  # 更改了ID，会破坏分支保护规则
    name: "Unit Tests (ubuntu-latest, Node 20)"
```

这样可以确保分支保护规则的稳定性，同时保持显示名称的灵活性。
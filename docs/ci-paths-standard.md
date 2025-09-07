# CI/CD 路径触发标准（P2统一）

## 标准路径配置

根据P2清单要求，重任务工作流应统一使用以下`pull_request.paths`配置：

```yaml
on:
  pull_request:
    branches: [main, develop]
    paths:
      - 'src/**'
      - 'electron/**'
      - 'scripts/**'
      - 'package.json'
      - 'package-lock.json'
      - 'tsconfig*.json' # 包含tsconfig.json, tsconfig.app.json等
      - 'vite.config.ts'
      - '.github/workflows/<workflow-name>.yml'
```

## 当前状况分析

### ✅ 已标准化的工作流

- `build-and-test.yml` - 基本符合但缺少scripts/\*\*
- `ci.yml` - 包含scripts/\*\*，但包含过多测试配置文件
- `security-unified.yml` - 基本符合但缺少scripts/\*_和tsconfig_.json

### 🔄 需要调整的工作流

- `pr-performance-check.yml` - 缺少scripts/\*\*
- 其他工作流需要按情况调整

## 分支保护建议

**Windows核心作业（必需状态检查）：**

1. `Build and Test` (build-and-test.yml)
2. `Electron Security Tests` (build-and-test.yml)
3. `📊 静态安全扫描（统一）` (security-unified.yml)
4. `🛡️ Workflow Guardian Check` (ci.yml)
5. `Lint workflow YAML (actionlint)` (validate-workflows.yml)
6. `Check jobs/needs consistency` (validate-workflows.yml)

**可选状态检查：**

- 性能检查（pr-performance-check.yml）
- 其他Linux/macOS nightly检查

## 产物保留期标准

### 常规产物（7-14天）

- 测试报告
- 构建产物
- 性能分析结果

### 发布/安全产物（30天）

- 安全扫描报告
- 发布构建
- Electron打包产物
- Source maps

## Step Summary标准化

所有工作流的step输出应使用：

- UTF-8编码
- ASCII兼容字符集
- 标准化的图标和格式

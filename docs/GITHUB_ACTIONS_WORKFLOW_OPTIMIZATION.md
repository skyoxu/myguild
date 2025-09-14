# GitHub Actions工作流优化配置记录

> **日期**: 2025-09-14  
> **问题**: "重建 + chrome-error"问题 - 重复构建导致CI时间长且易出错  
> **修复状态**: ✅ 已解决  
> **优化方案**: 构建artifacts共享策略

## 问题描述

GitHub Actions工作流中存在以下问题：

1. **重复构建**: `build-and-unit` job构建一次，`e2e-perf-smoke` job通过`tests/helpers/launch.ts`再次构建
2. **构建时间长**: 每个需要构建的job都要执行完整的15秒构建过程
3. **Chrome错误风险**: 多次构建增加了出错概率
4. **资源浪费**: CI环境中重复执行相同的npm run build命令

## 优化方案设计

### 核心策略: "构建一次，到处使用"

- 创建独立的`build-artifacts` job进行统一构建
- 使用`actions/upload-artifact@v4`上传构建产物
- 所有测试job使用`actions/download-artifact@v4`下载构建产物
- 通过`CI_ARTIFACTS_AVAILABLE`环境变量控制跳过重复构建

### 技术实现细节

#### 1. 新增build-artifacts job

```yaml
build-artifacts:
  runs-on: windows-latest
  defaults:
    run:
      shell: pwsh
  outputs:
    artifacts-available: ${{ steps.build-check.outputs.artifacts-available }}
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
    - run: npm ci
    - name: Build application
      env:
        VITE_E2E_SMOKE: 'true' # 确保E2E组件正确构建
      run: npm run build
    - name: Verify build outputs
      id: build-check
      run: |
        if ((Test-Path -LiteralPath 'dist') -and (Test-Path -LiteralPath 'dist-electron')) {
          Write-Host "✅ Build artifacts verified: dist/ and dist-electron/ directories exist"
          echo "artifacts-available=true" >> $env:GITHUB_OUTPUT
        } else {
          Write-Error "❌ Build artifacts missing: dist/ or dist-electron/ not found"
          echo "artifacts-available=false" >> $env:GITHUB_OUTPUT
          exit 1
        }
    - name: Upload build artifacts
      uses: actions/upload-artifact@v4
      with:
        name: build-artifacts
        path: |
          dist/
          dist-electron/
        retention-days: 1
        compression-level: 6
        include-hidden-files: false
```

#### 2. 修改build-and-unit job依赖关系

```yaml
build-and-unit:
  needs: build-artifacts # 依赖build-artifacts完成
  runs-on: windows-latest
  # 移除构建步骤，专注于代码质量检查
```

#### 3. 修改e2e-perf-smoke job使用artifacts

```yaml
e2e-perf-smoke:
  needs: [build-artifacts, build-and-unit]
  env:
    CI_ARTIFACTS_AVAILABLE: 'true' # 关键标识：跳过构建
  steps:
    - name: Download build artifacts
      if: steps.changes-e2e.outputs.any_changed == 'true'
      uses: actions/download-artifact@v4
      with:
        name: build-artifacts
        path: .
    - name: Verify downloaded artifacts
      if: steps.changes-e2e.outputs.any_changed == 'true'
      run: |
        Write-Host "📦 Verifying downloaded build artifacts..."
        if ((Test-Path -LiteralPath 'dist') -and (Test-Path -LiteralPath 'dist-electron')) {
          Write-Host "✅ Build artifacts downloaded successfully"
          if (Test-Path -LiteralPath 'dist-electron/main.js') {
            Write-Host "   - main.js entry point found"
          } else {
            Write-Error "❌ main.js entry point not found"
            exit 1
          }
        } else {
          Write-Error "❌ Downloaded artifacts missing"
          exit 1
        }
```

#### 4. 修改tests/helpers/launch.ts支持artifacts模式

```typescript
function buildApp() {
  // CI artifacts模式：跳过构建，直接使用下载的构建产物
  if (process.env.CI_ARTIFACTS_AVAILABLE === 'true') {
    console.log(
      '[launch] CI artifacts mode: using pre-built artifacts, skipping build'
    );
    return;
  }

  // 原有构建逻辑保持不变...
}
```

## 配置变更记录

### 关键文件修改

#### `.github/workflows/build-and-test.yml`

**新增内容**:

- `build-artifacts` job（第9-47行）
- `build-and-unit` job依赖关系修改（第50行）
- `e2e-perf-smoke` job dependencies修改（第90行）
- `CI_ARTIFACTS_AVAILABLE: 'true'`环境变量（第101行）
- 构建产物下载和验证步骤（第119-142行）

**移除内容**:

- `build-and-unit` job中的构建步骤（原第47-48行）

#### `tests/helpers/launch.ts`

**修改位置**: `buildApp()`函数（第18-50行）
**新增逻辑**:

```typescript
// CI artifacts模式：跳过构建，直接使用下载的构建产物
if (process.env.CI_ARTIFACTS_AVAILABLE === 'true') {
  console.log(
    '[launch] CI artifacts mode: using pre-built artifacts, skipping build'
  );
  return;
}
```

### 环境变量配置

#### CI环境变量

- `CI_ARTIFACTS_AVAILABLE=true`: 指示使用预构建的artifacts，跳过本地构建
- `VITE_E2E_SMOKE=true`: 确保构建时包含E2E测试组件

#### 构建时注入的环境变量

- `VITE_E2E_SMOKE=true`: 在`build-artifacts` job的构建步骤中注入

## 性能优化结果

### 预期改进指标

- **构建时间节省**: 60%+ （从多次15秒构建降至1次15秒构建）
- **CI总时间**: 减少约20-30秒（取决于并行job数量）
- **成功率提升**: 减少重复构建导致的随机失败
- **资源使用**: 降低CI runner的CPU/内存使用

### 工作流执行路径对比

#### 优化前

```
build-and-unit: checkout → setup → npm ci → build (15s) → lint → test → coverage
    ↓
e2e-perf-smoke: checkout → setup → npm ci → [launch.ts内部再次build (15s)] → test
```

#### 优化后

```
build-artifacts: checkout → setup → npm ci → build (15s) → upload-artifact
    ↓
build-and-unit: checkout → setup → npm ci → lint → test → coverage (并行)
e2e-perf-smoke: checkout → setup → npm ci → download-artifact → test (并行)
```

## 兼容性保障

### 本地开发环境

- **本地E2E测试**: `CI_ARTIFACTS_AVAILABLE`未设置时，正常执行构建
- **开发工作流**: `npm run dev`、`npm run build`等命令不受影响
- **IDE集成**: VS Code等编辑器的调试功能正常

### CI环境向后兼容

- **环境变量缺失时**: 自动fallback到原有构建逻辑
- **构建失败时**: build-artifacts失败会阻止后续job，确保数据一致性
- **artifacts不可用**: 下载失败时会exit 1，明确指示问题

## 验证测试结果

### 本地验证 ✅

```bash
# 1. TypeScript编译检查
npm run typecheck  # ✅ 通过

# 2. 代码质量检查
npm run lint       # ✅ 通过 (src: 111/115 warnings, tests: <300 warnings)

# 3. E2E冒烟测试
npm run test:e2e:perf-smoke  # ✅ 通过 (P95: 22ms < 200ms阈值)

# 4. GitHub Actions YAML语法
actionlint .github/workflows/build-and-test.yml  # ✅ 无错误

# 5. 构建产物验证
npm run build     # ✅ 生成 dist/ 和 dist-electron/ 目录
```

### E2E测试详细结果

```
@smoke Perf Smoke Suite:
  ✅ @smoke App renders          (42ms)
  ✅ @smoke Interaction P95      (10.17s)

P95性能统计:
  - 样本数量: 30
  - P95值: 22.00ms
  - 平均值: 16.00ms
  - 最小值: 12.00ms
  - 最大值: 22.00ms
  - 阈值: 200ms
  - 状态: ✅ 通过
```

## 回滚方案

如果优化方案出现问题，可以通过以下步骤快速回滚：

### 1. 恢复工作流文件

```bash
git checkout HEAD~1 -- .github/workflows/build-and-test.yml
```

### 2. 恢复launch.ts文件

```bash
git checkout HEAD~1 -- tests/helpers/launch.ts
```

### 3. 或者手动修改

- 将`build-and-unit` job恢复为包含构建步骤
- 移除`build-artifacts` job
- 移除`e2e-perf-smoke` job中的artifact下载步骤
- 移除`CI_ARTIFACTS_AVAILABLE`环境变量检查

## 故障排除指南

### 常见问题与解决方案

#### 问题1: artifacts下载失败

```
Error: Artifact 'build-artifacts' not found
```

**解决方案**: 检查`build-artifacts` job是否成功完成，确保artifact名称匹配

#### 问题2: main.js文件缺失

```
❌ main.js entry point not found in dist-electron/
```

**解决方案**: 检查构建过程中TypeScript编译是否成功，确保electron目录正确编译

#### 问题3: 环境变量未生效

```
[launch] building application (npm run build)...
```

**解决方案**: 确认`CI_ARTIFACTS_AVAILABLE=true`在job环境变量中正确设置

#### 问题4: 测试超时或失败

**解决方案**: 检查下载的artifacts是否包含完整的构建产物，验证VITE_E2E_SMOKE环境变量

### 监控指标

#### 成功指标

- `build-artifacts` job构建时间稳定在15-20秒
- artifact上传成功率100%
- artifact下载时间<5秒
- E2E测试通过率不降低

#### 告警条件

- artifact下载失败率>1%
- 总CI时间超过优化前基线
- E2E测试失败率增加

## 技术债务与后续优化

### 已知限制

- artifact保留期为1天（适合短期分支，长期分支需手动调整）
- 只优化了单个workflow，其他workflow可参考此模式
- 暂未实现跨workflow的artifact共享

### 后续优化方向

- 考虑使用GitHub Actions cache替代artifact（适合频繁访问场景）
- 实现多job并行下载同一artifact的优化
- 添加artifact大小监控和压缩率优化
- 考虑增加构建产物的checksum验证

## 相关参考文档

- [GitHub Actions artifacts官方文档](https://docs.github.com/en/actions/guides/storing-workflow-data-as-artifacts)
- [actions/upload-artifact@v4文档](https://github.com/actions/upload-artifact/tree/v4/)
- [actions/download-artifact@v4文档](https://github.com/actions/download-artifact/tree/v4/)
- [Playwright Electron测试最佳实践](https://playwright.dev/docs/api/class-electron)
- [citest/ciinfo.md](citest/ciinfo.md) - CI测试基本规则
- [E2E_PERF_TEST_CONFIGURATION_BACKUP.md](E2E_PERF_TEST_CONFIGURATION_BACKUP.md) - P95测试配置
- [BUILD_AND_TEST_WORKFLOW_BACKUP_e0f67f3.md](BUILD_AND_TEST_WORKFLOW_BACKUP_e0f67f3.md) - 原工作流配置备份

---

**最后更新**: 2025-09-14  
**修复者**: Claude Code Assistant  
**验证状态**: ✅ 已通过完整本地验证，待CI环境验证  
**审核状态**: ✅ 已通过Zen MCP架构评审和Context7 MCP技术调研

# GitHub 分支保护规则配置指南 - 修复版

## 问题说明

原先的`GITHUB_BRANCH_PROTECTION_SETUP.md`中提到的一些检查项在实际的GitHub Actions中不存在，现在已修复。

## 正确的分支保护规则配置

### 1. 进入GitHub仓库设置

1. 进入你的GitHub仓库
2. 点击 `Settings` 标签页
3. 在左侧菜单中选择 `Branches`
4. 点击 `Add branch protection rule`

### 2. 配置main分支保护

#### 基本设置
- **Branch name pattern**: `main`
- ✅ **Require pull request reviews before merging**
  - Required number of reviews: `1`
  - ✅ **Dismiss stale PR approvals when new commits are pushed**
  - ✅ **Require review from code owners** (如果有CODEOWNERS文件)

#### 状态检查要求
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**

**必需的状态检查** (这些名称与实际GitHub Actions工作流对应):

##### 核心检查项 (必须通过)
1. **Build and Test** - 对应 `.github/workflows/build-and-test.yml`
2. **质量门禁检查** - 对应 `ci.yml` 中的 `quality-gates` job
3. **安全扫描** - 对应 `ci.yml` 中的 `security-scan` job

##### 可观测性与性能检查
4. **可观测性门禁检查** - 对应 `.github/workflows/observability-gate.yml`
5. **PR Performance Check** - 对应 `.github/workflows/pr-performance-check.yml`
6. **Configuration Management** - 对应 `.github/workflows/config-management.yml`

##### E2E测试 (推荐)
7. **E2E安全测试** - 对应 `ci.yml` 中的 `e2e-security-tests` job
8. **Electron Security Tests** - 对应 `build-and-test.yml` 中的 `electron-security` job

#### 其他限制
- ✅ **Restrict pushes that create files that have a prohibited file extension**
- ✅ **Restrict commits by author email** (可选，根据团队需求)
- ✅ **Require linear history** (推荐，保持clean的git历史)
- ✅ **Include administrators** (管理员也必须遵循规则)

### 3. 高级配置

#### 自动删除head分支
- ✅ **Automatically delete head branches** (PR合并后自动删除分支)

#### 限制push权限
- ✅ **Restrict who can push to matching branches**
  - 只允许特定团队或个人直接push到main分支

### 4. 验证配置

配置完成后：

1. 创建一个测试PR到main分支
2. 应该看到以下状态检查正在运行：
   - ✅ Build and Test
   - ✅ 质量门禁检查
   - ✅ 安全扫描
   - ✅ 可观测性门禁检查
   - ✅ PR Performance Check
   - ✅ Configuration Management

3. 只有当**所有必需检查**都通过时，PR才能合并

### 5. 状态检查名称对应表

| 分支保护中的名称 | 对应的GitHub Actions工作流 |
|------------------|---------------------------|
| Build and Test | `.github/workflows/build-and-test.yml` |
| 质量门禁检查 | `.github/workflows/ci.yml` → quality-gates |
| 安全扫描 | `.github/workflows/ci.yml` → security-scan |
| 可观测性门禁检查 | `.github/workflows/observability-gate.yml` |
| PR Performance Check | `.github/workflows/pr-performance-check.yml` |
| Configuration Management | `.github/workflows/config-management.yml` |

### 6. 故障排除

#### "Not enforced" 状态
- **原因**: 状态检查名称与实际GitHub Actions job名称不匹配
- **解决**: 确保分支保护中的状态检查名称与Actions工作流中的job名称完全一致

#### 检查项找不到
- **原因**: 对应的GitHub Actions工作流不存在或未运行过
- **解决**: 
  1. 确保所有`.yml`文件都存在于`.github/workflows/`目录
  2. 推送一个commit触发Actions运行
  3. 在Actions成功运行后，状态检查才会在分支保护设置中可选

#### 设置后立即显示错误
- **原因**: 某些历史commit可能不符合新规则
- **解决**: 这是正常现象，新的PR会遵循新规则

## 注意事项

1. **首次设置**: 需要先运行一次所有GitHub Actions，状态检查才会出现在分支保护设置中
2. **权限要求**: 需要仓库管理员权限才能设置分支保护规则
3. **渐进实施**: 可以先设置核心检查项，然后逐步添加其他检查
4. **紧急情况**: 管理员可以临时禁用分支保护进行紧急修复

## 立即行动步骤

1. ✅ 已创建 `build-and-test.yml` 工作流
2. 🔄 推送此commit触发所有Actions运行
3. ⏳ 等待Actions完成后设置分支保护规则
4. ✅ 验证所有状态检查都能正确显示并运行
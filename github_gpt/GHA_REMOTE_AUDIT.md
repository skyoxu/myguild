# 远程 GitHub Actions 审计（SSH 拉取快照）

本报告基于对 `git@github.com:skyoxu/myguild.git`（main 分支，浅克隆）获取的 `.github/workflows/**` 与 `scripts/ci/**` 的静态审计结果，聚焦 P0/P1/P2 问题与改进建议。

## 结论概览

- P0（阻断 CI）: 未发现。
- P1（高优先修复，防“假绿/误阻断/权限失败”）: 未发现明显必修项；但见“守护建议”。
- P2（优化/守护/体验）: 建议加入自检与版本锁定守护，详见下文。

## 关键检查点（远程快照）

- 最小权限与并发（所有工作流）
  - 顶层 `permissions:` 与 `concurrency:` 均存在（逐文件扫描）。
- 变更文件过滤（ci.yml）
  - 检测到 `steps.changed-files.outputs.any_changed` 与 `tj-actions/changed-files@v45` 同时存在（匹配），条件引用有效。
- jq 依赖
  - 需要 `jq` 的工作流（observability-gate、security-unified、release-\*、soft-gates）都包含 `apt-get install -y jq` 安装步。
- 风险性用法
  - 未发现 `pull_request_target`；未发现 `@main`（未固定版本）的 Action 引用。
- 覆盖率脚本
  - `scripts/ci/coverage-config.cjs`、`scripts/ci/coverage-gate.cjs` 在本地 Node `--check` 下语法通过；描述行已为 ASCII 文案，避免编码漂移。
- Electron 安全扫描
  - `security-unified.yml` 中 Electronegativity 使用 `--electron-version 37.0.0`，与工程 Electron 版本对齐。

> 扫描采样摘要文件：`github_gpt/remote_workflows_scan.txt`

## 守护建议（P2，提升稳态）

- 工作流语法/最佳实践自检：在 CI 入口或每个工作流加 `rhysd/actionlint@v1` 以避免 YAML/表达式隐患。
- needs 守护：在 CI 开头用轻量脚本校验 “needs ⊆ jobs”；当 job id 修改但 needs 未同步时，提前失败并输出修复提示。
- 保护检查名守护（可选）：读取分支保护中的必需检查名，与核心作业名比对；不一致时 fail 并提示更新设置，避免检查名改动后保护失效。
- Snyk 供应链稳定性：优先 `snyk/actions/node@v4` 或固定 CLI 版本，减少上游变动对结果的影响。
- 软门禁容错：为“创建 Neutral Check / PR 评论”步骤加 `continue-on-error: true`，确保软门禁永不阻断（若尚未加）。
- 报告规范：统一 Step Summary 为 UTF‑8/ASCII 文案，Artifacts 保留期建议 7–14 天（安全/发布类 30 天）。

## 分支保护推荐（复核）

- 必需检查（稳定英文名，与你本地一致）：
  - Build and Test
  - Quality Gates Check
  - Unit Tests (ubuntu-latest, Node 20)
  - Coverage Gate
  - Build Verification (ubuntu-latest)
  - Electron Security Gate
  - Observability Verification
  - Release Health Gate
- 其他设置：Require PR、至少2审、驳回旧审、需解决对话、需与基线同步、线性历史、禁止强推/删除；main/release 可启用 “Do not allow bypassing the above settings”。

---

如需，我可以在 CI 入口补充可直接落地的自检步骤（actionlint + needs 守护），或将 Coverage/Security/Release Health Gate 抽象为 `workflow_call` 复用工作流，进一步降低维护压力。

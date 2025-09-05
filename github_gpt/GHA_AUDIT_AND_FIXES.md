# GitHub Actions 审计与修复方案（当前仓库）

## 概览

- 目标：梳理现有工作流（.github/workflows/\*\*）的健康度，标注 P0/P1/P2 问题，并给出最小修复与守护建议。
- 结论：本轮复检未发现新的 P0 阻断问题；仍有少量 P1 易错点与 P2 优化项，建议尽快收敛以提升稳态与可维护性。

## 验证结果（快照）

- 覆盖率脚本：`scripts/ci/coverage-config.cjs`、`scripts/ci/coverage-gate.cjs` 语法检查通过（Node --check 绿），关键描述行已改为 ASCII 文案，避免编码漂移。
- 工作流最小权限与并发：所有 workflow 顶部均已显式 `permissions: contents: read` 且存在 `concurrency` 设置（逐仓/逐分支互斥）。
- Release Health Gate：在 `ci.yml` 中已加基于 `SENTRY_AUTH_TOKEN` 的条件执行与 fork 降级分支；main/release 可保留硬门。
- Electronegativity：`security-unified.yml` 使用 `--electron-version 37.0.0`，与 package.json Electron 版本一致。
- 软门禁权限：job 级已包含 `checks: write` 与 `issues: write`，可创建 Check 与 PR 评论。
- needs 引用：`needs: [unit-tests-core, coverage-gate, electron-security-gate]` 等依赖指向的 job 均存在，未发现悬空 needs。

## P1（尽快修，防假绿/误阻断）

1. 变更文件过滤的可用性（changed-files）

- 现象：`ci.yml` 中多处引用 `steps.changed-files.outputs.any_changed`，但未在审计中明确检出 `tj-actions/changed-files` 的 uses 片段。
- 风险：若未实际生成该输出，相关步骤条件恒 false → 误跳过；或表达式错误导致 job 被误判 skipped。
- 最小修复（二选一）：
  - A. 触发层过滤（推荐简单）：在 `on.pull_request.paths`/`paths-ignore` 粒度控制重任务触发，无需在 job/step 再判定。
  - B. 引入 `changed-files` Action（保持 step 条件）：
    ```yaml
    - name: Get changed files
      id: changed-files
      uses: tj-actions/changed-files@v45
      with:
        files: |
          src/**
          electron/**
          scripts/**
          package*.json
          tsconfig*.json
          vite.config.ts

    # 之后用 steps.changed-files.outputs.any_changed == 'true' 判定
    ```

2. 软门禁“永不阻断”的容错

- 现象：已具备 job 级权限，但 Checks/PR 评论步骤若遭遇 API 限流/网络抖动可能 fail。
- 建议：为“创建 Neutral Check/评论”的步骤增加 `continue-on-error: true`，确保软门禁始终返回 success（neutral 结论）。

3. Snyk 使用与版本锁定（供应链稳定性）

- 现象：在部分作业中用 CLI 安装/调用或旧版本 Action；长期可能因上游变更产生漂移。
- 建议（其一即可）：
  - 固定 CLI 版本：`npm i -g snyk@<pinned_version>`；或
  - 使用 `snyk/actions/node@v4`（或当前稳定主版本）并遵循官方配置。

## P2（优化/体验/守护）

1. 守护自检（强烈推荐）

- actionlint：在每个工作流或 CI 入口增加语法/最佳实践校验。
  ```yaml
  - name: Lint workflows
    uses: rhysd/actionlint@v1
  ```
- needs 守护：校验 “needs ⊆ jobs”，名变更即刻报错（可用轻量 Node/JS 脚本实现）。
- 保护检查名守护（可选）：比对分支保护的必需检查名与核心 job name，发生漂移时 fail 并输出提示（避免检查名改动后保护失效）。

2. 重任务统一 paths 触发

- 对 `build-and-test.yml`、`ci.yml` 的核心/重任务统一使用：
  - `on.pull_request.paths: ['src/**','electron/**','scripts/**','package*.json','tsconfig*.json','vite.config.ts']`
  - 文档/治理类工作流（如 soft-gates、tasks-governance）可反向 paths（仅 docs/**/scripts/**），避免无谓跑重任务。

3. Release Health Gate 的 PR 降级说明

- 当前已对 `SENTRY_AUTH_TOKEN` 缺失做条件化；补充 Step Summary 告知“PR 环境跳过硬门，main/release 硬门生效”，提高可读性。

4. Artifacts 保留期与报告规范

- 常规报告 7–14 天足够；安全/发布类 30 天。统一 Step Summary 为 UTF‑8；尽量用 ASCII 提示，减少乱码。

## 已达标的核心清单（用于分支保护）

- Build and Test（build-and-test.yml）
- Quality Gates Check（ci.yml: quality-gates）
- Unit Tests (ubuntu-latest, Node 20)（ci.yml: unit-tests-core）
- Coverage Gate（ci.yml: coverage-gate）
- Build Verification (ubuntu-latest)（ci.yml: build-verification-core）
- Electron Security Gate（ci.yml: electron-security-gate）
- Observability Verification（ci.yml: observability-verification）
- Release Health Gate（ci.yml: release-health-gate）

> 说明：以上为“稳定英文名”的核心门禁作业；仅将这些作业配置为“必需检查”，矩阵/扩展作业留作非必需检查以降低维护成本。

## 附：可直接粘贴的修复片段

- 引入 changed-files（若选择方案 B）

```yaml
- name: Get changed files
  id: changed-files
  uses: tj-actions/changed-files@v45
  with:
    files: |
      src/**
      electron/**
      scripts/**
      package*.json
      tsconfig*.json
      vite.config.ts
```

- 软门禁 Check/评论容错

```yaml
- name: Create neutral check
  uses: actions/github-script@v7
  continue-on-error: true
  with:
    script: |
      // ... checks.create / issues.createComment
```

- actionlint 自检

```yaml
- name: Lint workflows
  uses: rhysd/actionlint@v1
```

---

若你希望，我可以继续生成一份“needs→jobs 自检脚本（Node/JS）”和“保护检查名守护 Step”，直接插入 CI 入口，进一步降低未来漂移的风险。

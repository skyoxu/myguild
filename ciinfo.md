# CI 基础规则（Windows 优先 / UTF-8 BOM）

以下规则适用于本仓库的 GitHub Actions 与本地校验（Windows 优先），用于避免常见的 actionlint/YAML/编码类问题，并指导 E2E 分片、工件命名与日志归档。

## 核心约定

- 操作系统与 Shell：
  - 默认使用 `windows-latest` 与 `pwsh`（PowerShell 7+）。
  - 如步骤中使用 POSIX 测试语法（`[`, `[[`），必须显式 `shell: bash`。
  - `validate-workflows.yml` 中的 Shell 守卫会强制以上策略。

- 编码与行尾：
  - workflows：UTF-8（无 BOM）+ LF（由 `.gitattributes`/校验脚本守卫）。
  - 其余源文件：UTF-8 with BOM + CRLF（由 `.editorconfig` 约束）。
  - 禁止中文/emoji/不可见字符进入 workflows，`ascii-guard` 会拦截。

- 日志与工件：
  - 日志统一落至 `logs/`，按工具或阶段分目录；必要时上传为 artifacts（保留 7–30 天）。
  - E2E/安全扫描产物统一上传 artifacts，名称需确保在同一次 workflow run 内唯一。

## E2E 分片与工件命名

- 分片（示例 4 片）
  - 环境变量：`SHARD_TOTAL=4`，`SHARD_INDEX=1..4`。
  - 建议 Playwright `test` 中按以上环境变量做分片过滤（或使用 `--shard=X/Y`）。

- 工件命名唯一化（避免 409 Conflict）：
  - `playwright-traces-shard-${{ matrix.shard }}`
  - `e2e-security-test-results-shard-${{ matrix.shard }}`
  - 如需支持 rerun，追加 `-run${{ github.run_attempt }}` 后缀（可选）。

- 聚合下载：
  - 使用 `actions/download-artifact@v4` 的 `pattern` + `merge-multiple: true`：
    - `pattern: e2e-security-test-results-shard-*`
    - `pattern: playwright-traces-shard-*`

## Windows 专项配置

- Playwright：Windows Runner 无需 `--with-deps`；建议 `npx playwright install`。
- Electron：无需 `xvfb`；在验证步骤用 `Write-Host` 简要输出环境（避免多行 echo）。
- npm 安装：确保 `NODE_ENV=development` 与 `NPM_CONFIG_PRODUCTION=false` 以安装 devDependencies。

## Sentry / Release Health

- 令牌检查使用脚本 `scripts/ci/sentry-verify.mjs`，仅在令牌存在时执行门禁 `scripts/ci/release-health-gate.mjs`。
- 相关环境：`SENTRY_AUTH_TOKEN`、`SENTRY_ORG`、`SENTRY_PROJECT`、`SENTRY_DSN`、`SENTRY_ENVIRONMENT`、`SENTRY_RELEASE`。

## Validate Workflows（动作级校验）

- 触发方式：
  - 推荐通过 PR（含 Draft）触发 `Validate Workflows & Guards`，或推送至 `main`。
- 校验内容：
  - actionlint（Linux/Windows 双侧）
  - workflows 编码与行尾守卫（UTF-8 + LF）
  - Shell 守卫（Windows 默认 pwsh，POSIX 步骤显式 bash）
  - ASCII 守卫（禁止中文/emoji/不可见字符）
  - needs/consistency 检查

## 常见错误与止损

- 409 Conflict（artifact 重复命名）：为分片工件添加 `${{ matrix.shard }}` 或加上 `-run${{ github.run_attempt }}`；聚合侧用 `pattern + merge-multiple`。
- 多行 `run: |` 导致 YAML/actionlint 误报：将复杂逻辑迁移到 `scripts/ci/**` 的 Node 脚本；仅保留简短命令。
- 中文/乱码注释：统一英文化（仅文本替换，不改逻辑），避免 ASCII 守卫失败。

## 目录与约定复述（重要）

- 日志：统一 `logs/`；Playwright traces 放 `logs/playwright-traces/`。
- 工件：分片命名唯一；聚合下载用 `pattern + merge-multiple`。
- Shell：Windows 默认 `pwsh`；POSIX 步骤显式 `bash`。
- 编码：workflows UTF‑8+LF；其他 UTF‑8 BOM+CRLF。
- 安全：不要在 workflows 中回显敏感 token；仅输出必要上下文信息。

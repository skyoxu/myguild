# CI 必选检查（建议）

## Required checks（分支保护）

- `lint`：ESLint 基本规则
- `typecheck`：TypeScript 类型检查
- `test:unit`：Vitest 单元测试（含覆盖率产物）
- `test:coverage:gate`：覆盖率门禁（全局 ≥ 90%）
- `test:e2e`：Playwright E2E（含 performance 套件）
- `guard:bundle`：gzip 预算 Gate（`scripts/ci/bundle-budget-gate.mjs`）
- `release:health-gate`：Release Health（Crash‑Free Sessions/Users 达标，离线门禁）

## 流水线顺序

`lint → typecheck → test:unit(coverage) → test:e2e → security:check → guard:bundle → release health → package`

## 环境变量（示例）

- `SENTRY_ORG`、`SENTRY_PROJECT`、`SENTRY_DSN`、`SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`：推荐 `${GITHUB_SHA}` 或 `${npm_package_version}-${GITHUB_SHA:0:7}`
- `BUNDLE_GUARD=soft`：软门阶段（两周后去掉）

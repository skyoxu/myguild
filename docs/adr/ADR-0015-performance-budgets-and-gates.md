# ADR-0015: 性能预算与门禁统一（Proposed）

Date: 2025-09-12
Status: Proposed
Deciders: Core Maintainers
Approver: TBD
Supersedes: None
Related: build gates, E2E perf, release health

## Context

现状存在多处性能预算与门禁定义（脚本/测试/文档），容易出现口径不一致；首屏受 Phaser 依赖影响，交互路径偶发抖动，CI 难以稳定阻断回归。

## Decision

1. 预算与阈值

- 交互 P95：dev 200ms / staging 150ms / prod 100ms。
- 冷启动 P95：按 `DEFAULT_LATENCY_BUDGET.assetLoad.cold`（3s 基线），后续随产品阶段收紧。
- Bundle（gzip）：`phaser` ≤ 500kB、`react-vendor` ≤ 150kB、initial 合计 ≤ 400kB。

2. 门禁统一

- `guard:bundle` 唯一指向 `scripts/ci/bundle-budget-gate.mjs`（gzip 预算）。
- E2E 性能用例以 P95 采样，使用双 rAF 与预热稳定采样；在 CI 环境按 `SENTRY_ENVIRONMENT` 或 `NODE_ENV` 选择阈值。
- 两周软门→硬门：初期以警告（不 fail），两周后改为硬门（fail job）。

3. 首屏策略

- 通过 `React.lazy`、动态导入，将 Phaser 与场景从 initial 中剥离；首屏仅渲染骨架/按钮。
- 后续逐步移除源码内顶层 `import 'phaser'`（场景/管理器）改为运行时加载。

4. 观测与 Release Health

- 对冷启动/交互/场景切换上报 transaction/span；CI 对比上一基线，若 Crash‑Free 或性能低于阈值则阻断。

## Consequences

- 统一的门禁脚本与阈值，减少配置漂移；PR 可附可视化报告与 P95 摘要作为证据。
- 首屏体积与冷启时延可预期下降；交互 P95 更稳定，避免假阴/假阳。
- 需要补充 ADR/CI 文档与环境变量说明。

## Alternatives

- 继续使用多脚本/多阈值（否，漂移风险高）。
- 仅以平均值断言（否，无法覆盖尾部抖动）。

## Notes

- 本 ADR 落地后观察两周，再将软门切换为硬门；必要时设相对基线偏移阈值（±10%）。

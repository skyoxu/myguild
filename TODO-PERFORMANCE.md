# 性能优化 TODO 列表（阶段性）

## 已完成

- [x] 统一 bundle 预算门禁：`guard:bundle` → `scripts/ci/bundle-budget-gate.mjs`
- [x] 首屏按需加载：`App` 使用 `React.lazy` 懒加载 `GameCanvas`/`GameVerticalSlice`
- [x] 交互重逻辑迁移至 Worker（`GameCanvas` 内按钮 → `workerBridge`）
- [x] E2E 交互 P95 稳定化（预热 + 双 rAF + 指示器复位）
- [x] 渲染侧长任务监控（`startLongTaskMonitor`）并在开发/测试输出
- [x] Preload 暴露事件环延迟监控（`perf_hooks.monitorEventLoopDelay` 已存在，新增 React 侧轮询 Hook）
- [x] TestScene 纹理/atlas 管线占位接入（`useTexturePipeline`）
- [x] 使用 `useTransition` 降级非紧急更新（GameCanvas 状态更新）

## 进行中/待办

- [ ] 资产预热：根据实际静态资源清单添加 URL；接入 atlas/纹理压缩策略
- [ ] ADR：性能预算与门禁统一（dev 200ms/staging 150ms/prod 100ms；两周软门→硬门）
- [ ] CI：将 `guard:bundle`、E2E 性能、Release Health 配置为 Required checks
- [ ] Sentry Performance：对冷启动/交互/场景切换上报 transaction/span，并在 CI 做基线对比
- [ ] 将 Phaser 静态导入彻底迁移为“进入游戏”时动态导入（逐步治理场景/管理器）

> 备注：以上每一项落地后，请在 PR 中附带构建可视化报告、P95 分布截图与门禁配置变更说明。

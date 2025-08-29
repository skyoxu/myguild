# GitHub Actions 工作流说明

本目录包含基于 ADR-0008 实现的完整渐进发布和自动回滚 GitHub Actions 工作流。

## 📋 工作流概览

| 工作流 | 文件 | 触发方式 | 用途 |
|-------|------|----------|------|
| **Release Preparation** | `release-prepare.yml` | 手动触发 | 发布准备：版本管理、feed 文件创建 |
| **Release Ramp** | `release-ramp.yml` | 手动触发 | 渐进发布：分阶段发布和健康检查 |
| **Release Monitor** | `release-monitor.yml` | 定时/手动 | 持续监控：健康度监控和异常检测 |
| **Emergency Rollback** | `release-emergency-rollback.yml` | 手动/自动触发 | 紧急回滚：快速回滚到稳定版本 |

## 🚀 标准发布流程

### 1. 发布准备阶段
```bash
# GitHub UI 操作:
# Actions → Release Preparation → Run workflow
# 参数填写:
#   version: 1.2.3
#   artifact_path: dist/app-1.2.3.exe  
#   create_feeds: ✅ true
```

**执行内容**:
- ✅ 验证版本号格式
- ✅ 将版本添加到 `artifacts/manifest.json`
- ✅ 创建各平台 feed 文件（`latest.yml`, `latest-mac.yml`, `latest-linux.yml`）
- ✅ 验证版本清单完整性
- ✅ 提交并推送变更

### 2. 渐进发布阶段
按顺序执行各阶段，每个阶段都包含健康检查：

#### 阶段 1: 5% 发布
```bash
# Actions → Release Ramp → Run workflow
# 参数: stage=5, feed_file=dist/latest.yml, skip_health_check=false
```

#### 阶段 2: 25% 发布  
```bash
# 等待 10-15 分钟观察 5% 阶段指标
# Actions → Release Ramp → Run workflow
# 参数: stage=25
```

#### 阶段 3: 50% 发布
```bash
# 等待 10-15 分钟观察 25% 阶段指标
# Actions → Release Ramp → Run workflow  
# 参数: stage=50
```

#### 阶段 4: 100% 全量发布
```bash
# 等待 10-15 分钟观察 50% 阶段指标
# Actions → Release Ramp → Run workflow
# 参数: stage=100
```

### 3. 持续监控
监控工作流自动运行（每15分钟）：
- ✅ 检查当前发布健康度  
- ✅ 异常时自动触发紧急回滚
- ✅ 更新监控仪表盘
- ✅ 发送告警通知

## ⚡ 紧急情况处理

### 手动紧急回滚
```bash
# Actions → Emergency Rollback → Run workflow
# 参数填写:
#   reason: "Critical security vulnerability detected"
#   target_version: 1.1.0 (上一稳定版本)
#   feed_files: all (回滚所有平台)
```

### 自动回滚触发条件
- Crash-Free Users < 99.5%
- Crash-Free Sessions < 99.5%  
- Sentry Release Health API 异常
- 监控工作流检测到持续健康问题

## 🔧 环境配置

### Repository Variables (Settings → Environments → Variables)
```bash
SENTRY_ORG=your-organization        # Sentry 组织名
SENTRY_PROJECT=vitegame            # Sentry 项目名  
APP_VERSION=1.2.3                  # 当前发布版本
PREV_GA_VERSION=1.1.0             # 上一稳定版本（回滚目标）
THRESHOLD_CF_USERS=0.995          # Crash-Free Users 阈值
THRESHOLD_CF_SESSIONS=0.995       # Crash-Free Sessions 阈值
```

### Repository Secrets (Settings → Secrets and variables → Actions)
```bash
SENTRY_AUTH_TOKEN=sntrys_xxx      # Sentry API 认证令牌
WEBHOOK_URL=https://hooks.slack.com/xxx  # 可选：通知 Webhook
```

### 权限配置
工作流需要以下权限：
- `contents: write` - 提交 feed 文件变更
- `actions: write` - 触发其他工作流（监控 → 紧急回滚）

## 📊 监控和告警

### 工作流状态监控
- **成功**: ✅ 绿色徽章，发布继续下一阶段
- **健康检查失败**: ❌ 红色徽章，自动触发回滚
- **部分失败**: ⚠️  黄色徽章，需要人工干预

### 通知渠道
配置 `WEBHOOK_URL` 后，以下事件会发送通知：
- 🎯 阶段发布完成
- 🚨 健康检查失败  
- 🔄 自动回滚执行
- ⚠️  监控异常

### 监控数据
监控状态保存在 `.github/monitoring/latest-status.json`:
```json
{
  "timestamp": "2025-08-29T17:45:00.000Z",
  "version": "1.2.3", 
  "staging_percentage": 25,
  "health_status": "healthy",
  "health_data": {...},
  "next_check": "2025-08-29T18:00:00.000Z"
}
```

## 🎯 最佳实践

### 发布计划
1. **准备阶段**: 工作日上午完成发布准备
2. **5% 阶段**: 上午发布，观察 2-4 小时
3. **25% 阶段**: 下午发布，观察到次日上午
4. **50% 阶段**: 次日上午发布，观察 4-6 小时
5. **100% 阶段**: 确认稳定后全量发布

### 健康指标阈值
- **保守策略**: 99.9% (0.999)
- **标准策略**: 99.5% (0.995) ✅ 推荐
- **激进策略**: 99.0% (0.990)

### 回滚决策
- **自动回滚**: 健康度低于阈值，无人工干预
- **人工回滚**: 业务指标异常、用户反馈等
- **暂停发布**: 外部依赖问题、节假日等

## 🔍 故障排除

### 常见问题

#### 1. Sentry API 认证失败
```bash
# 错误: SENTRY_AUTH_TOKEN 无效
# 解决: 检查 token 权限，需要 project:read 和 org:read
```

#### 2. 健康数据不可用
```bash
# 错误: Health metrics not available
# 解决: 等待更长时间让 Sentry 收集数据（通常 5-15 分钟）
```

#### 3. 工作流权限不足
```bash
# 错误: Resource not accessible by integration
# 解决: 检查 Repository Settings → Actions → General → Workflow permissions
```

#### 4. Feed 文件格式错误
```bash
# 错误: YAML parsing failed
# 解决: 检查 feed 文件格式，确保 YAML 语法正确
```

### 调试模式
启用工作流调试输出：
```bash
# Repository Settings → Secrets → Actions
# 添加: ACTIONS_STEP_DEBUG = true
# 添加: ACTIONS_RUNNER_DEBUG = true
```

## 📚 相关文档

- [ADR-0008: 渐进发布和自动回滚策略](../docs/ADR-0008-渐进发布和自动回滚实现指南.md)
- [electron-updater Staged Rollout](https://www.electron.build/auto-update#staged-rollouts)
- [Sentry Release Health API](https://docs.sentry.io/api/releases/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## 🛡️ 安全考虑

- API 密钥使用 GitHub Secrets 存储
- 工作流使用最小权限原则
- 紧急回滚可配置需要人工批准（Environment Protection）
- 所有操作都有详细的审计日志

## 📈 性能优化

- 并行执行多平台 feed 更新
- 缓存 Node.js 依赖加速构建
- 智能等待时间：根据发布阶段调整监控间隔
- 条件执行：非工作时间跳过监控以节省计算资源
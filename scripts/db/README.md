# SQLite WAL 管理脚本

基于 ADR-0006 数据存储基线的完整 WAL 文件管理解决方案。

## 脚本概览

### 1. WAL 检查点管理 (`wal-checkpoint.mjs`)

**用途**: 执行 SQLite WAL 检查点操作，将WAL文件数据合并回主数据库

**特性**:

- 支持多种检查点模式：PASSIVE, FULL, RESTART, TRUNCATE
- 自动驱动检测 (better-sqlite3, sqlite3)
- 详细的性能和状态报告
- 智能重试机制和错误处理
- 结构化JSON日志输出

**基本用法**:

```bash
# 使用默认设置执行TRUNCATE检查点
npm run db:wal:checkpoint

# 执行特定模式的检查点
node scripts/db/wal-checkpoint.mjs ./data/app.db FULL

# 使用环境变量配置
DB_PATH=./data/app.db CHECKPOINT_MODE=TRUNCATE node scripts/db/wal-checkpoint.mjs
```

### 2. WAL 数据库备份 (`wal-backup.mjs`)

**用途**: 创建 WAL 模式数据库的一致性备份

**特性**:

- 支持 SQLite 3.27+ VACUUM INTO 快照备份
- 自动后备到传统文件复制方式
- 增量备份支持（基于修改时间）
- 自动压缩和完整性验证
- 备份文件轮转和清理

**基本用法**:

```bash
# 完整备份
npm run db:wal:backup:full

# 增量备份
npm run db:wal:backup:incremental

# 验证现有备份
npm run db:wal:verify ./backups/app-20250829.db

# 自定义配置备份
BACKUP_DIR=./my-backups COMPRESS_BACKUP=false node scripts/db/wal-backup.mjs
```

### 3. WAL 文件监控 (`wal-monitor.mjs`)

**用途**: 实时监控WAL文件大小和数据库健康状态

**特性**:

- 连续监控模式和单次检查模式
- 自动检查点触发（基于大小阈值）
- Prometheus 指标导出
- Webhook 和 Sentry 告警集成
- 历史数据记录和清理

**基本用法**:

```bash
# 单次健康检查
npm run db:wal:monitor

# 连续监控模式
npm run db:wal:monitor:continuous

# 启动指标服务器
npm run db:wal:monitor:metrics

# 自定义监控配置
WAL_SIZE_WARN=2 CHECK_INTERVAL=10 node scripts/db/wal-monitor.mjs --continuous
```

## 集成命令

### 数据库维护

```bash
# 完整数据库维护（检查点 + 增量备份）
npm run db:maintenance

# CI/CD 数据库健康检查
npm run guard:db

# 完整CI检查（包含数据库检查）
npm run guard:ci
```

## 配置参数

### 环境变量

所有脚本支持以下通用环境变量：

```bash
# 数据库文件路径
DB_PATH=./data/app.db

# WAL 大小阈值（MB）
WAL_SIZE_WARN=4
WAL_SIZE_CRITICAL=16
CHECKPOINT_THRESHOLD=8

# 备份配置
BACKUP_DIR=./backups
BACKUP_TYPE=full|incremental|verify
MAX_BACKUP_DAYS=30

# 监控配置
CHECK_INTERVAL=30
AUTO_CHECKPOINT=true
METRICS_PORT=9090

# 告警配置
ALERT_WEBHOOK=https://hooks.slack.com/...
SENTRY_DSN=https://...

# 日志级别
LOG_LEVEL=info|debug|warn|error
```

### 检查点模式说明

| 模式       | 描述                            | 使用场景                 |
| ---------- | ------------------------------- | ------------------------ |
| `PASSIVE`  | 被动模式，不等待其他连接        | 日常维护，影响最小       |
| `FULL`     | 完整模式，等待所有读者完成      | 定期维护，确保完整性     |
| `RESTART`  | 重启模式，强制新的 WAL 文件     | 性能优化，清理碎片       |
| `TRUNCATE` | 截断模式，尝试将WAL截断到零长度 | **推荐**，最大化空间回收 |

## 监控和告警

### Prometheus 指标

监控脚本导出以下指标（在 `http://localhost:9090/metrics`）：

```
sqlite_wal_size_mb                    # WAL文件大小(MB)
sqlite_db_size_mb                     # 数据库文件大小(MB)
sqlite_wal_growth_rate_mb_per_sec     # WAL增长率(MB/秒)
sqlite_checkpoint_count_total         # 执行的检查点总数
sqlite_monitor_checks_total           # 监控检查总次数
sqlite_monitor_uptime_seconds         # 监控运行时间(秒)
```

### 告警阈值

默认告警配置：

- **警告**: WAL 文件 > 4MB
- **严重**: WAL 文件 > 16MB
- **自动检查点**: WAL 文件 > 8MB
- **异常**: WAL/DB 比例 > 50%

### 日志文件位置

```
logs/
├── wal-monitor/
│   ├── metrics-2025-08-29.jsonl    # 监控数据点
│   └── metrics-2025-08-30.jsonl
└── version-sync/                    # 版本同步报告
    └── version-sync-2025-08-29.json
```

## 最佳实践

### 1. 日常运维

```bash
# 每日维护任务
0 2 * * * npm run db:maintenance

# 持续监控
npm run db:wal:monitor:continuous &

# 每周完整备份
0 0 * * 0 npm run db:wal:backup:full
```

### 2. 性能调优

```bash
# 检查 WAL 模式状态
npm run db:wal:monitor

# 如果 WAL 文件过大，执行截断检查点
npm run db:wal:checkpoint:truncate

# 分析增长趋势
npm run db:wal:monitor:metrics
# 然后访问 http://localhost:9090/metrics
```

### 3. 故障排除

**WAL 文件过大**:

```bash
# 立即执行截断检查点
npm run db:wal:checkpoint:truncate

# 检查数据库连接是否正确关闭
# 确保没有长时间运行的事务
```

**备份失败**:

```bash
# 检查磁盘空间
df -h

# 验证数据库文件完整性
npm run db:wal:verify ./backups/latest-backup.db

# 强制使用文件复制备份
VACUUM_MODE=disable npm run db:wal:backup
```

**监控告警**:

```bash
# 检查监控日志
tail -f logs/wal-monitor/metrics-$(date +%Y-%m-%d).jsonl

# 重启监控服务
pkill -f wal-monitor
npm run db:wal:monitor:continuous &
```

## 依赖要求

### 必需依赖

- Node.js >= 18.0.0
- 以下SQLite驱动之一：
  - `better-sqlite3` (推荐，同步API)
  - `sqlite3` (异步API)

### 可选依赖

- `@sentry/node` - Sentry错误报告
- Prometheus/Grafana - 指标监控和可视化

## 安全注意事项

1. **权限控制**: 确保脚本具有读写数据库文件的权限
2. **备份安全**: 备份文件包含敏感数据，需要适当的访问控制
3. **网络安全**: 监控指标端口应受防火墙保护
4. **日志隐私**: 日志文件可能包含敏感路径信息

## ADR 合规性

这些脚本实现了 ADR-0006 数据存储基线的所有要求：

- ✅ WAL 模式检查点管理
- ✅ 自动检查点配置(1000页阈值)
- ✅ VACUUM INTO 快照备份支持
- ✅ Online Backup API 后备方案
- ✅ 完整性验证和错误处理
- ✅ CI/CD 集成和质量门禁

## 故障排除和支持

如遇问题，请：

1. 检查日志文件 (`logs/wal-monitor/`)
2. 验证环境变量配置
3. 确认SQLite驱动已正确安装
4. 查看脚本输出的JSON错误信息

更多技术细节请参考各脚本文件顶部的详细注释。

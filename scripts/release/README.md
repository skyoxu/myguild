# Release Scripts - 发布脚本集合

本目录包含完整的渐进发布和自动回滚脚本，基于 ADR-0008 实现。

## 📋 脚本概览

| 脚本                           | 用途                     | 输入                 | 输出            |
| ------------------------------ | ------------------------ | -------------------- | --------------- |
| `patch-staging-percentage.mjs` | 修改分阶段发布百分比     | feed文件, 百分比     | JSON结果        |
| `auto-rollback.mjs`            | 基于Sentry的健康检查决策 | 环境变量             | JSON结果+退出码 |
| `execute-rollback.mjs`         | 执行完整回滚流程         | feed文件, 版本等     | JSON结果        |
| `rollback-feed.mjs`            | 将feed回滚到指定版本     | feed文件, 清单, 版本 | JSON结果        |
| `manage-manifest.mjs`          | 版本清单管理工具         | 命令和参数           | JSON结果        |

## 🚀 使用方式

### 通过 NPM Scripts（推荐）

```bash
# 分阶段发布
npm run release:stage:5          # 5% 发布
npm run release:stage:25         # 25% 发布
npm run release:stage:50         # 50% 发布
npm run release:stage:100        # 100% 全量发布

# 健康度检查
npm run release:health-check     # 检查并根据结果退出
npm run release:health-check:dry # 仅检查不退出失败

# 回滚操作
npm run release:rollback:emergency                    # 紧急停止
npm run release:rollback:to-version -- feed清单 版本   # 直接版本回滚

# 版本清单管理
npm run release:manifest:add -- --version=1.2.3 --path=dist/app.exe
npm run release:manifest:list                        # 列出版本
npm run release:manifest:validate                    # 验证格式
npm run release:manifest:cleanup -- --keep=5         # 清理旧版本
```

### 直接调用脚本

```bash
# 分阶段发布
node scripts/release/patch-staging-percentage.mjs dist/latest.yml 25

# 健康检查
SENTRY_AUTH_TOKEN=xxx APP_VERSION=1.2.3 node scripts/release/auto-rollback.mjs

# 完整回滚
node scripts/release/execute-rollback.mjs \
  --feed=dist/latest.yml \
  --previous-version=1.1.0 \
  --manifest=artifacts/manifest.json \
  --reason="Critical issue detected"

# 版本回滚
node scripts/release/rollback-feed.mjs dist/latest.yml artifacts/manifest.json 1.1.0

# 版本管理
node scripts/release/manage-manifest.mjs add --version=1.2.3 --path=dist/app.exe
```

## 📊 脚本详细说明

### 1. patch-staging-percentage.mjs

修改 electron-updater feed 文件的 `stagingPercentage` 字段。

```javascript
// 用法
patchStagingPercentage(feedFile, percentage);

// 示例
const result = patchStagingPercentage('dist/latest.yml', 25);
// => { ok: true, feedFile: 'dist/latest.yml', stagingPercentage: 25, timestamp: '...' }
```

**特性**：

- ✅ 支持所有 electron-updater feed 格式
- ✅ 自动创建目录和文件
- ✅ 百分比范围验证 (0-100)
- ✅ 原子操作，失败时不会损坏文件

### 2. auto-rollback.mjs

基于 Sentry Release Health 进行健康度检查和回滚决策。

```javascript
// 用法
checkReleaseHealth(version, thresholdUsers, thresholdSessions)

// 环境变量
SENTRY_AUTH_TOKEN=sntrys_xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
APP_VERSION=1.2.3
THRESHOLD_CF_USERS=0.995
THRESHOLD_CF_SESSIONS=0.995
```

**退出码**：

- `0` - 健康度通过，可继续发布
- `42` - 健康度不达标，建议回滚
- `1` - API 错误或其他失败
- `2` - 参数配置错误

**健康指标**：

- **Crash-Free Users**: 未经历崩溃的用户百分比
- **Crash-Free Sessions**: 未经历崩溃的会话百分比

### 3. execute-rollback.mjs

执行完整的回滚操作，包括紧急停止和版本回退。

```javascript
// 功能
executeRollback({
  feedFile, // feed 文件路径
  previousVersion, // 回滚目标版本（可选）
  manifestFile, // 版本清单路径（版本回退时需要）
  reason, // 回滚原因
  notify, // 是否发送通知
});
```

**两阶段回滚**：

1. **紧急停止**: 设置 `stagingPercentage=0` 立即停止新版本分发
2. **版本回退**: 将 feed 内容回滚到上一稳定版本（可选）

### 4. rollback-feed.mjs

将 electron-updater feed 文件回滚到指定版本。

```javascript
// 用法
rollbackFeed(feedFile, manifestFile, targetVersion);

// 示例
const result = rollbackFeed(
  'dist/latest.yml',
  'artifacts/manifest.json',
  '1.1.0'
);
```

**执行内容**：

- ✅ 从版本清单读取目标版本完整信息
- ✅ 更新 feed 文件的 version、path、sha512 等字段
- ✅ 设置 `stagingPercentage=0` 立即生效
- ✅ 验证版本存在和数据完整性

### 5. manage-manifest.mjs

版本清单管理工具，支持添加、列出、验证、清理版本。

```javascript
// 命令
add      // 添加新版本
list     // 列出所有版本
validate // 验证清单格式
cleanup  // 清理过期版本

// 清单格式
{
  "1.2.3": {
    "path": "app-1.2.3.exe",
    "sha512": "sha512-base64hash...",
    "size": 52428800,
    "releaseDate": "2025-08-29T10:00:00.000Z",
    "files": [...]
  }
}
```

## 🔧 环境配置

### 必需环境变量

```bash
# Sentry 配置（健康检查用）
SENTRY_AUTH_TOKEN=sntrys_xxx      # Sentry API 认证令牌
SENTRY_ORG=your-organization      # Sentry 组织名称
SENTRY_PROJECT=your-project       # Sentry 项目名称
APP_VERSION=1.2.3                 # 当前应用版本

# 健康度阈值（可选）
THRESHOLD_CF_USERS=0.995          # Crash-Free Users 阈值，默认 99.5%
THRESHOLD_CF_SESSIONS=0.995       # Crash-Free Sessions 阈值，默认 99.5%

# 回滚配置（可选）
WEBHOOK_URL=https://hooks.slack.com/xxx  # 通知 Webhook URL
ROLLBACK_LOG_DIR=logs/rollback           # 回滚日志目录，默认 logs/rollback
SENTRY_API_TIMEOUT=10000                 # API 请求超时时间(ms)，默认 10 秒
```

### 文件结构要求

```
project/
├── dist/
│   ├── latest.yml          # Windows feed 文件
│   ├── latest-mac.yml      # macOS feed 文件
│   └── latest-linux.yml    # Linux feed 文件
├── artifacts/
│   └── manifest.json       # 版本清单文件
├── logs/
│   └── rollback/          # 回滚操作日志
└── scripts/release/       # 本目录
```

## 📊 集成示例

### 1. Shell 脚本集成

```bash
#!/bin/bash
set -e

VERSION="1.2.3"
PREV_VERSION="1.1.0"

echo "🚀 开始渐进发布 $VERSION"

# 阶段 1: 5% 发布
echo "📊 阶段 1: 5% 发布"
npm run release:stage:5

# 等待数据收集
echo "⏳ 等待 10 分钟收集健康数据..."
sleep 600

# 健康检查
if ! npm run release:health-check; then
  echo "❌ 5% 阶段健康检查失败，执行回滚"
  npm run release:rollback:to-version -- dist/latest.yml artifacts/manifest.json "$PREV_VERSION"
  exit 1
fi

echo "✅ 5% 阶段健康度良好，继续下一阶段"

# 阶段 2: 25% 发布
npm run release:stage:25
# ... 继续后续阶段
```

### 2. Node.js 程序集成

```javascript
import { patchStagingPercentage } from './scripts/release/patch-staging-percentage.mjs';
import { checkReleaseHealth } from './scripts/release/auto-rollback.mjs';
import { executeRollback } from './scripts/release/execute-rollback.mjs';

async function progressiveRelease(version, stages = [5, 25, 50, 100]) {
  for (const stage of stages) {
    console.log(`🎯 发布阶段: ${stage}%`);

    // 设置分阶段百分比
    const stageResult = patchStagingPercentage('dist/latest.yml', stage);
    console.log('分阶段设置:', stageResult);

    // 等待数据收集
    await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000)); // 10分钟

    // 健康检查
    try {
      const healthResult = await checkReleaseHealth(version, 0.995, 0.995);
      if (!healthResult.pass) {
        console.log('❌ 健康检查失败，执行自动回滚');
        await executeRollback({
          feedFile: 'dist/latest.yml',
          previousVersion: 'previous-stable-version',
          manifestFile: 'artifacts/manifest.json',
          reason: `Health check failed at ${stage}% stage`,
          notify: true,
        });
        throw new Error('Release failed health check');
      }
      console.log('✅ 健康检查通过');
    } catch (error) {
      console.error('健康检查或回滚失败:', error);
      break;
    }
  }

  console.log('🎉 渐进发布完成');
}
```

### 3. CI/CD 集成（GitHub Actions）

参见 `.github/workflows/` 目录中的完整工作流示例。

## 🔍 调试和日志

### 调试模式

```bash
# 启用详细日志输出
DEBUG=release:* npm run release:stage:25

# 仅模拟执行（不实际修改文件）
DRY_RUN=true npm run release:health-check
```

### 日志文件位置

- **回滚日志**: `logs/rollback/rollback-YYYY-MM-DD.json`
- **健康检查**: 输出到 stdout/stderr
- **版本清单**: `artifacts/manifest.json`

### 日志格式

```json
{
  "action": "rollback",
  "feedFile": "dist/latest.yml",
  "previousVersion": "1.1.0",
  "reason": "Health check failed",
  "success": true,
  "steps": [...],
  "timestamp": "2025-08-29T17:45:00.000Z"
}
```

## ⚠️ 故障排除

### 常见问题

#### 1. Sentry API 认证失败

```bash
# 错误信息
❌ Request failed: Request failed with status 401

# 解决方法
# 1. 检查 SENTRY_AUTH_TOKEN 是否正确
# 2. 确认 token 具有 project:read 权限
# 3. 验证 SENTRY_ORG 和 SENTRY_PROJECT 名称
```

#### 2. 版本清单文件问题

```bash
# 错误信息
❌ Version 1.2.3 not found in manifest

# 解决方法
# 1. 使用 manage-manifest.mjs add 添加版本
# 2. 检查版本清单文件格式是否正确
# 3. 确认版本号格式符合语义化版本规范
```

#### 3. Feed 文件格式错误

```bash
# 错误信息
❌ Failed to parse YAML response

# 解决方法
# 1. 检查 YAML 文件语法是否正确
# 2. 确认文件路径存在且可读写
# 3. 验证 electron-updater feed 格式
```

#### 4. 健康数据不可用

```bash
# 错误信息
❌ Health metrics not available for release

# 解决方法
# 1. 等待更长时间让 Sentry 收集数据（5-15分钟）
# 2. 确认 Sentry Release 已正确创建
# 3. 检查应用是否正确集成 Sentry SDK
```

### 脚本测试

```bash
# 测试脚本功能（使用示例数据）
npm test                    # 运行单元测试
npm run test:integration    # 集成测试
npm run test:e2e           # 端到端测试

# 手动验证
node scripts/release/patch-staging-percentage.mjs --help
node scripts/release/manage-manifest.mjs validate
```

## 📚 参考资料

- [ADR-0008: 渐进发布和自动回滚策略](../../docs/ADR-0008-渐进发布和自动回滚实现指南.md)
- [electron-updater 文档](https://www.electron.build/auto-update)
- [Sentry Release Health API](https://docs.sentry.io/api/releases/)
- [语义化版本规范](https://semver.org/lang/zh-CN/)

## 🔒 安全注意事项

- **API 密钥安全**: 使用环境变量存储，切勿硬编码
- **权限最小化**: Sentry token 仅授予必要的读取权限
- **审计日志**: 所有回滚操作都有详细记录
- **访问控制**: 生产环境脚本执行需要适当的权限控制

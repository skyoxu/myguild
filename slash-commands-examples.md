# Claude Code Slash Commands 完整示例

## 1. 基本语法

```bash
/command-name argument1 argument2
```

## 2. $ARGUMENTS 使用示例

### 基础参数传递
```bash
# 定义命令 (在 .claude/commands/ 目录下)
# deploy.md
---
name: deploy
description: 部署应用到指定环境
---

部署应用到 $1 环境，使用配置文件 $2

bash```
npm run build
npm run deploy -- --env=$1 --config=$2
```

# 使用方式
/deploy production config/prod.json
```

### 高级参数处理
```bash
# advanced-deploy.md
---
name: advanced-deploy
description: 高级部署命令，支持多个参数
---

部署配置：
- 环境: $1
- 版本: $2  
- 功能标志: $3
- 附加选项: $ARGUMENTS[3:]

bash```
echo "部署环境: $1"
echo "版本号: $2"
echo "功能标志: $3" 
echo "其他参数: ${@:4}"

# 构建和部署
npm run build -- --env=$1 --version=$2
if [ "$3" = "true" ]; then
  npm run deploy:with-features
else
  npm run deploy:standard
fi
```

# 使用
/advanced-deploy staging v1.2.3 true --verbose --dry-run
```

## 3. Bash 预处理示例

### 条件执行
```bash
# conditional-test.md
---
name: test
description: 根据条件运行不同测试
---

运行测试套件 ($1)

bash```
if [ "$1" = "unit" ]; then
  echo "运行单元测试..."
  npm run test:unit
elif [ "$1" = "e2e" ]; then
  echo "运行端到端测试..."
  npm run test:e2e
elif [ "$1" = "all" ]; then
  echo "运行所有测试..."
  npm run test:unit && npm run test:e2e
else
  echo "未知测试类型: $1"
  echo "支持的类型: unit, e2e, all"
  exit 1
fi
```

# 使用
/test unit
/test e2e  
/test all
```

### 环境检查和设置
```bash
# setup-env.md
---
name: setup
description: 设置开发环境
---

设置 $1 开发环境

bash```
# 检查Node.js版本
NODE_VERSION=$(node --version)
echo "当前Node.js版本: $NODE_VERSION"

# 检查环境变量
if [ -z "$1" ]; then
  echo "错误: 请指定环境 (dev/staging/prod)"
  exit 1
fi

# 复制对应的环境配置
cp .env.$1 .env
echo "已设置 $1 环境配置"

# 安装依赖
npm install

# 运行环境特定的设置脚本
if [ -f "scripts/setup-$1.sh" ]; then
  bash scripts/setup-$1.sh
fi

echo "环境设置完成!"
```
```

## 4. 文件引用示例

### 直接文件包含
```bash
# analyze-code.md
---
name: analyze
description: 分析指定文件的代码质量
---

分析文件: $1

file:$1

请分析上述文件的代码质量，关注：
1. 代码复杂度
2. 潜在的bug
3. 性能问题
4. 最佳实践建议

bash```
# 运行静态分析工具
npx eslint $1
npx tsc --noEmit $1 2>/dev/null || echo "TypeScript检查完成"
```

# 使用
/analyze src/components/GameEngine.ts
```

### 多文件对比
```bash
# compare-files.md  
---
name: compare
description: 对比两个文件的差异
---

对比文件差异：$1 vs $2

## 文件1: $1
file:$1

## 文件2: $2  
file:$2

请分析这两个文件的主要差异，并提供改进建议。

bash```
# 使用git diff显示差异
git diff --no-index $1 $2 || diff -u $1 $2
```

# 使用
/compare src/old-version.js src/new-version.js
```

## 5. MCP (Model Context Protocol) 集成示例

### 数据库查询集成
```bash
# db-query.md
---
name: dbquery
description: 执行数据库查询并分析结果
---

执行数据库查询: $1

mcp:database-client```
{
  "method": "query",
  "params": {
    "sql": "$1",
    "format": "json"
  }
}
```

请分析查询结果并提供优化建议。

bash```
# 记录查询到日志
echo "执行查询: $1" >> query.log
echo "时间: $(date)" >> query.log
```

# 使用
/dbquery "SELECT * FROM users WHERE created_at > '2024-01-01'"
```

### API 测试集成
```bash
# api-test.md
---
name: apitest  
description: 测试API端点
---

测试API端点: $1

mcp:http-client```
{
  "method": "GET",
  "url": "$1",
  "headers": {
    "Authorization": "Bearer $2",
    "Content-Type": "application/json"
  }
}
```

分析API响应并检查：
1. 响应时间
2. 状态码
3. 数据结构
4. 错误处理

bash```
# 使用curl进行备用测试
curl -i -H "Authorization: Bearer $2" $1
```

# 使用  
/apitest https://api.example.com/users your-token-here
```

## 6. 复杂综合示例

### 全栈部署命令
```bash
# fullstack-deploy.md
---
name: deploy-fullstack
description: 全栈应用部署，包含前端、后端和数据库迁移
---

全栈部署到 $1 环境

## 当前项目状态
file:package.json
file:.env.$1

## 部署步骤

### 1. 数据库迁移
mcp:database-client```
{
  "method": "migrate",
  "params": {
    "environment": "$1",
    "version": "latest"
  }
}
```

### 2. 后端部署
bash```
echo "=== 后端部署 ==="
# 构建后端
npm run build:backend

# 运行测试
npm run test:backend

# 部署到云函数
if [ "$1" = "production" ]; then
  npm run deploy:backend:prod
else
  npm run deploy:backend:$1
fi
```

### 3. 前端部署  
bash```
echo "=== 前端部署 ==="
# 构建前端
npm run build:frontend -- --env=$1

# 部署到CDN
npm run deploy:frontend:$1

# 清除CDN缓存
npm run cdn:purge
```

### 4. 健康检查
mcp:http-client```
{
  "method": "GET", 
  "url": "https://$1-api.example.com/health"
}
```

bash```
# 等待服务启动
sleep 30

# 运行端到端测试
npm run test:e2e:$1

echo "=== 部署完成 ==="
echo "前端: https://$1.example.com"
echo "API: https://$1-api.example.com"
```

# 使用
/deploy-fullstack staging
/deploy-fullstack production
```

## 7. 最佳实践

### 错误处理
```bash
set -e  # 遇到错误立即退出
set -u  # 使用未定义变量时报错  
set -o pipefail  # 管道中任何命令失败都报错
```

### 参数验证
```bash
if [ $# -lt 2 ]; then
  echo "错误: 需要至少2个参数"
  echo "用法: /command arg1 arg2 [arg3...]"
  exit 1
fi
```

### 日志记录
```bash
LOG_FILE="logs/command-$(date +%Y%m%d).log"
echo "[$(date)] 执行命令: $0 $*" >> $LOG_FILE
```

这些示例展示了Slash commands的强大功能，你可以根据具体需求进行定制和组合使用。
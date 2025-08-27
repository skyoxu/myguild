# Zen MCP Server 使用指南

本项目已配置了 Zen MCP Server，提供强大的AI工具集成。

## ✅ 测试结果

**所有核心工具已成功初始化并可用！**

已验证的工具：
- **analyze** (需要模型) - 综合分析工作流
- **chat** (需要模型) - 通用聊天和协作思考
- **planner** (无需模型) - 交互式序列规划器
- **codereview** (需要模型) - 综合代码审查工作流
- **debug** (需要模型) - 调试和根因分析
- **listmodels** (无需模型) - 列出可用模型
- **version** (无需模型) - 版本信息

## 快速启动

### 检查环境
```bash
npm run zen:check
```

### 启动 Zen MCP Server
```bash
npm run zen:start
```

或直接使用脚本：
- Windows: `start-zen.bat`
- Linux/macOS: `./start-zen.sh`

## 核心工具详解

### 🎯 无需模型工具
1. **planner** - 交互式逐步规划（可独立运行）
2. **listmodels** - 查看可用AI模型
3. **version** - 查看版本信息

### 🤖 需要模型工具
1. **analyze** - 智能文件分析
2. **codereview** - 专业代码审查
3. **debug** - 专家调试助手
4. **chat** - 通用聊天和协作思考

## 使用示例

### 代码审查工作流
```
Perform a codereview using gemini pro and o3 and use planner to generate a detailed plan, implement the fixes and do a final precommit check
```

### 分析项目
```
Use analyze to understand the codebase structure and then use planner to create a development roadmap
```

## 配置

Zen MCP Server 使用以下配置：
- 位置: `./zen-mcp-server/` (符号链接到用户目录)
- 配置文件: `./zen-mcp-server/.env`
- 支持的AI模型: Gemini Pro, OpenAI GPT, XAI Grok

## 故障排除

如果遇到问题：
1. 检查Python环境: `npm run zen:check`
2. 确认API keys配置正确
3. 查看logs目录获取详细错误信息

## 注意事项

- Zen MCP Server 通过符号链接连接到用户目录的安装
- 配置和更新在用户目录统一管理
- 项目可以方便地访问所有zen工具
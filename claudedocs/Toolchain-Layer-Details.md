# 工具链层详细配置 - AI辅助开发工具集成

**层级**: Layer 4 - Toolchain  
**目标**: 构建完整的AI辅助开发工具链：Claude Code CLI + MCP服务器 + BMAD代理系统

---

## 🤖 AI工具链架构概览

### 三层工具链架构
```
🔺 BMAD 代理系统        - 专业角色代理（游戏设计师、架构师、QA等）
🔺 MCP 服务器集群        - 模型上下文协议服务（Context7、Sequential等）  
🔺 Claude Code CLI      - 核心开发环境和工具协调器
```

### 工具链集成流程
```
用户输入 → Claude Code CLI → MCP服务器调度 → BMAD代理执行 → 结果反馈
```

---

## 🌐 MCP (Model Context Protocol) 服务器配置

### `.mcp.json` - 完整MCP服务器配置
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "CONTEXT7_API_KEY": "your-context7-key"
      },
      "description": "上下文感知文档检索和代码示例服务"
    },
    "sequential-thinking": {
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": {
        "ANTHROPIC_API_KEY": "your-anthropic-key"
      },
      "description": "结构化思维和问题分解服务"
    },
    "zen-mcp-server": {
      "command": "python",
      "args": ["C:\\buildgame\\vitegame\\zen-mcp-server\\run.py"],
      "cwd": "C:\\buildgame\\vitegame\\zen-mcp-server",
      "env": {
        "ANTHROPIC_API_KEY": "your-anthropic-key",
        "PERPLEXITY_API_KEY": "your-perplexity-key",
        "OPENAI_API_KEY": "your-openai-key",
        "GOOGLE_API_KEY": "your-google-key"
      },
      "description": "综合AI分析和深度思考服务"
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\buildgame\\vitegame"],
      "description": "文件系统操作和管理服务"
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@brave/brave-search-mcp-server"],
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key"
      },
      "description": "Web搜索和实时信息检索服务"
    }
  }
}
```

### MCP服务器功能详解

#### Context7 MCP服务器
```typescript
// 使用示例：获取最新库文档
interface Context7Usage {
  // 解析库名称到Context7兼容ID
  resolveLibraryId: (libraryName: string) => Promise<string>
  
  // 获取库文档和示例
  getLibraryDocs: (context7CompatibleLibraryID: string, options?: {
    tokens?: number      // 最大token数量，默认10000
    topic?: string       // 聚焦主题，如'hooks'、'routing'
  }) => Promise<string>
}

// 典型使用流程
// 1. mcp__context7__resolve-library-id: "react"
// 2. mcp__context7__get-library-docs: "/vercel/react/v18" 
```

#### Sequential Thinking MCP服务器  
```typescript
// 使用示例：结构化问题分析
interface SequentialThinkingUsage {
  // 分步思考过程
  sequentialThinking: (params: {
    thought: string           // 当前思考步骤
    thoughtNumber: number     // 当前步骤编号（从1开始）
    totalThoughts: number     // 预估总步骤数
    nextThoughtNeeded: boolean // 是否需要继续思考
    
    // 可选的修正和分支参数
    isRevision?: boolean      // 是否修正之前的思考
    revisesThought?: number   // 修正的思考步骤编号
    branchFromThought?: number // 分支起始步骤
    branchId?: string         // 分支标识符
  }) => Promise<any>
}
```

#### Zen MCP服务器（综合AI服务）
```typescript
// 多模态AI分析服务
interface ZenMCPUsage {
  // 通用对话和协作思考
  chat: (params: {
    prompt: string
    model: string           // 'o3' | 'gemini-2.5-pro' | 'flash' 等
    temperature?: number    // 0-1，创造性程度
    files?: string[]        // 上下文文件路径
    images?: string[]       // 图像文件路径
    use_websearch?: boolean // 启用网络搜索
  }) => Promise<string>
  
  // 深度调查和推理
  thinkdeep: (params: {
    step: string
    step_number: number
    total_steps: number  
    next_step_required: boolean
    findings: string
    model: string
    thinking_mode?: 'minimal' | 'low' | 'medium' | 'high' | 'max'
  }) => Promise<any>
  
  // 代码审查工作流
  codereview: (params: {
    step: string
    relevant_files: string[]
    review_type?: 'full' | 'security' | 'performance' | 'quick'
    standards?: string
  }) => Promise<any>
  
  // 安全审计工作流
  secaudit: (params: {
    step: string
    security_scope: string
    threat_level?: 'low' | 'medium' | 'high' | 'critical'
    compliance_requirements?: string[]
  }) => Promise<any>
}
```

---

## 🎯 Claude Code CLI 集成配置

### `.claude/settings.json` - CLI配置
```json
{
  "allowedTools": [
    "Edit",
    "MultiEdit", 
    "Read",
    "Write",
    "Bash(npm *)",
    "Bash(npx *)", 
    "Bash(git *)",
    "Bash(python *)",
    "Bash(py *)",
    "Bash(task-master *)",
    "mcp__context7__*",
    "mcp__sequential-thinking__*",
    "mcp__zen-mcp-server__*",
    "mcp__filesystem__*", 
    "mcp__brave-search__*"
  ],
  "projectInstructions": "遵循五层架构模式开发，严格执行安全基线配置，使用MCP服务器增强AI能力",
  "autoCommit": false,
  "maxTokens": 200000,
  "useWebSearch": true,
  "mcpServers": [
    "context7",
    "sequential-thinking", 
    "zen-mcp-server",
    "filesystem",
    "brave-search"
  ]
}
```

### Claude Code 命令模式和最佳实践
```bash
# 启动Claude Code CLI（项目目录内）
cd /path/to/project
claude

# MCP服务器调试模式
claude --mcp-debug

# 特定MCP服务器启动
claude --mcp-only context7,zen-mcp-server

# 批量操作模式（减少交互）
claude --headless "请分析项目架构并生成文档"

# 会话恢复模式
claude --resume-session session_id

# 项目上下文预加载
claude --preload-context CLAUDE.md,.mcp.json,package.json
```

---

## 🛠️ BMAD 代理系统集成

### BMAD 系统概览
BMAD (Business Model Accelerated Development) 是一个基于角色的AI代理系统，通过slash命令在Claude Code中集成。

#### 可用BMAD Slash命令

**核心管理代理：**
```bash
/bmad-master        # 主控代理，万能任务执行器
/analyst            # 业务分析师代理  
/architect          # 软件架构师代理
/dev                # 开发工程师代理
/pm                 # 产品经理代理
/qa                 # 质量保证代理
/sm                 # 故事管理员代理
/ux-expert          # UX专家代理
```

**游戏开发专用代理：**
```bash
/game-designer      # 游戏设计师代理（Phaser专用）
/game-developer     # 游戏开发者代理（支持Phaser和Unity）  
/game-architect     # 游戏架构师代理（Unity专用）
```

### BMAD 代理工作流程
```bash
# 1. 激活代理
/game-designer

# 2. 代理问候并提供帮助信息
# "Hello! I'm your Game Designer agent. Type *help for available commands."

# 3. 使用内部命令
*help                    # 显示可用命令列表
*task                    # 执行任务（无参数显示可用任务）
*create-doc             # 创建文档（无参数显示可用模板）
*execute-checklist      # 执行检查清单  
*shard-doc              # 文档分片处理
*kb                     # 切换知识库模式
*exit                   # 退出代理模式

# 4. 执行具体任务
*create-doc game-design-document.yaml
*task implement-player-movement
*execute-checklist gameplay-checklist.md
```

### BMAD 配置文件结构
```
.claude/
├── commands/
│   ├── BMad/                    # 核心BMAD代理配置
│   │   ├── analyst.md          # 业务分析师配置
│   │   ├── architect.md        # 架构师配置  
│   │   ├── dev.md              # 开发工程师配置
│   │   ├── pm.md               # 产品经理配置
│   │   └── qa.md               # QA工程师配置
│   ├── bmad2dp/                # Phaser 2D游戏开发扩展
│   │   ├── game-designer.md    # 游戏设计师配置
│   │   └── game-developer.md   # 游戏开发者配置
│   └── bmad2du/                # Unity 2D游戏开发扩展
│       └── game-architect.md   # 游戏架构师配置
```

### BMAD 代理配置示例
```yaml
# .claude/commands/bmad2dp/game-designer.md
name: game-designer
description: "Phaser 3 游戏设计师代理，专注于游戏机制设计和用户体验"
version: "4.37.0"

role:
  identity: "资深游戏设计师，专精Phaser 3引擎"
  expertise: 
    - "游戏机制设计"
    - "关卡设计"  
    - "UI/UX设计"
    - "游戏平衡性调整"
  
tasks:
  - name: "design-game-mechanics"
    description: "设计核心游戏机制"
    template: "game-mechanics-template.yaml"
  - name: "create-level-design" 
    description: "创建关卡设计文档"
    template: "level-design-template.yaml"
  - name: "design-ui-elements"
    description: "设计游戏UI元素"
    template: "ui-design-template.yaml"

templates:
  - "game-design-document.yaml"
  - "player-progression.yaml"
  - "monetization-strategy.yaml"

checklists:
  - "game-design-checklist.md"
  - "playtesting-checklist.md"
  - "ui-ux-checklist.md"
```

---

## 🔧 工具链集成最佳实践

### MCP服务器使用策略
```typescript
// 工具链使用策略矩阵
interface ToolchainStrategy {
  // 文档和学习阶段
  documentation: {
    primary: 'context7'           // 获取最新框架文档
    secondary: 'brave-search'     // 补充信息搜索
    analysis: 'zen-mcp-server'    // 深度分析和思考
  }
  
  // 架构设计阶段  
  architecture: {
    primary: 'sequential-thinking' // 结构化设计思考
    analysis: 'zen-mcp-server'     // 深度架构分析  
    validation: 'bmad/architect'   // 架构师代理验证
  }
  
  // 开发实施阶段
  development: {
    primary: 'zen-mcp-server'      // 代码审查和分析
    gaming: 'bmad/game-developer'  // 游戏开发专业指导
    filesystem: 'filesystem'       // 文件操作管理
  }
  
  // 测试和质量阶段
  testing: {
    primary: 'zen-mcp-server'      // 安全审计和测试
    qa: 'bmad/qa'                  // QA专业流程
    security: 'zen-secaudit'       // 安全审计工作流
  }
}
```

### 典型工作流程集成
```bash
# 工作流程1：新功能开发
# Step 1: 需求分析
/pm                              # 产品经理代理分析需求
*create-doc feature-requirements.yaml

# Step 2: 技术调研  
claude "使用context7查询React 19和Phaser 3的最新文档"

# Step 3: 架构设计
/architect                       # 架构师代理设计方案
*execute-checklist architecture-checklist.md

# Step 4: 开发实施
/game-developer                  # 游戏开发者代理实施
*task implement-feature-xyz

# Step 5: 质量保证
/qa                              # QA代理测试验证
*execute-checklist testing-checklist.md
```

### 环境变量配置模板
```bash
# .env.mcp - MCP服务器环境变量
# AI服务API密钥
ANTHROPIC_API_KEY=your-anthropic-key-here
PERPLEXITY_API_KEY=your-perplexity-key-here  
OPENAI_API_KEY=your-openai-key-here
GOOGLE_API_KEY=your-google-key-here

# 专用服务API密钥
CONTEXT7_API_KEY=your-context7-key-here
BRAVE_API_KEY=your-brave-search-key-here

# BMAD系统配置
BMAD_VERSION=4.37.0
BMAD_CONFIG_PATH=.claude/commands/
BMAD_EXPANSION_PACKS=bmad2dp,bmad2du,infrastructure-devops

# MCP调试配置
MCP_DEBUG=false
MCP_LOG_LEVEL=info
MCP_TIMEOUT=30000
```

---

## 📊 工具链监控和诊断

### MCP服务器健康检查脚本
```javascript
// scripts/check_mcp_health.mjs
#!/usr/bin/env node

import { spawn } from 'child_process'
import { readFileSync } from 'fs'

async function checkMCPServers() {
  console.log('🔍 检查MCP服务器健康状态...\n')
  
  try {
    // 读取MCP配置
    const mcpConfig = JSON.parse(readFileSync('.mcp.json', 'utf-8'))
    const servers = Object.keys(mcpConfig.mcpServers || {})
    
    console.log(`📋 发现 ${servers.length} 个配置的MCP服务器:`)
    servers.forEach(server => console.log(`   - ${server}`))
    console.log()
    
    // 检查每个服务器
    const results = []
    
    for (const serverName of servers) {
      const serverConfig = mcpConfig.mcpServers[serverName]
      console.log(`🔧 检查服务器: ${serverName}`)
      
      try {
        // 尝试启动服务器进程（超时检查）
        const childProcess = spawn(serverConfig.command, serverConfig.args || [], {
          env: { ...process.env, ...serverConfig.env },
          cwd: serverConfig.cwd || process.cwd(),
          timeout: 10000
        })
        
        let output = ''
        let errorOutput = ''
        
        childProcess.stdout?.on('data', (data) => {
          output += data.toString()
        })
        
        childProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString()
        })
        
        // 等待进程启动或失败
        const exitCode = await new Promise((resolve) => {
          childProcess.on('exit', resolve)
          childProcess.on('error', () => resolve(-1))
          
          // 5秒后强制结束检查
          setTimeout(() => {
            childProcess.kill()
            resolve(0) // 假设正常启动
          }, 5000)
        })
        
        if (exitCode === 0 || exitCode === null) {
          console.log(`   ✅ ${serverName}: 健康`)
          results.push({ server: serverName, status: 'healthy' })
        } else {
          console.log(`   ❌ ${serverName}: 异常 (退出码: ${exitCode})`)
          console.log(`      错误信息: ${errorOutput}`)
          results.push({ server: serverName, status: 'unhealthy', error: errorOutput })
        }
      } catch (error) {
        console.log(`   ❌ ${serverName}: 启动失败`)
        console.log(`      错误: ${error.message}`)
        results.push({ server: serverName, status: 'failed', error: error.message })
      }
    }
    
    // 汇总结果
    const healthy = results.filter(r => r.status === 'healthy').length
    const total = results.length
    
    console.log(`\n📊 健康检查结果: ${healthy}/${total} 服务器正常`)
    
    if (healthy < total) {
      console.log('\n🚨 发现问题的服务器:')
      results.filter(r => r.status !== 'healthy').forEach(result => {
        console.log(`   - ${result.server}: ${result.status}`)
        if (result.error) {
          console.log(`     错误详情: ${result.error}`)
        }
      })
      process.exit(1)
    } else {
      console.log('\n🎉 所有MCP服务器运行正常！')
    }
    
  } catch (error) {
    console.error('💥 健康检查执行失败:', error.message)
    process.exit(1)
  }
}

checkMCPServers().catch(console.error)
```

### BMAD系统状态检查
```bash
# BMAD系统维护命令
# 检查BMAD状态
bmad status

# 更新BMAD到最新版本  
bmad update --full --ide claude-code

# 安装新的扩展包
bmad install --expansion-packs phaser-3d-game-dev

# 列出可用扩展包
bmad list:expansions

# 验证BMAD配置
bmad validate --config-path .claude/commands/
```

---

## 🚀 工具链性能优化

### MCP服务器启动优化
```json
// .mcp.json 性能优化配置
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "CONTEXT7_API_KEY": "your-key",
        "NODE_OPTIONS": "--max-old-space-size=4096" // 增加内存限制
      },
      "timeout": 30000,        // 启动超时
      "retries": 3,           // 重试次数
      "healthCheck": true     // 启用健康检查
    }
  },
  
  "performance": {
    "concurrentServers": 3,   // 并发启动的服务器数量
    "lazyStart": true,        // 延迟启动策略
    "cacheEnabled": true      // 启用结果缓存
  }
}
```

### Claude Code CLI 性能调优
```json
// .claude/settings.json 性能配置
{
  "performance": {
    "maxConcurrentOperations": 5,
    "responseTimeout": 60000,
    "retryAttempts": 3,
    "cacheStrategy": "aggressive"
  },
  
  "memory": {
    "maxContextSize": 200000,
    "contextRetention": "session",
    "garbageCollection": true
  },
  
  "network": {
    "connectionTimeout": 30000,
    "readTimeout": 120000,
    "keepAlive": true
  }
}
```

---

## 📈 工具链验证和测试

### 工具链集成测试脚本
```bash
# scripts/test_toolchain_integration.sh
#!/bin/bash

echo "🔧 开始工具链集成测试..."

# 1. MCP服务器连接测试
echo "📡 测试MCP服务器连接..."
claude --mcp-debug --test-connection

# 2. BMAD代理可用性测试
echo "🤖 测试BMAD代理可用性..."
bmad validate --all-agents

# 3. Claude Code CLI基本功能测试
echo "💻 测试Claude Code CLI基本功能..."
claude --version
claude --help

# 4. 端到端工作流测试
echo "🔄 测试端到端工作流..."
claude --headless "使用sequential thinking分析当前项目架构" --timeout 60

echo "✅ 工具链集成测试完成"
```

### 验证清单
- ✅ **MCP服务器**: 所有配置的服务器能够正常启动和响应
- ✅ **API密钥**: 所有必需的API密钥已正确配置
- ✅ **BMAD代理**: 所有slash命令可以正常激活代理
- ✅ **Claude Code CLI**: 基本命令和MCP集成正常工作
- ✅ **工作流集成**: 典型开发工作流可以无缝执行
- ✅ **性能表现**: 工具响应时间在可接受范围内
- ✅ **错误处理**: 异常情况下有合适的错误处理和恢复机制

---

**文档版本**: v1.0  
**更新日期**: 2025年8月27日  
**工具链版本**: BMAD 4.37.0 + MCP Protocol  
**依赖关系**: 依赖于前三层配置和环境变量设置
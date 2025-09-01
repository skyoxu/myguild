# BMAD 系统集成与使用

## BMAD 安装状态

- **核心系统**: bmad-method v4.37.0（已安装并可升级到v4.39.2）
- **游戏开发扩展**: Phaser 2D (bmad-2d-phaser-game-dev)
- **其他扩展**: Infrastructure DevOps 扩展包
- **Claude Code集成**: 通过自定义slash命令系统完全集成

## BMAD 工作机制

BMAD在Claude Code中通过**自定义slash命令**系统工作，而非MCP服务器。每个代理对应一个slash命令：

### 可用的BMAD Slash命令

**核心代理命令：**

- `/bmad-master` - 主控代理，万能任务执行器
- `/analyst` - 业务分析师代理
- `/architect` - 软件架构师代理
- `/dev` - 开发工程师代理
- `/pm` - 产品经理代理
- `/qa` - 质量保证代理
- `/sm` - 故事管理员代理
- `/ux-expert` - UX专家代理

**游戏开发代理命令：**

- `/game-designer` - 游戏设计师代理（Phaser专用）
- `/game-developer` - 游戏开发者代理（支持Phaser和Unity）
- `/game-architect` - 游戏架构师代理（Unity专用）

### BMAD 代理使用方法

1. **启动代理**: 输入slash命令（如`/bmad-master`）
2. **代理会激活并问候用户，提及`*help`命令**
3. **使用内部命令**: 代理激活后可使用以下内部命令：
   - `*help` - 显示可用命令列表
   - `*task` - 执行任务（无参数显示可用任务）
   - `*create-doc` - 创建文档（无参数显示可用模板）
   - `*execute-checklist` - 执行检查清单
   - `*shard-doc` - 文档分片处理
   - `*kb` - 切换知识库模式
   - `*exit` - 退出代理模式

### 典型工作流程

**游戏开发工作流：**

```bash
/game-designer     # 启动游戏设计师
*help              # 查看可用命令
*create-doc        # 查看可用模板
*task              # 查看可用任务
```

**架构设计工作流：**

```bash
/architect         # 启动架构师代理
*help              # 查看可用命令
*create-doc architecture-tmpl.yaml  # 创建架构文档
*execute-checklist architect-checklist.md  # 执行架构检查清单
```

**项目管理工作流：**

```bash
/pm                # 启动产品经理代理
*create-doc prd-tmpl.yaml  # 创建PRD文档
/sm                # 切换到故事管理员
*task create-next-story    # 创建下一个故事
```

## BMAD 文件结构

- **命令定义**: `.claude/commands/BMad/`, `.claude/commands/bmad2dp/`, `.claude/commands/bmad2du/`
- **代理配置**: 每个代理都有完整的YAML配置，包含角色定义、命令和依赖
- **任务库**: 15+个预定义任务（create-doc, execute-checklist, shard-doc等）
- **模板库**: 8+个文档模板（prd-tmpl, architecture-tmpl等）
- **检查清单**: 5+个质量检查清单（architect-checklist, pm-checklist等）

## BMAD 维护命令

```bash
# 检查BMAD状态
bmad status

# 升级BMAD到最新版本
bmad update --full --ide claude-code

# 安装新的扩展包
bmad install --expansion-packs <pack-name>

# 列出可用扩展包
bmad list:expansions
```

## 重要提醒

- BMAD代理在被激活时会**完全接管对话**，按照其角色定义工作
- 每个代理有**独立的工作流程**和**专门的任务集**
- 使用`*exit`命令退出代理模式返回正常Claude Code对话
- 代理配置文件位于`.claude/commands/`，可以自定义和扩展

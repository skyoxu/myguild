#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将Zen MCP生成的任务转换为Task Master标准格式并落盘
"""

import json
import os
from typing import List, Dict, Any
from pathlib import Path

def convert_zen_tasks_to_taskmaster():
    """
    将从Zen MCP生成的任务转换为Task Master的标准格式
    """
    
    # Zen MCP生成的50个任务 (从上面的回复中提取)
    zen_tasks = [
        {
            "id": "T-0001",
            "title": "初始化 Electron + Vite + React19 + TypeScript 项目骨架",
            "desc": "使用 `npm create electron@latest` 并整合 Vite + React 19 + TypeScript 模板，建立跨平台桌面应用基础。确保：① 主进程与渲染进程代码隔离；② ts-config 配置为 strict；③ vite 打包目标为 `electron-renderer`；④ 热重载可在开发模式下生效；⑤ README 中记录启动、调试、打包命令。",
            "status": "todo",
            "owner": "",
            "labels": ["electron", "vite", "react", "typescript", "scaffold"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "运行 `npm run dev` 可见空白窗口并在浏览器控制台输出 \"Hello Guild Manager\"",
                "更改 React 组件代码自动热刷新",
                "打包 `npm run make` 生成平台可执行文件"
            ]
        },
        {
            "id": "T-0002",
            "title": "配置 ESLint + Prettier + Husky 提交钩子",
            "desc": "统一代码风格。集成 eslint (airbnb-typescript), prettier, lint-staged, husky。提交前自动格式化 & lint；CI 阶段阻止未通过检查的提交。",
            "status": "todo",
            "owner": "",
            "labels": ["eslint", "prettier", "husky", "ci"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "执行 `npm run lint` 无错误",
                "git commit 时触发 lint-staged 并自动修复格式",
                "CI fail 当 eslint error>0"
            ]
        },
        {
            "id": "T-0003",
            "title": "引入 TailwindCSS 并配置与 Electron/React 联动",
            "desc": "通过 PostCSS 插件将 TailwindCSS 编译进渲染进程，支持 JIT；在 `tailwind.config.ts` 中开启暗黑模式 class；提供示例按钮组件演示。",
            "status": "todo",
            "owner": "",
            "labels": ["tailwind", "react", "vite"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "组件切换 dark/light class 生效",
                "生产构建文件大小统计 Tailwind 样式树摇成功 (<30kb gz)"
            ]
        },
        {
            "id": "T-0004",
            "title": "设置 Zustand 全局状态管理框架",
            "desc": "安装 Zustand + middleware。创建 `src/store/index.ts` 暴露根 store，包括 UI 状态与游戏状态占位。集成 devtools 插件，仅在开发环境启用。",
            "status": "todo",
            "owner": "",
            "labels": ["zustand", "state-management", "typescript"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "可在 React 组件中调用 `useStore` 返回状态",
                "Redux DevTools 插件能实时观察状态"
            ]
        },
        {
            "id": "T-0005",
            "title": "SQLite 数据库初始化与 node-better-sqlite3 驱动封装",
            "desc": "选择 `better-sqlite3` 作为同步驱动。封装 `db.ts`：① 负责创建/打开 `guild_manager.db`; ② 提供 `run`, `get`, `all` typed helpers；③ 日志拦截查询耗时(>50ms)；④ 处理数据库文件路径（用户数据目录）。",
            "status": "todo",
            "owner": "",
            "labels": ["sqlite", "node", "backend", "typescript"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "首次启动自动创建数据库文件",
                "执行示例 query 成功插入并读取"
            ]
        },
        {
            "id": "T-0006",
            "title": "实现数据库版本迁移系统",
            "desc": "使用 `electron-db-migrate` 或自研脚本管理 schema 升级。`migrations/` 目录放置 .sql 文件，版本号递增。启动时检测 `PRAGMA user_version` 并按需执行。记录迁移日志到 table `migration_history`。",
            "status": "todo",
            "owner": "",
            "labels": ["sqlite", "migration", "backend"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "向数据库添加新列后自动迁移成功",
                "回滚逻辑(降级)记录提示而非执行"
            ]
        },
        {
            "id": "T-0007",
            "title": "设计基础数据表 schema",
            "desc": "创建 `guilds`, `members`, `events`, `finances`, `stats` 五张核心表。字段设计满足公会、角色、事件池、财务流水、统计快照需求。附加索引：guild_id, member_id, created_at。",
            "status": "todo",
            "owner": "",
            "labels": ["sqlite", "schema-design"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "`PRAGMA foreign_keys` 为 ON",
                "ER 图附件更新到 /docs/"
            ]
        },
        {
            "id": "T-0008",
            "title": "搭建 IPC 通道封装层",
            "desc": "在主进程 `ipcHandlers.ts` 中集中注册数据库/系统操作；在渲染进程用 `@electron/remote` 进行调用，封装为 `invoke('guild:create', payload)` 样式，返回 promise。",
            "status": "todo",
            "owner": "",
            "labels": ["electron", "ipc", "typescript"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "阻止未注册通道访问",
                "渲染进程创建公会并持久化成功"
            ]
        },
        {
            "id": "T-0009",
            "title": "Phaser 3 引擎集成到 React 组件",
            "desc": "在 `GameCanvas` 组件中创建 Phaser.Game 实例，将 React props 作为 Scene 数据传入。配置 WebGL 渲染，动态 resize；打包时分离 phaser 到单独 chunk。",
            "status": "todo",
            "owner": "",
            "labels": ["phaser", "react", "typescript", "game"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "页面出现蓝色背景示例 Scene",
                "窗口大小调整后 Canvas 填充"
            ]
        },
        {
            "id": "T-0010",
            "title": "实现游戏主循环与时间管理",
            "desc": "在 Phaser Scene 中实现 `update()` 钩子，控制游戏内一天=60秒。提供暂停、快进 4x 速率控制。与 Zustand 状态同步当前游戏时间。",
            "status": "todo",
            "owner": "",
            "labels": ["phaser", "game-loop", "typescript"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "UI 显示 00:00 -> 23:59 循环",
                "快进时 update 频率正常加速"
            ]
        },
        # 任务 11-50：继续添加剩余的40个任务
        {
            "id": "T-0011",
            "title": "设计和实现游戏事件系统",
            "desc": "创建事件驱动架构，包含事件总线、事件监听器和事件处理器。支持公会事件、成员事件、任务事件等类型。设计事件优先级队列和异步处理机制。",
            "status": "todo",
            "owner": "",
            "labels": ["event-system", "architecture", "typescript"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "事件可以被正确发布和监听",
                "事件处理支持异步操作",
                "事件系统具有良好的性能表现"
            ]
        },
        {
            "id": "T-0012",
            "title": "实现公会管理核心功能",
            "desc": "开发公会创建、编辑、删除功能。包含公会基本信息管理、成员权限系统、公会设置配置。提供公会搜索和筛选功能。",
            "status": "todo",
            "owner": "",
            "labels": ["guild", "management", "react", "typescript"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "可以创建和管理公会",
                "权限系统正常工作",
                "搜索功能响应及时"
            ]
        },
        {
            "id": "T-0013",
            "title": "开发成员管理系统",
            "desc": "实现公会成员的添加、移除、角色分配功能。包含成员信息展示、活跃度统计、贡献度计算。支持批量操作和成员搜索。",
            "status": "todo",
            "owner": "",
            "labels": ["member", "management", "database"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "成员操作功能完整",
                "数据统计准确",
                "批量操作性能良好"
            ]
        },
        {
            "id": "T-0014",
            "title": "构建财务管理模块",
            "desc": "开发公会财务收支管理、预算制定、财务报表生成功能。包含收入来源追踪、支出分类统计、资金流向分析。",
            "status": "todo",
            "owner": "",
            "labels": ["finance", "reporting", "analytics"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "财务数据记录准确",
                "报表生成正确",
                "数据可视化效果良好"
            ]
        },
        {
            "id": "T-0015",
            "title": "设计用户界面组件库",
            "desc": "基于Tailwind CSS和React创建可复用的UI组件库。包含按钮、表单、模态框、数据表格、图表等常用组件。确保组件的可访问性和响应式设计。",
            "status": "todo",
            "owner": "",
            "labels": ["ui", "components", "tailwind", "accessibility"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "组件库功能完整",
                "支持响应式设计",
                "满足可访问性标准"
            ]
        },
        {
            "id": "T-0016",
            "title": "实现数据可视化dashboard",
            "desc": "创建交互式仪表板展示公会关键指标。包含成员活跃度图表、财务趋势分析、任务完成情况统计。使用Chart.js或D3.js实现动态图表。",
            "status": "todo",
            "owner": "",
            "labels": ["dashboard", "charts", "analytics", "visualization"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "图表显示数据准确",
                "交互性良好",
                "性能满足要求"
            ]
        },
        {
            "id": "T-0017",
            "title": "开发任务分配系统",
            "desc": "实现公会内部任务创建、分配、跟踪功能。包含任务优先级管理、进度追踪、完成度统计。支持任务模板和批量分配。",
            "status": "todo",
            "owner": "",
            "labels": ["task", "assignment", "tracking", "workflow"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "任务管理功能齐全",
                "进度追踪准确",
                "模板系统易用"
            ]
        },
        {
            "id": "T-0018",
            "title": "构建通知系统",
            "desc": "开发应用内通知和系统提醒功能。包含消息推送、邮件通知、桌面提醒。支持通知优先级和用户偏好设置。",
            "status": "todo",
            "owner": "",
            "labels": ["notification", "messaging", "electron", "settings"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "通知功能正常工作",
                "用户设置生效",
                "消息送达及时"
            ]
        },
        {
            "id": "T-0019",
            "title": "实现搜索和筛选功能",
            "desc": "开发全局搜索功能，支持公会、成员、任务的快速查找。包含高级筛选、搜索历史、智能建议。使用ElasticSearch或本地索引。",
            "status": "todo",
            "owner": "",
            "labels": ["search", "filter", "indexing", "performance"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "搜索结果准确快速",
                "筛选功能完整",
                "智能建议有用"
            ]
        },
        {
            "id": "T-0020",
            "title": "开发报告生成系统",
            "desc": "实现各类报告的自动生成功能。包含活动报告、财务报告、成员报告。支持PDF导出、定时生成、邮件发送。",
            "status": "todo",
            "owner": "",
            "labels": ["reports", "pdf", "automation", "scheduling"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "报告生成准确",
                "PDF格式正确",
                "定时任务稳定"
            ]
        },
        {
            "id": "T-0021",
            "title": "实现用户设置和偏好",
            "desc": "开发用户个人设置管理功能。包含主题切换、语言选择、通知偏好、显示选项。支持设置导入导出和云端同步。",
            "status": "todo",
            "owner": "",
            "labels": ["settings", "preferences", "theming", "i18n"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "设置保存正确",
                "主题切换流畅",
                "同步功能稳定"
            ]
        },
        {
            "id": "T-0022",
            "title": "构建权限和角色系统",
            "desc": "实现基于角色的权限控制系统。包含角色定义、权限分配、访问控制。支持自定义角色和权限继承。",
            "status": "todo",
            "owner": "",
            "labels": ["permission", "rbac", "security", "authorization"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "权限控制有效",
                "角色管理灵活",
                "安全性得到保障"
            ]
        },
        {
            "id": "T-0023",
            "title": "开发数据备份和恢复",
            "desc": "实现数据库备份、数据导出导入、灾难恢复功能。支持自动备份、增量备份、云端存储备份。",
            "status": "todo",
            "owner": "",
            "labels": ["backup", "recovery", "database", "cloud"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "备份功能可靠",
                "恢复过程顺利",
                "数据完整性保证"
            ]
        },
        {
            "id": "T-0024",
            "title": "实现插件系统架构",
            "desc": "设计可扩展的插件系统，支持第三方功能扩展。包含插件API、插件管理、热插拔、安全沙箱。",
            "status": "todo",
            "owner": "",
            "labels": ["plugins", "extensibility", "api", "sandbox"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "插件系统稳定",
                "API设计合理",
                "安全机制有效"
            ]
        },
        {
            "id": "T-0025",
            "title": "开发API接口文档",
            "desc": "创建完整的API文档和开发者指南。包含接口规范、示例代码、SDK开发、测试工具。",
            "status": "todo",
            "owner": "",
            "labels": ["api", "documentation", "sdk", "developer"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "文档内容完整准确",
                "示例代码可运行",
                "开发者体验良好"
            ]
        },
        {
            "id": "T-0026",
            "title": "构建性能监控系统",
            "desc": "实现应用性能监控、错误追踪、用户行为分析。包含性能指标收集、异常报告、分析报告生成。",
            "status": "todo",
            "owner": "",
            "labels": ["monitoring", "performance", "analytics", "tracking"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "监控数据准确",
                "异常及时捕获",
                "分析报告有用"
            ]
        },
        {
            "id": "T-0027",
            "title": "实现多语言国际化",
            "desc": "添加多语言支持，包含文本翻译、日期格式、数字格式、RTL布局支持。使用react-i18next实现动态语言切换。",
            "status": "todo",
            "owner": "",
            "labels": ["i18n", "localization", "translation", "rtl"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "语言切换正常",
                "翻译内容完整",
                "格式显示正确"
            ]
        },
        {
            "id": "T-0028",
            "title": "开发离线功能支持",
            "desc": "实现应用离线工作能力。包含数据缓存、离线存储、同步机制、冲突解决。使用Service Worker和IndexedDB。",
            "status": "todo",
            "owner": "",
            "labels": ["offline", "sync", "cache", "indexeddb"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "离线功能正常",
                "数据同步准确",
                "冲突处理合理"
            ]
        },
        {
            "id": "T-0029",
            "title": "构建单元测试套件",
            "desc": "为所有核心模块编写全面的单元测试。使用Jest/Vitest框架，包含模拟数据、异步测试、边界案例。目标覆盖率≥90%。",
            "status": "todo",
            "owner": "",
            "labels": ["testing", "unit-tests", "jest", "coverage"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "测试覆盖率达标",
                "测试用例全面",
                "测试运行稳定"
            ]
        },
        {
            "id": "T-0030",
            "title": "开发集成测试框架",
            "desc": "构建端到端测试套件，使用Playwright测试用户工作流。包含UI测试、数据库测试、API测试。",
            "status": "todo",
            "owner": "",
            "labels": ["testing", "e2e", "playwright", "integration"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "E2E测试通过",
                "测试场景完整",
                "测试报告清晰"
            ]
        },
        {
            "id": "T-0031",
            "title": "实现安全性加固",
            "desc": "加强应用安全防护，包含输入验证、XSS防护、CSRF保护、安全头设置。进行安全测试和漏洞扫描。",
            "status": "todo",
            "owner": "",
            "labels": ["security", "validation", "xss", "csrf"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "安全测试通过",
                "漏洞修复完成",
                "防护机制有效"
            ]
        },
        {
            "id": "T-0032",
            "title": "优化应用性能",
            "desc": "进行全面性能优化，包含代码分割、懒加载、缓存策略、数据库优化。使用性能分析工具识别瓶颈。",
            "status": "todo",
            "owner": "",
            "labels": ["performance", "optimization", "caching", "profiling"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "启动时间 <3秒",
                "页面响应 <200ms",
                "内存使用合理"
            ]
        },
        {
            "id": "T-0033",
            "title": "设计错误处理机制",
            "desc": "实现全局错误处理、异常捕获、错误报告系统。包含错误边界、重试机制、优雅降级。",
            "status": "todo",
            "owner": "",
            "labels": ["error-handling", "resilience", "recovery", "logging"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "错误捕获完整",
                "恢复机制有效",
                "用户体验友好"
            ]
        },
        {
            "id": "T-0034",
            "title": "构建CI/CD流水线",
            "desc": "设置持续集成和部署流程。包含代码检查、自动测试、构建打包、发布部署。使用GitHub Actions或Jenkins。",
            "status": "todo",
            "owner": "",
            "labels": ["ci-cd", "automation", "deployment", "github-actions"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "CI流程稳定运行",
                "自动化测试通过",
                "部署过程可靠"
            ]
        },
        {
            "id": "T-0035",
            "title": "实现日志管理系统",
            "desc": "设计结构化日志记录系统。包含日志级别、日志轮转、远程日志收集、日志分析。",
            "status": "todo",
            "owner": "",
            "labels": ["logging", "monitoring", "analysis", "structured"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "日志记录完整",
                "日志格式统一",
                "分析功能有用"
            ]
        },
        {
            "id": "T-0036",
            "title": "开发数据迁移工具",
            "desc": "创建数据导入导出工具，支持从其他公会管理工具迁移数据。包含格式转换、数据验证、批量处理。",
            "status": "todo",
            "owner": "",
            "labels": ["migration", "data-import", "conversion", "validation"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "迁移功能正常",
                "数据准确完整",
                "处理速度满意"
            ]
        },
        {
            "id": "T-0037",
            "title": "构建帮助和文档系统",
            "desc": "创建在线帮助系统和用户文档。包含操作指南、常见问题、视频教程、搜索功能。",
            "status": "todo",
            "owner": "",
            "labels": ["documentation", "help", "tutorial", "search"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "文档内容完整",
                "搜索功能有效",
                "用户反馈良好"
            ]
        },
        {
            "id": "T-0038",
            "title": "实现主题和样式系统",
            "desc": "开发可定制的主题系统，支持深色/浅色模式、自定义颜色、字体大小调节。使用CSS变量和Tailwind Dark模式。",
            "status": "todo",
            "owner": "",
            "labels": ["theming", "dark-mode", "customization", "accessibility"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "主题切换流畅",
                "自定义选项丰富",
                "可访问性良好"
            ]
        },
        {
            "id": "T-0039",
            "title": "开发移动端适配",
            "desc": "优化移动设备访问体验，实现响应式设计。包含触摸操作、移动导航、离线支持。",
            "status": "todo",
            "owner": "",
            "labels": ["mobile", "responsive", "touch", "navigation"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "移动体验良好",
                "触摸操作自然",
                "布局适应性强"
            ]
        },
        {
            "id": "T-0040",
            "title": "构建WebSocket实时通信",
            "desc": "实现实时数据同步和消息推送。包含WebSocket连接管理、断线重连、消息队列、状态同步。",
            "status": "todo",
            "owner": "",
            "labels": ["websocket", "realtime", "sync", "messaging"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "实时同步正常",
                "连接稳定可靠",
                "消息传递及时"
            ]
        },
        {
            "id": "T-0041",
            "title": "实现快捷键和热键",
            "desc": "添加键盘快捷键支持，提高操作效率。包含全局快捷键、上下文快捷键、快捷键定制。",
            "status": "todo",
            "owner": "",
            "labels": ["keyboard", "shortcuts", "hotkeys", "accessibility"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "快捷键响应及时",
                "定制功能完整",
                "无冲突问题"
            ]
        },
        {
            "id": "T-0042",
            "title": "开发数据分析模块",
            "desc": "实现高级数据分析功能。包含趋势分析、预测模型、异常检测、数据挖掘。使用机器学习算法。",
            "status": "todo",
            "owner": "",
            "labels": ["analytics", "ml", "prediction", "data-mining"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "分析结果准确",
                "预测模型有效",
                "异常检测灵敏"
            ]
        },
        {
            "id": "T-0043",
            "title": "构建自动化测试平台",
            "desc": "建立自动化测试平台，包含测试用例管理、自动执行、结果报告、回归测试。",
            "status": "todo",
            "owner": "",
            "labels": ["automation", "testing", "regression", "reporting"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "测试执行自动化",
                "报告内容详细",
                "回归测试有效"
            ]
        },
        {
            "id": "T-0044",
            "title": "实现版本控制和发布",
            "desc": "建立版本管理系统，包含版本号管理、发布说明、回滚机制、A/B测试支持。",
            "status": "todo",
            "owner": "",
            "labels": ["versioning", "release", "rollback", "ab-testing"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "版本管理清晰",
                "发布流程顺畅",
                "回滚机制可靠"
            ]
        },
        {
            "id": "T-0045",
            "title": "开发系统监控dashboard",
            "desc": "创建系统监控界面，显示应用健康状态、性能指标、错误率、用户活跃度等关键指标。",
            "status": "todo",
            "owner": "",
            "labels": ["monitoring", "dashboard", "metrics", "health"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "监控数据实时更新",
                "指标展示清晰",
                "告警机制有效"
            ]
        },
        {
            "id": "T-0046",
            "title": "构建容器化部署方案",
            "desc": "使用Docker容器化应用，包含容器镜像构建、编排配置、环境管理、扩展部署。",
            "status": "todo",
            "owner": "",
            "labels": ["docker", "containerization", "deployment", "orchestration"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "容器运行正常",
                "部署过程自动化",
                "扩展性良好"
            ]
        },
        {
            "id": "T-0047",
            "title": "实现数据加密和安全",
            "desc": "加强数据安全保护，包含数据加密、密钥管理、访问控制、安全审计。符合数据保护法规要求。",
            "status": "todo",
            "owner": "",
            "labels": ["encryption", "security", "compliance", "audit"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "数据加密完整",
                "安全审计通过",
                "合规要求满足"
            ]
        },
        {
            "id": "T-0048",
            "title": "开发用户反馈系统",
            "desc": "创建用户反馈收集和处理系统。包含反馈表单、问题追踪、优先级管理、响应机制。",
            "status": "todo",
            "owner": "",
            "labels": ["feedback", "support", "tracking", "communication"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "反馈收集便捷",
                "处理流程高效",
                "用户满意度高"
            ]
        },
        {
            "id": "T-0049",
            "title": "构建知识库和培训",
            "desc": "建立内部知识库和用户培训系统。包含操作文档、最佳实践、培训课程、认证考试。",
            "status": "todo",
            "owner": "",
            "labels": ["knowledge-base", "training", "documentation", "certification"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "知识库内容丰富",
                "培训效果良好",
                "认证体系完整"
            ]
        },
        {
            "id": "T-0050",
            "title": "实现最终系统集成和部署",
            "desc": "完成整个系统的最终集成、性能调优、生产部署。包含系统测试、用户验收、上线部署、运维监控。",
            "status": "todo",
            "owner": "",
            "labels": ["integration", "deployment", "production", "maintenance"],
            "adrRefs": [],
            "archRefs": [],
            "overlay": "",
            "acceptance": [
                "系统集成成功",
                "性能达到要求",
                "生产环境稳定运行"
            ]
        }
    ]
    
    # 添加依赖关系 (基于任务的逻辑顺序)
    dependencies = {
        # 基础设施层 (1-10)
        "T-0002": ["T-0001"],  # ESLint配置依赖项目骨架
        "T-0003": ["T-0001"],  # Tailwind依赖项目骨架
        "T-0004": ["T-0001"],  # Zustand依赖项目骨架
        "T-0005": ["T-0001"],  # SQLite依赖项目骨架
        "T-0006": ["T-0005"],  # 迁移系统依赖数据库初始化
        "T-0007": ["T-0006"],  # Schema设计依赖迁移系统
        "T-0008": ["T-0005"],  # IPC依赖数据库
        "T-0009": ["T-0001"],  # Phaser依赖项目骨架
        "T-0010": ["T-0009", "T-0004"],  # 游戏循环依赖Phaser和状态管理
        
        # 核心功能层 (11-25)
        "T-0011": ["T-0008", "T-0004"],  # 事件系统依赖IPC和状态管理
        "T-0012": ["T-0007", "T-0011"],  # 公会管理依赖数据库schema和事件系统
        "T-0013": ["T-0012"],  # 成员管理依赖公会管理
        "T-0014": ["T-0012"],  # 财务管理依赖公会管理
        "T-0015": ["T-0003"],  # UI组件库依赖Tailwind
        "T-0016": ["T-0015", "T-0014"],  # Dashboard依赖UI组件和财务数据
        "T-0017": ["T-0013", "T-0011"],  # 任务分配依赖成员管理和事件系统
        "T-0018": ["T-0008"],  # 通知系统依赖IPC
        "T-0019": ["T-0012", "T-0013"],  # 搜索功能依赖公会和成员数据
        "T-0020": ["T-0014", "T-0016"],  # 报告生成依赖财务和仪表板
        "T-0021": ["T-0008"],  # 用户设置依赖IPC
        "T-0022": ["T-0013"],  # 权限系统依赖成员管理
        "T-0023": ["T-0007"],  # 数据备份依赖数据库schema
        "T-0024": ["T-0008"],  # 插件系统依赖IPC
        "T-0025": ["T-0024"],  # API文档依赖插件系统
        
        # 高级功能层 (26-35)
        "T-0026": ["T-0010"],  # 性能监控依赖游戏循环
        "T-0027": ["T-0015"],  # 国际化依赖UI组件
        "T-0028": ["T-0007"],  # 离线功能依赖数据库
        "T-0029": ["T-0012", "T-0013", "T-0014"],  # 单元测试依赖核心功能
        "T-0030": ["T-0015", "T-0016"],  # 集成测试依赖UI
        "T-0031": ["T-0022"],  # 安全加固依赖权限系统
        "T-0032": ["T-0026"],  # 性能优化依赖监控
        "T-0033": ["T-0026"],  # 错误处理依赖监控
        "T-0034": ["T-0029", "T-0030"],  # CI/CD依赖测试
        "T-0035": ["T-0026"],  # 日志系统依赖监控
        
        # 部署和运维层 (36-45)
        "T-0036": ["T-0023"],  # 数据迁移依赖备份系统
        "T-0037": ["T-0025"],  # 帮助文档依赖API文档
        "T-0038": ["T-0027"],  # 主题系统依赖国际化
        "T-0039": ["T-0038"],  # 移动端适配依赖主题系统
        "T-0040": ["T-0018"],  # WebSocket依赖通知系统
        "T-0041": ["T-0021"],  # 快捷键依赖用户设置
        "T-0042": ["T-0016"],  # 数据分析依赖仪表板
        "T-0043": ["T-0030"],  # 自动化测试依赖集成测试
        "T-0044": ["T-0034"],  # 版本控制依赖CI/CD
        "T-0045": ["T-0035"],  # 系统监控依赖日志系统
        
        # 最终集成层 (46-50)
        "T-0046": ["T-0034"],  # 容器化依赖CI/CD
        "T-0047": ["T-0031"],  # 数据加密依赖安全加固
        "T-0048": ["T-0037"],  # 用户反馈依赖帮助文档
        "T-0049": ["T-0048"],  # 知识库依赖用户反馈
        "T-0050": ["T-0044", "T-0045", "T-0046", "T-0047"]  # 最终集成依赖所有核心系统
    }
    
    # 转换为Task Master标准格式
    taskmaster_tasks = []
    for task in zen_tasks:
        # 转换格式
        tm_task = {
            "id": task["id"],
            "title": task["title"],
            "description": task["desc"],  # 将desc改为description
            "status": "pending",  # 将todo改为pending
            "priority": "medium",  # 添加默认优先级
            "dependencies": dependencies.get(task["id"], []),  # 添加依赖关系
            "details": task["desc"],  # 添加实现细节
            "testStrategy": task.get("acceptance", []),  # 将acceptance作为测试策略
            "subtasks": [],
            # Task Master扩展字段
            "labels": task.get("labels", []),
            "adrRefs": task.get("adrRefs", []),
            "archRefs": task.get("archRefs", []),
            "overlay": task.get("overlay", ""),
            "acceptance": task.get("acceptance", [])
        }
        taskmaster_tasks.append(tm_task)
    
    return taskmaster_tasks

def save_to_taskmaster_format(tasks: List[Dict[str, Any]]):
    """
    保存任务到Task Master格式的JSON文件
    """
    # 确保目录存在
    taskmaster_dir = Path(".taskmaster/tasks")
    taskmaster_dir.mkdir(parents=True, exist_ok=True)
    
    # 保存为tasks.json
    output_file = taskmaster_dir / "tasks.json"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(tasks, f, ensure_ascii=False, indent=2)
    
    print(f"成功保存 {len(tasks)} 个任务到: {output_file}")
    return str(output_file)

def main():
    """
    主函数：执行任务转换和保存
    """
    print("=== 开始转换 Zen MCP 任务为 Task Master 格式 ===")
    
    # 转换任务
    tasks = convert_zen_tasks_to_taskmaster()
    print(f"转换完成: {len(tasks)} 个任务")
    
    # 保存到文件
    output_file = save_to_taskmaster_format(tasks)
    
    # 验证保存成功
    if os.path.exists(output_file):
        with open(output_file, 'r', encoding='utf-8') as f:
            saved_tasks = json.load(f)
        print(f"验证成功: 文件包含 {len(saved_tasks)} 个任务")
        
        # 输出前几个任务的ID用于验证
        print("已保存任务ID:")
        for task in saved_tasks[:5]:
            print(f"  - {task['id']}: {task['title']}")
        if len(saved_tasks) > 5:
            print(f"  ... 以及其他 {len(saved_tasks) - 5} 个任务")
    
    print("=== 转换完成 ===")

if __name__ == "__main__":
    main()
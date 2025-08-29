#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将Zen MCP生成的任务转换为TaskMaster格式
Converts Zen MCP generated tasks to TaskMaster format
"""

import json
import os
from datetime import datetime
import re

def parse_zen_tasks_to_taskmaster():
    """
    解析Zen MCP生成的任务文本，转换为TaskMaster JSON格式
    """
    
    # Zen MCP生成的任务数据
    zen_tasks_text = """
【任务 1】  
标题：初始化代码仓库与版本管理  
描述：建立项目代码仓库，包括README、.gitignore及基本的版本管理规范。  
实现细节：  
• 使用 Git 创建远程/本地仓库；  
• 配置.gitignore文件忽略 node_modules、构建产物等；  
• 编写初步项目描述文件。  
测试策略：检出仓库后进行克隆、拉取和基本提交操作验证版本管理是否正常。  
优先级：high

【任务 2】  
标题：搭建基础项目结构  
描述：设计并创建符合Electron+React+TypeScript项目的目录结构，涵盖主进程、渲染器和共享模块。  
实现细节：  
• 创建src目录，细分为main、renderer、shared；  
• 编写示例模块作为接口定义。  
测试策略：检查各目录与模块加载是否符合预期，无路径引用错误。  
优先级：high

【任务 3】  
标题：配置TypeScript编译环境  
描述：设置TypeScript配置，确保代码静态类型检查，支持ES6以上特性。  
实现细节：  
• 编写tsconfig.json，包含编译选项、路径别名、严格模式；  
• 在各模块中加入简单示例类型检查。  
测试策略：编写并编译测试代码，确保无类型错误；在CI中加入tsc检查。  
优先级：high

【任务 4】  
标题：搭建Electron主进程基础框架  
描述：开发Electron主进程入口，配置窗口创建、生命周期管理。  
实现细节：  
• 编写主进程入口文件，调用BrowserWindow；  
• 设置窗口大小、菜单、事件监听；  
• 整合开发、生产环境判断。  
测试策略：运行Electron应用，验证窗口能正常启动并响应最基本输入（例如关闭事件）。  
优先级：high

【任务 5】  
标题：设置React渲染入口并集成TypeScript  
描述：创建React应用入口，集成热更新和TypeScript支持。  
实现细节：  
• 在renderer目录中创建入口组件；  
• 配置Webpack（或其他打包工具）支持React、TypeScript及HMR；  
• 初步UI可展示欢迎页面。  
测试策略：启动开发模式，验证页面渲染正常，类型检查无异常。  
优先级：high

【任务 6】  
标题：安装与配置项目依赖  
描述：安装Electron、React、Phaser、SQLite及其他必需模块，配置其基本工作环境。  
实现细节：  
• 使用npm或yarn安装依赖包；  
• 编写基本依赖配置文档；  
• 在项目文档中记录版本信息及更新日志。  
测试策略：依次启动各模块（如Electron、React渲染器）验证依赖加载是否无错误。  
优先级：high

【任务 7】  
标题：集成并配置SQLite数据库  
描述：在项目中集成SQLite，设计与测试基础数据库连接和CRUD操作。  
实现细节：  
• 选择合适的SQLite库（例如sqlite3或better-sqlite3）；  
• 配置数据库初始化流程、数据目录路径、安全读写策略；  
• 编写简单的CRUD示例。  
测试策略：编写单元测试验证基本的增删改查操作；模拟异常输入。  
优先级：high

【任务 8】  
标题：接入Phaser游戏引擎  
描述：在React环境内集成Phaser，实现基本画布渲染及游戏状态初始化。  
实现细节：  
• 新建Phaser子模块，并嵌入React组件内部；  
• 设定基础的Phaser配置信息（canvas尺寸、场景等）；  
• 确保引擎能响应渲染生命周期。  
测试策略：加载渲染后，通过截图或状态检测验证画面元素正确呈现。  
优先级：high

【任务 9】  
标题：设计并实现游戏主循环  
描述：开发游戏的回合制主循环，每回合代表游戏内一周，整合所有子系统的回合推进。  
实现细节：  
• 在Phaser场景中实现回合计时机制；  
• 明确定义回合开始、回合结束及回合中断条件；  
• 确保与AI系统和事件系统同步。  
测试策略：模拟多回合运行，通过日志和UI提示验证回合状态变化。  
优先级：high

【任务 10】  
标题：开发整体游戏状态管理模块  
描述：设计一套状态管理系统，管理全局游戏状态（如回合计数、成员数据、事件进度）。  
实现细节：  
• 基于Redux或Context API进行状态管理；  
• 集成TypeScript类型定义；  
• 与SQLite数据库进行同步更新。  
测试策略：编写单元测试和端到端测试，确保状态更新和回滚一致性。  
优先级：high

【任务 11】  
标题：构建公会管理主界面UI组件  
描述：设计并实现公会管理相关UI，包括统计、管理面板、操作按钮等。  
实现细节：  
• 使用React搭建基本组件；  
• 制定组件间数据传递方案；  
• 配合状态管理模块展示动态数据。  
测试策略：使用React测试库（如Jest + React Testing Library）验证组件输入、输出与交互逻辑。  
优先级：high

【任务 12】  
标题：开发公会详细信息面板  
描述：展示公会详细信息（如成员、活跃度、资源等）的UI组件，并支持动态刷新。  
实现细节：  
• 建立详细信息展示页；  
• 集成API与数据库数据；  
• 优化信息展示逻辑。  
测试策略：编写单元测试验证数据渲染完整性；模拟数据库变化。  
优先级：high

【任务 13】  
标题：搭建AI成员系统核心框架  
描述：设计AI成员对象的数据结构与基本行为模型，作为后续扩展的基础。  
实现细节：  
• 定义AI成员类及属性（技能、状态、决策参数）；  
• 为初始版本封装简单行为逻辑；  
• 撰写类型说明及接口文档。  
测试策略：编写单元测试验证AI成员属性及行为响应；进行模拟决策测试。  
优先级：high

【任务 14】  
标题：开发AI成员决策逻辑模块  
描述：实现基于状态和数据的简单决策逻辑，确保AI成员在回合中有合理行动。  
实现细节：  
• 根据当前公会状态设计决策规则；  
• 实现决策树或状态机逻辑；  
• 集成至主循环中。  
测试策略：编写模拟场景，对比预期决策结果；进行多场景覆盖测试。  
优先级：high

【任务 15】  
标题：完善AI成员行为模拟与反馈  
描述：拓展AI决策模块，加入行动反馈机制，实时反映成员行为到UI与数据库。  
实现细节：  
• 制定行动反馈接口；  
• 将成员行为结果写回数据库并更新界面；  
• 支持日志记录与历史数据存档。  
测试策略：构造多回合测试，观察结果一致性；模拟异常行为。  
优先级：medium

【任务 16】  
标题：设计公会数据库总体架构  
描述：设计针对公会管理及AI成员、事件等功能用到的数据库 schema，确保数据存储结构合理。  
实现细节：  
• 制定表结构（例如：guilds、members、events、analytics）；  
• 明确表间关系与约束；  
• 编写数据库迁移脚本。  
测试策略：使用SQLite测试工具验证schema正确性；运行CRUD操作测试。  
优先级：high

【任务 17】  
标题：实现SQLite数据库操作封装层  
描述：开发针对各数据表的增删查改API封装，供上层服务调用。  
实现细节：  
• 建立数据访问层，封装常用操作；  
• 提供事务支持以确保数据一致性；  
• 集成TypeScript类型严格约束。  
测试策略：编写针对各API的单元与集成测试，覆盖正常与异常场景。  
优先级：high

【任务 18】  
标题：设计事件系统总体架构  
描述：规划并设计游戏中的事件系统，包括常规事件与突发事件的定义，及后续的处理机制。  
实现细节：  
• 列举事件类型、触发条件、响应方式及持续时间；  
• 撰写事件系统设计文档；  
• 定义接口供各模块调用。  
测试策略：通过设计评审及模拟事件触发流程进行验证；编写部分单元测试。  
优先级：high

【任务 19】  
标题：实现事件队列管理与调度模块  
描述：开发事件调度器，负责事件排队、触发与回调响应，确保游戏流程同步。  
实现细节：  
• 基于前述事件接口，实现事件队列数据结构；  
• 定时、条件触发事件调度；  
• 与UI及数据库同步更新。  
测试策略：构造事件触发周期场景，验证队列调度及响应正确性。  
优先级：high

【任务 20】  
标题：集成数据分析模块基础框架  
描述：设计并实现数据采集与分析接口，支持游戏数据的统计与分析。  
实现细节：  
• 建立数据采集管道，将游戏流程数据持久化；  
• 初步实现统计函数（例如：胜率、活跃度统计）；  
• 集成至主界面展示基础数据。  
测试策略：运行简单数据采集示例，验证采集数据与统计结果的准确性。  
优先级：medium

【任务 21】  
标题：构建社交互动基础UI组件  
描述：设计社交互动模块，包括聊天、好友列表及互动提示功能的界面。  
实现细节：  
• 使用React构建基本交互组件；  
• 设计数据交互接口与状态管理；  
• 美工资源可用时进行联合优化。  
测试策略：编写组件交互测试，模拟用户输入与响应；使用快照测试验证UI。  
优先级：medium

【任务 22】  
标题：开发内置聊天功能模块  
描述：实现基于WebSocket或IPC的实时聊天功能，供公会成员在线交流。  
实现细节：  
• 设计聊天消息协议与接口；  
• 前后端（Electron主进程与React组件）实现聊天数据传输；  
• 集成安全机制及日志记录。  
测试策略：模拟多端消息传递测试，验证无丢包、低延迟及正确显示。  
优先级：medium

【任务 23】  
标题：构建成员资料展示组件  
描述：开发用于展示公会成员详细信息的UI组件，包括头像、等级、技能等。  
实现细节：  
• 设计组件布局及样式；  
• 绑定数据库成员数据，并支持实时更新；  
• 考虑响应式布局。  
测试策略：使用各类测试数据进行渲染验证；编写交互测试确保点击、展开等操作正常。  
优先级：medium

【任务 24】  
标题：设计回合结束总结界面  
描述：开发每回合结束后展现的总结页面，显示本回合重要数据变化、事件摘要。  
实现细节：  
• 制作总结页面样式与动画；  
• 数据来源涵盖公会表现、AI决策、事件记录；  
• 与游戏状态管理模块联动实现动态刷新。  
测试策略：通过模拟不同回合数据，验证总结界面信息的准确性与实时性。  
优先级：high

【任务 25】  
标题：实现游戏状态持久化方案  
描述：设计并实现保存与加载游戏状态的机制，包括回合数据、成员状态等。  
实现细节：  
• 定义状态快照格式，并存储于SQLite或文件系统中；  
• 提供状态回滚以及断点续传功能；  
• 与主状态管理模块紧密集成。  
测试策略：执行多次保存与恢复操作，验证数据一致性；进行压力测试。  
优先级：high

【任务 26】  
标题：集成详细数据分析与报表模块  
描述：扩展数据分析模块，提供图表、报表接口呈现历史数据、趋势分析等。  
实现细节：  
• 选型合适的图表库（如Chart.js或ECharts）；  
• 集成数据聚合、过滤与展示逻辑；  
• 与公会管理面板打通。  
测试策略：针对不同数据集验证图表显示与交互性；编写集成测试。  
优先级：medium

【任务 27】  
标题：实现数据库与数据分析模块的数据同步  
描述：确保游戏数据在持久化和分析模块之间实时同步，提供一致的数据视图。  
实现细节：  
• 开发数据监听机制，监控SQLite变动；  
• 实现数据推送至分析模块接口；  
• 加入数据缓冲与校验。  
测试策略：通过模拟高并发数据录入场景，验证数据同步延迟与准确性。  
优先级：medium

【任务 28】  
标题：开发游戏事件通知系统  
描述：实现游戏内部的事件通知及提醒，确保玩家及时了解重要事件。  
实现细节：  
• 设计消息队列与UI弹窗组件；  
• 通过IPC或状态管理传递事件状态；  
• 定义事件优先级和显示时长。  
测试策略：模拟连续事件触发，验证通知逻辑与UI体验；进行跨模块联动测试。  
优先级：medium

【任务 29】  
标题：建立UI组件单元测试体系  
描述：构建并完善React UI组件的单元测试，保障组件交互及状态更新的正确性。  
实现细节：  
• 选用Jest与React Testing Library；  
• 制定常见组件测试用例（渲染、交互、状态变化等）；  
• 结合快照测试。  
测试策略：运行所有测试用例，通过CI保证覆盖率目标。  
优先级：high

【任务 30】  
标题：构建Electron环境下的集成测试框架  
描述：开发针对Electron主进程和渲染器交互的自动化测试框架，确保整体应用稳定。  
实现细节：  
• 使用Spectron或类似工具进行端到端测试；  
• 编写涉及窗口、IPC、菜单等交互的案例；  
• 集成至CI流水线。  
测试策略：执行端到端自动脚本，验证应用整体交互流程。  
优先级：high

【任务 31】  
标题：开发错误日志记录与崩溃报告模块  
描述：实现全局错误捕获、日志记录及崩溃报告，保障问题可追溯与及时修复。  
实现细节：  
• 在主进程与渲染器分别加入错误处理逻辑；  
• 配置日志存储方案（本地文件或远程服务）；  
• 编写报告上报接口。  
测试策略：模拟常见错误和异常，验证日志记录和上报逻辑。  
优先级：medium

【任务 32】  
标题：搭建持续集成/持续部署（CI/CD）流水线  
描述：配置自动构建、测试与打包流程，确保代码变更及时验证与部署。  
实现细节：  
• 选用GitHub Actions、Travis CI或其他工具；  
• 编写自动编译、测试、打包脚本；  
• 配置自动化部署到测试/预发布环境。  
测试策略：多次触发提交，观察流水线执行状态与反馈，确保各阶段顺利通过。  
优先级：high

【任务 33】  
标题：实现用户身份验证（初步mock方案）  
描述：增加用户登录、注销功能的基础版本，为后续多用户公会管理做准备。  
实现细节：  
• 开发简单的前端登录表单；  
• 模拟后端验证接口（可用本地数据）；  
• 加入状态管理保存用户凭证。  
测试策略：编写流程测试及错误处理测试，模拟正确和错误凭证输入。  
优先级：medium

【任务 34】  
标题：开发公会新手引导与教程页面  
描述：为新用户构建引导页面，帮助用户熟悉公会管理及各核心系统的操作。  
实现细节：  
• 使用React实现分步引导界面；  
• 定义教程内容及互动式提示；  
• 与游戏状态模块联动，检测新用户状态。  
测试策略：模拟新用户注册流程，确保引导完美衔接；收集用户反馈。  
优先级：medium

【任务 35】  
标题：设计公会事件日历组件  
描述：开发一款日历组件，将公会内计划或突发事件以日历形式呈现。  
实现细节：  
• 利用React构建日历UI；  
• 对接数据库事件数据，并支持事件详情展示；  
• 增加过滤、搜索和排序功能。  
测试策略：模拟不同日期的数据输入，验证日历显示及交互性正确。  
优先级：medium

【任务 36】  
标题：构建AI成员培训与能力提升系统  
描述：为AI成员增加培训模块，通过训练使其属性与行为获得优化。  
实现细节：  
• 制定培训规则及成长算法；  
• 构建前端培训界面与后台逻辑；  
• 与数据库中成员数据联动。  
测试策略：执行多回合培训流程，验证能力增长曲线及数据记录。  
优先级：medium

【任务 37】  
标题：实现基于事件驱动的游戏状态更新  
描述：将游戏状态更新与事件触发进行解耦，通过事件总线实时更新界面与数据。  
实现细节：  
• 开发事件发布/订阅模块；  
• 集成至公会管理、AI行为、数据分析等模块；  
• 采用TypeScript严格类型定义。  
测试策略：构造多事件场景，验证状态同步更新及消耗性能评测。  
优先级：high

【任务 38】  
标题：优化Phaser动画性能及渲染效率  
描述：对Phaser引擎部分动画和场景渲染进行性能调优，确保在弱机型上也流畅运行。  
实现细节：  
• 对动画帧率、精灵数量进行监控与优化；  
• 使用Phaser内置调试工具定位性能瓶颈；  
• 嵌入性能统计工具于开发版。  
测试策略：在不同硬件配置下进行性能测试；记录FPS及资源消耗数据。  
优先级：medium

【任务 39】  
标题：集成游戏内音效及背景音乐  
描述：实现游戏中关键场景的音效、背景音乐，为整体体验增色。  
实现细节：  
• 使用Phaser或Electron API加载音频文件；  
• 定义音效触发条件，与事件系统联动；  
• 增加音量控制与静音选项。  
测试策略：在各主要场景进行试听测试及用户操作验证。  
优先级：medium

【任务 40】  
标题：制作响应式UI设计方案  
描述：优化前端UI在不同分辨率下的展示效果，确保跨平台兼容性。  
实现细节：  
• 使用CSS媒体查询或React响应式库；  
• 调整组件布局、字体、图片资源；  
• 定期进行跨平台审查。  
测试策略：使用不同屏幕尺寸的模拟器进行验证；邀请内部用户测试。  
优先级：medium

【任务 41】  
标题：优化数据库查询及索引设计  
描述：针对关键查询场景进行优化，设计合适的索引并减少查询延迟。  
实现细节：  
• 分析常用查询语句；  
• 调整SQLite索引及归档策略；  
• 编写性能监控脚本。  
测试策略：通过负载测试和查询性能监控工具验证查询效率；模拟大数据量情景。  
优先级：medium

【任务 42】  
标题：实现主进程与渲染器安全通信  
描述：设计安全且高效的IPC通信机制，防止潜在的跨进程注入风险。  
实现细节：  
• 使用Electron IPC模块，并通过严格参数校验；  
• 定义通信协议及错误处理；  
• 加入日志记录与异常处理。  
测试策略：编写安全渗透测试及模拟错误消息测试，验证通信加固。  
优先级：high

【任务 43】  
标题：开发游戏状态回滚与恢复功能  
描述：提供状态回滚机制，允许玩家在异常或误操作后恢复至上一稳定状态。  
实现细节：  
• 利用快照及持久化数据构建回滚机制；  
• 定义回滚触发条件；  
• 集成至状态管理模块。  
测试策略：模拟异常状态下的操作，验证回滚功能及数据完整性。  
优先级：medium

【任务 44】  
标题：实现多线程/异步任务处理机制  
描述：针对AI计算及大数据处理任务，实现后台多线程或异步处理，保证主进程响应。  
实现细节：  
• 使用Electron内置的多线程方案或Node.js Worker Threads；  
• 对任务进行分割及进度反馈；  
• 加入错误边界与重试策略。  
测试策略：模拟高耗时任务，验证异步响应、线程隔离以及错误处理。  
优先级：medium

【任务 45】  
标题：开发自定义Phaser插件（扩展功能）  
描述：为特殊场景定制Phaser插件，扩展游戏引擎现有功能，如动画特效或粒子系统。  
实现细节：  
• 分析现有需求中无法覆盖的特效；  
• 使用Phaser插件API封装扩展模块；  
• 撰写详细文档说明接口。  
测试策略：编写插件单元测试及集成测试，在实际场景中检验效果。  
优先级：low

【任务 46】  
标题：增强UI组件的可访问性支持  
描述：对关键UI组件加入无障碍（a11y）特性，确保色彩、标注及交互符合标准。  
实现细节：  
• 根据WAI-ARIA标准调整组件；  
• 添加键盘导航支持；  
• 增加对屏幕阅读器支持的语义标签。  
测试策略：使用无障碍检测工具（如AXE）进行扫描；邀请目标用户进行体验测试。  
优先级：medium

【任务 47】  
标题：实现多语言本地化支持  
描述：为游戏各个模块增加国际化支持，便于后续拓展不同语言版本。  
实现细节：  
• 选用i18next或类似国际化库；  
• 配置语言包结构及动态加载；  
• 确保所有文字、提示及日志均支持多语言。  
测试策略：模拟切换不同语言，验证界面及文案正确显示；编写本地化单元测试。  
优先级：medium

【任务 48】  
标题：编写用户文档与新手指南  
描述：整理并编写用户操作文档、开发者接口文档以及新手引导教程，便于后续支持与培训。  
实现细节：  
• 使用Markdown或文档系统撰写；  
• 整合需求、界面介绍、FAQ与常见问题解决方案；  
• 与UI团队协作保证内容同步。  
测试策略：进行内部评审，并邀请非开发人员测试文档的易读性和实用性。  
优先级：medium

【任务 49】  
标题：全系统集成测试与回归测试  
描述：在集成各模块后，进行全面的系统测试，覆盖功能、性能与安全。  
实现细节：  
• 制定测试计划与覆盖清单；  
• 整合单元、集成及端到端测试脚本；  
• 针对关键业务流程反复验证。  
测试策略：使用自动化测试工具执行回归测试，记录覆盖率及性能指标；进行人工测试。  
优先级：high

【任务 50】  
标题：编写部署脚本与生成发布版本  
描述：整合所有构建、打包流程，生成最终的产出版本，提供部署与版本发布说明。  
实现细节：  
• 编写Electron打包脚本（例如使用electron-builder）；  
• 集成CI流水线自动上传、发布；  
• 生成详尽的版本发布文档及变更日志。  
测试策略：在测试环境中实际部署发布版本，验证各功能模块正常工作；执行自动化验收测试。  
优先级：high
"""

    # 解析任务块
    task_blocks = re.split(r'【任务 (\d+)】', zen_tasks_text.strip())[1:]  # 去掉第一个空元素
    
    tasks = []
    current_tag = "main"  # TaskMaster默认标签
    
    # 每两个元素组成一个任务（任务号和任务内容）
    for i in range(0, len(task_blocks), 2):
        if i + 1 >= len(task_blocks):
            break
            
        task_id = task_blocks[i].strip()
        task_content = task_blocks[i + 1].strip()
        
        # 解析任务内容
        lines = task_content.split('\n')
        title = ""
        description = ""
        details = ""
        test_strategy = ""
        priority = "medium"
        
        current_section = ""
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith('标题：'):
                title = line.replace('标题：', '').strip()
                current_section = "title"
            elif line.startswith('描述：'):
                description = line.replace('描述：', '').strip()
                current_section = "description"
            elif line.startswith('实现细节：'):
                current_section = "details"
            elif line.startswith('测试策略：'):
                test_strategy = line.replace('测试策略：', '').strip()
                current_section = "test"
            elif line.startswith('优先级：'):
                priority = line.replace('优先级：', '').strip()
                current_section = "priority"
            elif line.startswith('•') or line.startswith('-'):
                # 实现细节项目
                detail_item = line.replace('•', '').replace('-', '').strip()
                if current_section == "details":
                    if details:
                        details += "\n"
                    details += "• " + detail_item
                elif current_section == "test":
                    if test_strategy:
                        test_strategy += " "
                    test_strategy += detail_item
            elif current_section == "description" and not line.startswith('实现细节：'):
                # 多行描述
                if description:
                    description += " "
                description += line
                
        # 创建TaskMaster任务对象
        task = {
            "id": task_id,
            "title": title,
            "description": description,
            "status": "pending",
            "priority": priority,
            "dependencies": [],
            "details": details,
            "testStrategy": test_strategy,
            "subtasks": [],
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat()
        }
        
        tasks.append(task)
    
    # 创建TaskMaster格式的完整数据结构
    taskmaster_data = {
        "tasks": tasks,  # TaskMaster期望直接的任务数组
        "metadata": {
            "version": "1.0",
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat(),
            "totalTasks": len(tasks),
            "generatedBy": "zen-mcp-server"
        },
        "tags": {
            current_tag: {
                "name": current_tag,
                "description": "Main development tasks",
                "createdAt": datetime.now().isoformat()
            }
        },
        "currentTag": current_tag
    }
    
    return taskmaster_data

def save_taskmaster_file():
    """
    保存TaskMaster格式的任务文件
    """
    try:
        # 确保目录存在
        tasks_dir = ".taskmaster/tasks"
        os.makedirs(tasks_dir, exist_ok=True)
        
        # 生成任务数据
        taskmaster_data = parse_zen_tasks_to_taskmaster()
        
        # 保存到tasks.json文件
        tasks_file = os.path.join(tasks_dir, "tasks.json")
        
        with open(tasks_file, 'w', encoding='utf-8') as f:
            json.dump(taskmaster_data, f, ensure_ascii=False, indent=2)
        
        print(f"Success: Generated {len(taskmaster_data['tasks'])} tasks")
        print(f"Success: Tasks saved to: {tasks_file}")
        
        # 显示任务概要
        tasks = taskmaster_data['tasks']
        priority_counts = {}
        for task in tasks:
            priority = task.get('priority', 'medium')
            priority_counts[priority] = priority_counts.get(priority, 0) + 1
        
        print(f"\nTask priority distribution:")
        for priority, count in priority_counts.items():
            print(f"  {priority}: {count} tasks")
        
        # 保存摘要信息
        summary_file = os.path.join(tasks_dir, "generation_summary.json")
        summary = {
            "generatedAt": datetime.now().isoformat(),
            "source": "zen-mcp-server",
            "totalTasks": len(tasks),
            "priorityDistribution": priority_counts,
            "firstTask": tasks[0]['title'] if tasks else None,
            "lastTask": tasks[-1]['title'] if tasks else None
        }
        
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        return tasks_file
        
    except Exception as e:
        print(f"Error saving tasks file: {str(e)}")
        return None

if __name__ == "__main__":
    print("Starting conversion: Zen MCP tasks to TaskMaster format...")
    result = save_taskmaster_file()
    
    if result:
        print(f"\nConversion completed! Tasks file location: {result}")
        print("\nNext commands you can run:")
        print("  npx task-master list")
        print("  npx task-master next")
        print("  npx task-master show 1")
    else:
        print("\nConversion failed, please check error messages")
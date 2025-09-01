# 《公会经理》游戏设计文档补遗

**版本**: 1.0  
**日期**: 2025-01-18  
**技术栈**: Electron + Vite + Phaser 3 + TypeScript  
**基于**: PRD-Guild-Manager.md 第三章功能规格说明

---

## 1. Fun Pillars（乐趣支柱）

基于PRD 3.0核心游戏循环设计 + 3.1事件池系统设计的5个核心乐趣支柱：

### 1.1 策略决策的深度乐趣（Strategy Depth）

- **来源**: PRD 3.0.1 回合制系统架构 - 3阶段回合制
- **核心机制**: 结算阶段→玩家阶段→AI模拟阶段的循环决策
- **设计要素**:
  - 强制决策点机制（LOW/MEDIUM/HIGH/CRITICAL四级紧急度）
  - 多选项分支决策（每个决策点3-5个选择）
  - 延迟后果系统（决策影响在未来1-3回合显现）
- **可测指标**:
  - 平均决策时间 > 30秒
  - 决策分支数 > 3个/回合
  - 玩家决策后悔率 < 20%
- **PRD回写位置**: `PRD 3.0.2 强制决策点机制 → CriticalDecision接口`

### 1.2 不确定性的惊喜乐趣（Emergent Surprise）

- **来源**: PRD 3.1.1 庞大事件池系统
- **核心机制**: 随机事件触发、多主体参与、事件链连锁反应
- **设计要素**:
  - 三类事件（主线/随机/周常）的动态平衡
  - 多主体参与系统（单体/双体/多体事件）
  - 复杂触发条件和连锁反应
- **可测指标**:
  - 每回合触发事件数: 1-3个
  - 事件多样性: >80%不重复
  - 玩家惊喜度评分: >7/10
- **PRD回写位置**: `PRD 3.1.1 EventDefinition接口 → EventCategory枚举`

### 1.3 成长与收集的成就乐趣（Progressive Achievement）

- **来源**: PRD 3.5经验系统 + 3.4成就系统
- **核心机制**: 成员等级提升、装备收集、公会声望积累
- **设计要素**:
  - 主体经验系统（1-60级）
  - 活动专精经验（坦克/治疗/输出/副本/PVP）
  - 多维度成就分类（排名/首杀/声望/里程碑）
- **可测指标**:
  - 每小时经验获得 > 100点
  - 成就触发频率: 每10分钟1次
  - 成长满意度: >8/10
- **PRD回写位置**: `PRD 3.5.2 MemberExperienceSystem接口 + 3.4.2 AchievementDefinition接口`

### 1.4 社交竞争的对抗乐趣（Competitive Social）

- **来源**: PRD 3.1.2 AI生态系统
- **核心机制**: 与10-20个NPC公会竞争、排名系统、声望对比
- **设计要素**:
  - 三层AI架构（成员AI/公会AI/环境AI）
  - 动态竞争环境生成
  - 实时排名和声望系统
- **可测指标**:
  - 公会排名变化: 每周>2位
  - 竞争事件频率: 每回合>1次
  - 竞争紧张感: >7/10
- **PRD回写位置**: `PRD 3.1.2 NPCGuildAI类 → AIEcosystem接口`

### 1.5 管理控制的掌控乐趣（Management Control）

- **来源**: PRD 3.2各功能模块
- **核心机制**: 公会管理、人员调度、资源配置、战术制定
- **设计要素**:
  - 工作面板信息中枢
  - 会长邮箱事件驱动
  - 战术中心阵容管理
  - 公会后勤资源调配
- **可测指标**:
  - 管理操作响应时间 < 200ms
  - 批量操作支持 > 10项
  - 掌控感评分: >8/10
- **PRD回写位置**: `PRD 3.2.1 WorkPanel接口 + 3.2.3 TacticalCenter接口`

---

## 2. 交互与手感（Interaction & Feel）

基于PRD 3.3用户界面规格，针对Electron + Phaser 3 + TypeScript技术栈：

### 2.1 输入系统规格

- **来源**: PRD 3.3.2 interactionPatterns
- **主输入方式**:
  - 鼠标左键: 选择/确认操作
  - 鼠标右键: 快捷菜单调用
  - 鼠标滚轮: 界面缩放和滚动
- **辅助输入**:
  - 键盘快捷键系统
    - `ESC`: 退出当前操作
    - `Enter`: 确认操作
    - `Tab`: 界面元素切换
    - `Ctrl+Z`: 撤销操作
- **拖拽操作**:
  - 成员拖拽到阵容位置
  - 装备拖拽分配
  - 邮件批量拖选操作
- **技术指标**:
  - 输入延迟 < 16ms (60FPS)
  - 拖拽响应距离 < 5px
  - 快捷键响应时间 < 50ms
- **PRD回写位置**: `PRD 3.3.2 DragDropSystem + ShortcutMap接口`

### 2.2 摄像机系统规格

- **来源**: PRD 3.3.1 界面设计原则
- **视角类型**: 2.5D等距固定视角（公会管理界面）
- **缩放支持**:
  - 缩放范围: 80%-150%
  - 文字清晰度保持
  - 平滑缩放过渡
- **多窗口管理**:
  - 模态窗口层叠系统
  - 非阻塞式信息面板
  - 窗口状态记忆功能
- **技术指标**:
  - 视角切换时间 < 300ms
  - 缩放操作流畅度: 60FPS
  - 窗口打开速度 < 200ms
- **PRD回写位置**: `PRD 3.3.2 ModalManager + ContentArea接口`

### 2.3 动画响应规格

- **来源**: PRD 3.2.1 工作面板 + 3.6活动结算系统
- **状态反馈动画**:
  - 按钮按下效果: 100ms弹性动画
  - Hover状态变化: 50ms淡入淡出
  - 选中状态指示: 边框高亮动画
- **数据变化动画**:
  - 数值增减: 500ms缓动动画
  - 进度条填充: 平滑增长动画
  - 状态图标切换: 200ms旋转/缩放
- **界面转场动画**:
  - 面板切换: 250ms滑动效果
  - 弹窗显示: 200ms淡入淡出
  - 页面加载: 骨架屏过渡
- **特效动画**:
  - 成就触发: 1500ms庆祝特效
  - 关键事件: 闪光提示动画
  - 声音同步: 动画与音效精确对齐
- **技术指标**:
  - 所有动画维持60FPS
  - 关键路径动画可跳过
  - 动画内存占用 < 100MB
- **PRD回写位置**: `PRD 3.6.2 FeedbackRenderer + 3.4.2 AchievementDefinition接口`

---

## 3. 关卡/节奏蓝图（Level Progression Blueprint）

基于PRD 3.2.2作战大厅模块 + 3.8世界Boss系统，设计3个渐进式里程碑关卡：

### 3.1 里程碑1：初始团队建设（Week 1-4）

- **来源**: PRD 3.2.2 RaidDungeon minLevel设计
- **核心挑战**: 5人小队副本"新手试炼洞穴"
- **设计目标**:
  - 教会玩家基础公会管理
  - 建立基本的成员关系
  - 掌握基础战斗机制
- **具体关卡设置**:
  - 副本等级要求: 5-10级
  - 推荐人数: 5人固定
  - 预计耗时: 30-45分钟
  - 难度等级: BEGINNER
- **成功指标**:
  - 完成首次副本挑战
  - 所有成员等级达到10级
  - 公会声望突破100点
  - 解锁基础战术库
- **节奏设计**:
  - 每日1-2次副本挑战机会
  - 渐进式难度提升 (+10%/次)
  - 失败惩罚轻微（仅疲劳值）
- **技术验证要求**:
  - 副本生成系统稳定性
  - AI队友配合度 > 70%
  - 加载时间 < 10秒
- **PRD回写位置**: `PRD 3.2.2 PlayerCountRange(5-5) + DifficultyLevel.BEGINNER枚举`

### 3.2 里程碑2：团队协作精通（Week 5-12）

- **来源**: PRD 3.2.2 RaidDungeon 20人团本设计
- **核心挑战**: 大型团本"古龙巢穴"，需要精确的职业配合
- **设计目标**:
  - 测试玩家团队管理能力
  - 引入复杂战术和阵容搭配
  - 建立跨公会关系网络
- **具体关卡设置**:
  - 副本等级要求: 20-30级
  - 推荐人数: 20人团队
  - 预计耗时: 90-120分钟
  - 难度等级: INTERMEDIATE
  - 特殊机制: 需要坦克/治疗/输出精确配合
- **成功指标**:
  - 20人团本首杀成功
  - 解锁高级战术库
  - 公会排名进入前50%
  - 建立≥3个外交关系
- **节奏设计**:
  - 每周2-3次团本挑战机会
  - 需要预备会议和战术讨论
  - 失败后需要分析和调整
- **技术验证要求**:
  - 大规模战斗系统性能稳定
  - 战术库系统有效性
  - 20人并发处理无延迟
- **PRD回写位置**: `PRD 3.2.2 RaidComposition + 3.2.3.2 TacticsLibrary接口`

### 3.3 里程碑3：跨公会竞争（Week 13+）

- **来源**: PRD 3.8 世界Boss系统设计
- **核心挑战**: 世界Boss"泰坦守护者"，需要多公会协作或竞争
- **设计目标**:
  - 引入服务器级别的竞争
  - 测试外交和联盟系统
  - 提供最高难度的PVE挑战
- **具体关卡设置**:
  - Boss等级: 50级传说级
  - 参与公会数: 3-8个公会
  - 战斗持续时间: 2-4小时
  - 特殊机制: 贡献度计算系统
- **成功指标**:
  - 成功参与世界Boss战
  - 获得稀有奖励（传说装备）
  - 建立跨公会关系网
  - 公会声望达到1000+
- **节奏设计**:
  - 每月1-2次世界Boss事件
  - 需要提前外交和策略准备
  - 事件预告系统提前1周通知
- **技术验证要求**:
  - 跨公会系统稳定性
  - 实时协调机制有效性
  - 大规模玩家并发支持
- **PRD回写位置**: `PRD 3.8.2 WorldBossTemplate + 3.8.3 ContributionSystem接口`

---

## 4. 经济/数值第一版曲线（Economic Balance Curves）

基于PRD 3.2.7后勤模块 + 3.5经验系统，设计平衡的经济循环：

### 4.1 资源产出曲线

- **来源**: PRD 3.2.7.1 拍卖行系统 + 3.5.2 经验系统
- **主要产出源**:
  - 任务奖励: 基础金币收入
  - 副本掉落: 装备和材料
  - 训练收益: 技能提升副产品
  - 拍卖行交易: 玩家间经济流通
- **金币产出数值设计**:
  ```
  Level 1-20:  100-500 金币/小时
  Level 21-40: 500-1500 金币/小时
  Level 41-60: 1500-3000 金币/小时
  ```
- **经验获取设计**:
  ```
  主体经验: 100-300/活动 (基于难度系数)
  专精经验: 50-150/活动 (基于角色匹配度)
  额外经验: 首次完成 +50%, 完美评价 +25%
  ```
- **稀有资源产出**:
  - 高级材料: 每10次活动产出1个
  - 传说装备: 每100次活动产出1个
  - 特殊货币: Boss战专属奖励
- **PRD回写位置**: `PRD 3.2.7.1 PriceOracle接口 + 3.5.2 experienceToNext算法`

### 4.2 资源消耗设计

- **来源**: PRD 3.2.7.2 训练系统 + 3.2.7.3 疲劳管理
- **主要消耗项**:
  - 装备购买: 主要金币消耗
  - 训练费用: 成员能力提升
  - 恢复费用: 疲劳和Debuff移除
  - 公会维护: 设施升级和维护
- **消耗数值平衡**:
  ```
  训练费用 = Level² × 10 金币
  恢复费用 = 疲劳值 × 5 金币
  装备价格 = 基础价格 × (1.1^等级差)
  公会维护 = 成员数量 × 50 金币/周
  ```
- **稀有消耗机制**:
  - 高级训练需要特殊材料
  - 装备强化需要消耗同类装备
  - Boss挑战需要入场券
- **PRD回写位置**: `PRD 3.2.7.2 TrainingProgram费用 + 3.2.7.3 RecoveryPlan成本`

### 4.3 通胀控制机制

- **来源**: PRD 3.2.7.1 拍卖行系统设计
- **核心控制手段**:
  - 拍卖行手续费: 10%交易税
  - 装备耐久度: 需要定期维修
  - 高级消耗品: 强制资源消耗
  - 公会税收: 成功活动自动扣除5%
- **动态价格调节**:
  ```typescript
  // 价格预言机算法
  interface PriceAdjustment {
    basePrice: number
    supplyFactor: number     // 0.8-1.2 (供应影响)
    demandFactor: number     // 0.8-1.2 (需求影响)
    inflationRate: number    // 每周通胀率 < 5%
    finalPrice: basePrice * supplyFactor * demandFactor * (1 + inflationRate)
  }
  ```
- **长期平衡策略**:
  - 定期回收过剩货币
  - 新内容引入新消耗点
  - 季节性活动奖励调整
- **PRD回写位置**: `PRD 3.2.7.1 AIPurchaseEngine + PriceOracle算法`

---

## 5. 可玩性验证清单（Playability Verification Checklist）

基于PRD 3.4成就系统 + 3.6活动结算AI评价反馈系统：

### 5.1 核心KPI指标

- **来源**: PRD 3.4.3 验收标准 + 3.6.3 验收标准
- **用户留存指标**:
  - 第1天留存率: > 80%
  - 第7天留存率: > 60%
  - 第30天留存率: > 25%
  - 第90天留存率: > 10%
- **参与度指标**:
  - 平均单次游戏时长: > 45分钟
  - 平均每日游戏时长: > 90分钟
  - 每周活跃天数: > 4天
  - 月活跃用户比例: > 70%
- **满意度指标**:
  - 玩家决策后悔率: < 20%
  - AI评价正面率: > 70%
  - 整体游戏满意度: > 7.5/10
  - 推荐意愿度: > 6/10 (NPS)
- **PRD回写位置**: `PRD 3.4.3 成就触发统计 + 3.6.3 评价内容质量验收`

### 5.2 自动化测试脚本

```typescript
// 可玩性测试套件
class PlayabilityTestSuite {
  // 乐趣支柱验证
  async testFunPillars(): Promise<TestResult[]> {
    const results = [];

    // 策略决策深度测试
    results.push(
      await this.verifyStrategyDepth({
        minDecisionTime: 30000, // 30秒
        minDecisionBranches: 3,
        maxRegretRate: 0.2,
      })
    );

    // 惊喜乐趣测试
    results.push(
      await this.verifyEmergentSurprise({
        minEventsPerTurn: 1,
        maxEventsPerTurn: 3,
        minEventDiversity: 0.8,
      })
    );

    // 成长成就测试
    results.push(
      await this.verifyProgressiveAchievement({
        minExpPerHour: 100,
        maxAchievementInterval: 600000, // 10分钟
      })
    );

    return results;
  }

  // 交互响应验证
  async testInteractionFeel(): Promise<TestResult[]> {
    const results = [];

    // 输入延迟测试
    results.push(
      await this.measureInputLatency({
        maxLatency: 16, // 16ms (60FPS)
        minSampleSize: 1000,
      })
    );

    // 动画流畅度测试
    results.push(
      await this.testAnimationSmooth({
        minFrameRate: 60,
        maxFrameDrops: 0.05, // 5%帧率下降容忍
      })
    );

    // 界面响应测试
    results.push(
      await this.verifyUIResponsive({
        maxManagementResponseTime: 200, // 200ms
        maxBatchOperationTime: 1000, // 1秒
      })
    );

    return results;
  }

  // 经济平衡验证
  async testEconomicBalance(): Promise<TestResult[]> {
    const results = [];

    // 经济循环模拟
    results.push(
      await this.simulateEconomicCycle({
        simulationDuration: 30 * 24 * 3600, // 30天
        maxInflationRate: 0.05, // 5%
        minTransactionVolume: 1000,
      })
    );

    // 通胀控制测试
    results.push(
      await this.testInflationControl({
        maxWeeklyInflation: 0.05,
        expectedPriceStability: 0.9,
      })
    );

    return results;
  }

  // 性能基准测试
  async testPerformanceBenchmarks(): Promise<TestResult[]> {
    const results = [];

    results.push(
      await this.testMemoryUsage({
        maxPeakMemory: 2048 * 1024 * 1024, // 2GB
        maxAverageMemory: 1024 * 1024 * 1024, // 1GB
      })
    );

    results.push(
      await this.testLoadingTimes({
        maxInitialLoad: 10000, // 10秒
        maxSceneSwitch: 3000, // 3秒
      })
    );

    return results;
  }
}
```

### 5.3 人工测试检查项

- **来源**: PRD 3.6.1 评价生成系统
- **情感投入度检查**:
  - [ ] 玩家对公会成员产生情感连接
  - [ ] 对成员离队/加入有明显情感反应
  - [ ] 愿意为公会声誉做出牺牲
  - [ ] 对竞争对手产生敌意或尊重
- **策略深度检查**:
  - [ ] 存在多种可行的策略路线
  - [ ] 不同策略有明显的权衡和后果
  - [ ] 玩家能够形成个人风格偏好
  - [ ] 高级策略需要学习和练习
- **学习曲线检查**:
  - [ ] 新手引导覆盖所有核心机制
  - [ ] 复杂功能有足够的实践机会
  - [ ] 错误操作有明确的反馈和修正指导
  - [ ] 进阶内容有合理的解锁节奏
- **长期动机检查**:
  - [ ] 有足够的长期目标支撑数月游戏
  - [ ] 成就系统提供持续的里程碑
  - [ ] 社交竞争保持长期吸引力
  - [ ] 有足够的内容更新计划
- **PRD回写位置**: `PRD 3.6.1 EvaluatorType定义 + ActivityFeedbackSystem接口`

### 5.4 性能基准测试

- **系统响应时间要求**:
  - 管理操作响应: < 200ms
  - 战斗结算计算: < 500ms
  - 大批量数据加载: < 2000ms
  - AI决策计算: < 1000ms
- **资源使用限制**:
  - 峰值内存使用: < 2GB
  - 平均内存使用: < 1GB
  - CPU使用率: < 50% (持续)
  - 磁盘I/O: < 100MB/s
- **加载时间要求**:
  - 初次启动: < 10秒
  - 场景切换: < 3秒
  - 保存游戏: < 2秒
  - 读取存档: < 5秒
- **并发处理能力**:
  - 同时处理AI实体数: > 100个
  - 同时处理事件数: > 50个
  - 界面更新频率: 60FPS稳定
- **PRD回写位置**: `PRD 3.1.2 AI生态系统性能要求 + 3.3.1 性能优化要求`

---

## 6. 技术实现约束与建议

### 6.1 Electron + Phaser 3 集成要点

- **架构分离**: 主进程负责系统集成，渲染进程负责游戏逻辑
- **IPC通信**: 使用contextBridge安全暴露API
- **性能优化**: 大型数据集使用WebWorker处理
- **内存管理**: 及时清理Phaser场景和纹理资源

### 6.2 TypeScript类型安全

- **严格模式**: 启用严格的类型检查
- **接口定义**: 所有PRD模块对应TypeScript接口
- **类型守卫**: 运行时类型验证关键数据
- **泛型约束**: 复用代码保持类型安全

### 6.3 测试策略建议

- **单元测试**: Jest + TypeScript，覆盖率 > 85%
- **集成测试**: Playwright，覆盖关键用户流程
- **性能测试**: 自动化基准测试集成CI/CD
- **用户测试**: A/B测试验证设计假设

---

**文档状态**: ✅ 已完成  
**审核状态**: 待审核  
**更新日期**: 2025-01-18  
**下次审核**: 2025-02-18

---

**PRD模块映射摘要**:

- Fun Pillars ↔ PRD 3.0 + 3.1 核心系统
- 交互手感 ↔ PRD 3.3 + 3.2.1 界面系统
- 关卡蓝图 ↔ PRD 3.2.2 + 3.8 战斗系统
- 经济曲线 ↔ PRD 3.2.7 + 3.5 后勤系统
- 验证清单 ↔ PRD 3.4 + 3.6 反馈系统

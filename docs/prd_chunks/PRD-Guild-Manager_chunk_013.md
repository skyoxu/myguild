---
PRD-ID: "PRD-GM-PRD-GUILD-MANAGER_CHUNK_013"
Title: "公会管理器PRD - 分片13"
Status: "Active"
Owner: "Product-Team"
Created: "2024-12-01T00:00:00Z"
Updated: "2025-08-22T00:00:00Z"
Version: "v1.2.0"
Priority: "High"
Risk: "Medium"
Depends-On:
  - "PRD-GM-BASE-ARCHITECTURE"
chunk: "13/24"
size: "8651 chars"
source: "PRD-Guild-Manager.md"
Arch-Refs: [CH01, CH03, CH04, CH05]
Test-Refs:
  - "tests/unit/guild-manager-chunk-013.spec.ts"
Monitors:
  - "txn.prd-guild-manager_chunk_013.primary"
SLO-Refs:
  - "UI_P95_100ms"
  - "EVENT_P95_50ms"
  - "CRASH_FREE_99.5"
ADRs: [ADR-0001, ADR-0002, ADR-0003, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0010]
Release_Gates:
  Quality_Gate:
    enabled: true
    threshold: "unit_test_coverage >= 80%"
    blockingFailures:
      - "test_failures"
      - "coverage_below_threshold"
    windowHours: 24
  Security_Gate:
    enabled: true
    threshold: "security_scan_passed == true"
    blockingFailures:
      - "security_vulnerabilities"
      - "dependency_vulnerabilities"
    windowHours: 12
  Performance_Gate:
    enabled: true
    threshold: "p95_response_time <= 100ms"
    blockingFailures:
      - "performance_regression"
      - "memory_leaks"
    windowHours: 6
  Acceptance_Gate:
    enabled: true
    threshold: "acceptance_criteria_met >= 95%"
    blockingFailures:
      - "acceptance_test_failures"
      - "user_story_incomplete"
    windowHours: 48
  API_Contract_Gate:
    enabled: true
    threshold: "api_contract_compliance >= 100%"
    blockingFailures:
      - "contract_violations"
      - "breaking_changes"
    windowHours: 12
  Sentry_Release_Health_Gate:
    enabled: true
    threshold: "crash_free_users >= 99.5% AND crash_free_sessions >= 99.9%"
    blockingFailures:
      - "crash_free_threshold_violation"
      - "insufficient_adoption_data" 
      - "release_health_regression"
    windowHours: 24
    params:
      sloRef: "CRASH_FREE_99.5"
      thresholds:
        crashFreeUsers: 99.5
        crashFreeSessions: 99.9
        minAdoptionPercent: 25
        durationHours: 24

Security_Policies:
  permissions:
    read:
      - "guild-member"
      - "guild-officer"
      - "guild-master"
    write:
      - "guild-officer"
      - "guild-master"
    admin:
      - "guild-master"
      - "system-admin"
  cspNotes: "Electron CSP: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; connect-src 'self' https://api.${PRODUCT_DOMAIN}; style-src 'self' 'nonce-${NONCE_PLACEHOLDER}'; img-src 'self' data: https: ; font-src 'self'"
Traceability_Matrix:
  requirementTags:
    - "guild-management"
    - "user-experience"
    - "performance"
  acceptance:
    functional: "功能需求100%实现"
    performance: "性能指标达到SLO要求"
    security: "安全要求完全满足"
    usability: "用户体验达到设计标准"
  evidence:
    implementation: "源代码实现"
    testing: "自动化测试覆盖"
    documentation: "技术文档完备"
    validation: "用户验收确认"
  businessAcceptance:
    userStoryCompletion: "用户故事100%完成"
    businessRulesValidation: "业务规则验证通过"
    stakeholderApproval: "利益相关者确认"
---

### 3.5 经验系统架构

简化的经验系统专注于成员个体成长和多样化活动参与，删除复杂的熟练度机制。

#### 3.5.1 功能要求
- **成员主体经验**: 所有成员（玩家公会和NPC公会）拥有主体等级和经验
- **活动专精经验**: 针对不同位置、副本、PVP等活动的专门经验
- **公会声望系统**: 公会整体通过成就和活动获得声望，而非直接经验
- **直观成长机制**: 经验直接影响成员在对应活动中的表现

#### 3.5.2 技术规格
```typescript
// 简化的经验系统接口
interface MemberExperienceSystem {
  // 主体经验
  level: number              // 成员总等级 (1-60)
  experience: number         // 当前总经验
  experienceToNext: number   // 升级所需经验
  
  // 活动专精经验 (参考魔兽世界设计)
  activityExperience: {
    // 位置经验
    tank: number             // 坦克位置经验
    healer: number           // 治疗位置经验
    dps: number              // 输出位置经验
    
    // 副本经验
    dungeonExperience: Map<string, number>  // 各副本专精经验
    raidExperience: Map<string, number>     // 团本专精经验
    
    // PVP经验  
    arenaExperience: number          // 竞技场经验
    battlegroundExperience: number   // 战场经验
    
    // 其他活动经验
    trainingExperience: number       // 训练经验
    diplomacyExperience: number      // 外交经验
  }
}

// 公会声望系统 (替代公会经验)
interface GuildReputationSystem {
  reputation: number         // 总声望值
  reputationLevel: number    // 声望等级 (1-10)
  
  // 声望来源追踪
  reputationSources: {
    firstKills: number       // 首杀声望
    championships: number    // 比赛冠军声望
    memberAchievements: number // 成员成就声望
    communityContribution: number // 社区贡献声望
  }
  
  // 声望效果
  getReputationBonus(): ReputationBonus
  canUnlockFeature(feature: string): boolean
}

// 扩展成员接口
interface GuildMember extends BaseEntity {
  experience: MemberExperienceSystem
  
  // 经验增长方法
  gainExperience(amount: number): void
  gainActivityExperience(activity: ActivityType, amount: number): void
  getActivityEfficiency(activity: ActivityType): number
  
  // 等级影响计算
  calculatePerformanceBonus(activity: ActivityType): number
}

// 经验管理服务
class ExperienceManager {
  // 主体经验计算
  calculateLevelUp(currentExp: number): LevelUpResult
  getExperienceForLevel(level: number): number
  
  // 活动经验计算
  calculateActivityExperience(activity: Activity, performance: number): number
  getActivityLevelBonus(activityExp: number): number
  
  // 公会声望计算
  calculateReputationGain(achievement: Achievement): number
  updateGuildReputation(guild: Guild, change: number): void
}
```

#### 3.5.3 验收标准
- ✅ 成员主体经验正确计算和等级提升
- ✅ 活动专精经验影响对应活动的表现
- ✅ 公会声望系统与成员成就正确关联
- ✅ 经验数据持久化和界面显示正常
- ✅ 不同活动的经验获取平衡合理

### 3.6 活动结算AI评价反馈系统

#### 3.6.1 功能要求

**系统概述：**
每次PVE和PVP活动结束后，在结算界面提供多维度的AI评价反馈，包括参与成员、未参与成员、粉丝、官员等角色的个性化评价。

```typescript
/* 活动结算AI评价反馈系统 */
interface ActivityFeedbackSystem {
  // 反馈生成器
  feedbackGenerator: FeedbackGenerator
  
  // 评价者配置
  evaluators: Map<EvaluatorType, AIEvaluator[]>  // 不同类型的评价者
  commentPool: CommentPool                       // 静态评价池
  dynamicContext: ActivityContext               // 动态上下文分析
  
  // 反馈展示
  feedbackRenderer: FeedbackRenderer           // 反馈渲染器
  reactionSystem: ReactionSystem               // 反应和互动系统
}

// 评价者类型
enum EvaluatorType {
  PARTICIPATING_MEMBERS = "参与成员",     // 参与该活动的公会成员
  NON_PARTICIPATING = "未参与成员",       // 未参与该活动的公会成员  
  GUILD_FANS = "公会粉丝",              // 公会外部粉丝和关注者
  GUILD_OFFICERS = "公会官员",          // 各级官员和管理层
  CLASS_LEADERS = "职业队长",           // 专业队长和导师
  RIVAL_GUILDS = "敌对公会",            // 竞争对手公会成员
  NEUTRAL_OBSERVERS = "中立观察者"       // 游戏世界中的中立NPC
}

// AI评价者实体
interface AIEvaluator {
  id: string                               // 评价者ID
  name: string                            // 评价者名称
  type: EvaluatorType                     // 评价者类型
  personality: PersonalityProfile         // 个性特征
  relationshipLevel: number               // 与公会的关系等级
  
  // 评价倾向
  evaluationStyle: EvaluationStyle        // 评价风格
  focusAspects: ActivityAspect[]          // 关注重点
  biasFactors: BiasConfiguration          // 偏见和倾向配置
  
  // 历史记录
  pastComments: CommentHistory[]          // 历史评价记录
  reputationImpact: number               // 声誉影响权重
}

// 评价风格配置
interface EvaluationStyle {
  tone: CommentTone                       // 评价语调
  detailLevel: DetailLevel                // 详细程度
  constructiveness: number                // 建设性程度 (0-1)
  emotionalIntensity: number              // 情感强度 (0-1)
  professionalLevel: number               // 专业程度 (0-1)
}

enum CommentTone {
  ENCOURAGING = "鼓励型",                 // 积极鼓励的语调
  CRITICAL = "批评型",                    // 批评和指正的语调
  ANALYTICAL = "分析型",                  // 客观分析的语调
  EMOTIONAL = "情感型",                   // 感性和情绪化的语调
  PROFESSIONAL = "专业型",                // 专业和技术性的语调
  HUMOROUS = "幽默型",                    // 轻松幽默的语调
  SARCASTIC = "讽刺型"                   // 讽刺和挖苦的语调
}

// 活动评价维度
enum ActivityAspect {
  STRATEGY_EXECUTION = "战术执行",         // 战术执行质量
  TEAM_COORDINATION = "团队协作",          // 团队配合程度
  INDIVIDUAL_PERFORMANCE = "个人表现",      // 个人技能表现
  RESOURCE_MANAGEMENT = "资源管理",        // 资源分配和使用
  LEADERSHIP_QUALITY = "领导力",           // 指挥和决策质量
  ADAPTABILITY = "应变能力",              // 突发情况应对
  PREPARATION_LEVEL = "准备充分度",        // 活动前准备工作
  COMMUNICATION = "沟通效果",             // 沟通和信息传递
  LEARNING_IMPROVEMENT = "学习改进",       // 从失败中学习的能力
  ENTERTAINMENT_VALUE = "娱乐价值"         // 活动的观赏性和趣味性
}

// 评价内容池
interface CommentPool {
  // 按评价维度分类的评价模板
  templatesByAspect: Map<ActivityAspect, CommentTemplate[]>
  
  // 按结果类型分类的评价模板
  templatesByResult: Map<ActivityResultType, CommentTemplate[]>
  
  // 按评价者类型分类的评价模板
  templatesByEvaluator: Map<EvaluatorType, CommentTemplate[]>
  
  // 动态评价生成规则
  dynamicGenerationRules: GenerationRule[]
}

// 评价模板
interface CommentTemplate {
  id: string                              // 模板ID
  template: string                        // 评价模板文本 (支持变量替换)
  applicableContexts: ContextCondition[]  // 适用场景条件
  emotionalWeight: number                 // 情感权重
  impactLevel: FeedbackImpact            // 反馈影响等级
  
  // 模板变量
  variables: TemplateVariable[]           // 可替换变量定义
  
  // 使用限制
  cooldownPeriod: number                  // 冷却期 (防止重复)
  maxUsagePerSession: number             // 单次活动最大使用次数
}

enum FeedbackImpact {
  NEUTRAL = "中性",                       // 无明显情感倾向
  POSITIVE_MILD = "轻度正面",             // 轻微的正面情感
  POSITIVE_STRONG = "强烈正面",           // 强烈的正面情感
  NEGATIVE_MILD = "轻度负面",             // 轻微的负面情感  
  NEGATIVE_STRONG = "强烈负面",           // 强烈的负面情感
  MOTIVATIONAL = "激励性",                // 激励和鼓舞性质
  EDUCATIONAL = "教育性"                  // 教育和指导性质
}

// 反馈生成器
class FeedbackGenerator {
  /* 为指定活动生成AI评价反馈 */
  generateFeedback(activity: Activity, context: ActivityContext): ActivityFeedback
  
  /* 选择合适的评价者 */
  selectEvaluators(activity: Activity, maxCount: number): AIEvaluator[]
  
  /* 基于上下文生成个性化评价 */
  generatePersonalizedComment(evaluator: AIEvaluator, context: ActivityContext): string
  
  /* 应用评价者的个性特征 */
  applyPersonalityBias(comment: string, personality: PersonalityProfile): string
}
```

#### 3.6.2 技术规格

**评价生成算法：**
```typescript
// 评价生成核心算法
class CommentGenerationEngine {
  /* 智能评价生成 */
  generateIntelligentComment(params: CommentGenerationParams): GeneratedComment {
    // 1. 分析活动上下文
    const context = this.analyzeActivityContext(params.activity)
    
    // 2. 评估评价者关系和倾向
    const evaluatorContext = this.buildEvaluatorContext(params.evaluator, context)
    
    // 3. 选择合适的评价模板
    const templates = this.selectApplicableTemplates(evaluatorContext)
    
    // 4. 生成动态内容
    const dynamicContent = this.generateDynamicContent(evaluatorContext)
    
    // 5. 组合和个性化处理
    return this.combineAndPersonalize(templates, dynamicContent, evaluatorContext)
  }
  
  /* 上下文敏感的模板选择 */
  private selectApplicableTemplates(context: EvaluatorContext): CommentTemplate[] {
    return this.commentPool.templates
      .filter(template => this.matchesContext(template, context))
      .sort((a, b) => this.calculateRelevanceScore(b, context) - this.calculateRelevanceScore(a, context))
      .slice(0, 3) // 选择最相关的3个模板
  }
}

// 活动结果分析器
interface ActivityAnalyzer {
  /* 分析活动表现 */
  analyzePerformance(activity: Activity): PerformanceAnalysis
  
  /* 识别关键时刻 */
  identifyKeyMoments(activity: Activity): KeyMoment[]

  /* 计算影响因素 */
  calculateImpactFactors(activity: Activity): ImpactFactor[]
}

interface PerformanceAnalysis {
  overallRating: number                   // 总体评分 (0-10)
  aspectRatings: Map<ActivityAspect, number> // 各维度评分
  strengths: string[]                     // 表现亮点
  weaknesses: string[]                    // 改进空间
  surprisingMoments: KeyMoment[]          // 意外时刻
  
  // 对比分析
  historicalComparison: ComparisonResult  // 与历史表现对比
  peerComparison: ComparisonResult       // 与同级别公会对比
}
```

#### 3.6.3 验收标准

**功能验收：**
- ✅ 活动结束后自动触发评价生成
- ✅ 支持7种不同类型的评价者
- ✅ 评价内容与活动表现高度相关
- ✅ 评价者个性特征明显体现
- ✅ 避免重复和机械化的评价内容

**质量验收：**
- ✅ 评价内容的娱乐性和可读性
- ✅ 评价对玩家决策的指导价值
- ✅ 系统性能影响控制在可接受范围
- ✅ 多样化的评价风格和语调

**Acceptance（就地验收，占位）**
- P95 ≤ 200ms 首屏反馈；≤1s 上报 `txn.prd-guild-manager_chunk_013.primary`。
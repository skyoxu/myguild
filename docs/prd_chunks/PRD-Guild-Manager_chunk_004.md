---
PRD-ID: 'PRD-GM-PRD-GUILD-MANAGER_CHUNK_004'
Title: '公会管理器PRD - 分片4'
Status: 'Active'
Owner: 'Product-Team'
Created: '2024-12-01T00:00:00Z'
Updated: '2025-08-22T17: 08: 00.374Z'
Version: 'v1.2.0'
Priority: 'High'
Risk: 'Medium'
Depends-On:
  - 'PRD-GM-BASE-ARCHITECTURE'
chunk: '4/24'
size: '8670 chars'
source: '/guild-manager/chunk-004'
Arch-Refs: [CH01, CH03, CH04, CH05]
Test-Refs:
  - 'tests/unit/guild-manager-chunk-004.spec.ts'
Monitors:
  - 'txn.prd-guild-manager_chunk_004.primary'
SLO-Refs:
  - 'UI_P95_100ms'
  - 'EVENT_P95_50ms'
  - 'CRASH_FREE_99.5'
ADRs:
  [
    ADR-0001,
    ADR-0002,
    ADR-0003,
    ADR-0004,
    ADR-0005,
    ADR-0006,
    ADR-0007,
    ADR-0008,
    ADR-0009,
  ]
Release_Gates:
  Quality_Gate:
    enabled: true
    threshold: 'unit_test_coverage >= 80%'
    blockingFailures:
      - 'test_failures'
      - 'coverage_below_threshold'
    windowHours: 24
  Security_Gate:
    enabled: true
    threshold: 'security_scan_passed == true'
    blockingFailures:
      - 'security_vulnerabilities'
      - 'dependency_vulnerabilities'
    windowHours: 12
  Performance_Gate:
    enabled: true
    threshold: 'p95_response_time <= 100ms'
    blockingFailures:
      - 'performance_regression'
      - 'memory_leaks'
    windowHours: 6
  Acceptance_Gate:
    enabled: true
    threshold: 'acceptance_criteria_met >= 95%'
    blockingFailures:
      - 'acceptance_test_failures'
      - 'user_story_incomplete'
    windowHours: 48
  API_Contract_Gate:
    enabled: true
    threshold: 'api_contract_compliance >= 100%'
    blockingFailures:
      - 'contract_violations'
      - 'breaking_changes'
    windowHours: 12
  Sentry_Release_Health_Gate:
    enabled: true
    threshold: 'crash_free_users >= 99.5% AND crash_free_sessions >= 99.9%'
    blockingFailures:
      - 'crash_free_threshold_violation'
      - 'insufficient_adoption_data'
      - 'release_health_regression'
    windowHours: 24
    params:
      sloRef: 'CRASH_FREE_99.5'
      thresholds:
        crashFreeUsers: 99.5
        crashFreeSessions: 99.9
        minAdoptionPercent: 25
        durationHours: 24

Contract_Definitions:
  types:
    - 'src/shared/contracts/guild/chunk-004-types.ts'
  events:
    specversion: '1.0'
    id: 'guild-manager-chunk-004-1vve6mky'
    time: '2025-08-24T15: 18: 34.485Z'
    type: 'com.guildmanager.chunk004.event'
    source: '/guild-manager/chunk-004'
    subject: 'guild-management-chunk-4'
    datacontenttype: 'application/json'
    dataschema: 'src/shared/contracts/guild/chunk-004-events.ts'
  interfaces:
    - 'src/shared/contracts/guild/chunk-004-interfaces.ts'
  validation_rules:
    - 'src/shared/validation/chunk-004-validation.ts'

Security_Policies:
permissions:
read:
  - 'guild-member'
  - 'guild-officer'
  - 'guild-master'
write:
  - 'guild-officer'
  - 'guild-master'
admin:
  - 'guild-master'
  - 'system-admin'
cspNotes: "Electron CSP: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; connect-src 'self' https://api.${PRODUCT_DOMAIN}; style-src 'self' 'nonce-${NONCE_PLACEHOLDER}'; img-src 'self' data: https: ; font-src 'self'"
Traceability_Matrix:
requirementTags:
  - 'guild-management'
  - 'user-experience'
  - 'performance'
acceptance:
functional: '功能需求100%实现'
performance: '性能指标达到SLO要求'
security: '安全要求完全满足'
usability: '用户体验达到设计标准'
evidence:
implementation: '源代码实现'
testing: '自动化测试覆盖'
documentation: '技术文档完备'
validation: '用户验收确认'
---

#### 3.2.4 公会会员模块

**角色属性字段设计**

参考魔兽世界设计理念，定义完整的角色属性系统：

```typescript
// 会长角色属性 (玩家扮演)
interface GuildLeader extends BaseCharacter {
  // 基础信息
  name: string; // 会长名称
  title: string; // 称号
  race: string; // 种族
  class: string; // 职业

  // 核心属性 (1-100)
  leadership: number; // 领导力 - 影响公会整体士气和效率
  charisma: number; // 魅力 - 影响招募成功率和外交
  strategy: number; // 策略 - 影响战术制定和活动规划
  management: number; // 管理 - 影响公会运营效率

  // 经验系统
  experience: MemberExperienceSystem;

  // 特殊能力
  leadershipSkills: LeadershipSkill[]; // 会长专用技能
  reputation: number; // 个人声望

  // 社交关系
  intimacyMap: Map<string, number>; // 与其他角色的亲密度
  contactList: ContactEntry[]; // 联系人清单
}

// 公会成员属性
interface GuildMember extends BaseCharacter {
  // 基础信息
  name: string; // 角色名称
  race: string; // 种族
  class: string; // 职业 (战士/法师/牧师/盗贼等)
  specialization: string; // 专精 (坦克/治疗/输出)
  guild: string; // 所属公会
  assess: string; // 公会评价

  // 传奇成员属性
  legendary: boolean; // 传奇成员标识
  legendaryType?: LegendaryType; // 传奇类型 (仅传奇成员有效)
  legendaryAbilities?: LegendaryAbility[]; // 传奇专属能力
  legendaryBackstory?: string; // 传奇背景故事
  rarity: MemberRarity; // 成员稀有度等级

  // 核心属性 (1-100)
  skill: number; // 技能水平 - 影响活动表现
  loyalty: number; // 忠诚度 - 影响流失概率
  teamwork: number; // 团队配合 - 影响团队活动效果
  ambition: number; // 野心 - 影响成长欲望和内部竞争

  // 状态属性
  satisfaction: number; // 满意度 (0-100)
  fatigue: number; // 疲劳度 (0-100)
  morale: number; // 士气 (0-100)
  availability: number; // 可用度 (0-100, 受现实时间影响)

  // 经验系统
  experience: MemberExperienceSystem;

  // 社交关系
  intimacyWithLeader: number; // 与会长的亲密度
  memberRelationships: Map<string, number>; // 与其他成员关系

  // AI特性 (NPC成员)
  personality: PersonalityTrait[]; // 性格特质
  aiGoals: PersonalGoal[]; // 个人目标
  behaviorPattern: BehaviorPattern; // 行为模式

  // 游戏机制
  recruitmentSource: RecruitmentSource; // 招募来源
  joinDate: Date; // 加入日期
  currentRole: GuildRole; // 当前公会职位
}
// 基础角色接口
interface BaseCharacter {
  id: string;
  avatar: string; // 头像
  level: number; // 等级 (1-60)
  gearScore: number; // 装备评分

  // 活动统计
  activityStats: {
    totalActivities: number;
    successRate: number;
    mvpCount: number;
    lastActivityDate: Date;
  };
}

// 成员稀有度等级
enum MemberRarity {
  COMMON = '普通', // 常见成员 (85%)
  UNCOMMON = '稀有', // 稀有成员 (12%)
  RARE = '精英', // 精英成员 (2.5%)
  LEGENDARY = '传奇', // 传奇成员 (0.5%)
}

// 传奇成员类型
enum LegendaryType {
  COMBAT_MASTER = '战斗大师', // 战斗技能卓越，提升团队DPS
  STRATEGIC_GENIUS = '战术天才', // 战术策划能力，提升活动成功率
  SOCIAL_BUTTERFLY = '社交达人', // 社交能力卓越，提升招募和外交
  TECHNICAL_EXPERT = '技术专家', // 专业技能精通，提升专业活动效率
  LEADERSHIP_ICON = '领导典范', // 领导魅力出众，提升团队士气
  LEGENDARY_CRAFTER = '传奇工匠', // 制作技能精湛，提升装备和道具质量
  MASTER_STRATEGIST = '军事家', // 军事战略专家，提升PVP和大型战役表现
}

// 传奇能力定义
interface LegendaryAbility {
  id: string; // 能力ID
  name: string; // 能力名称
  description: string; // 能力描述
  type: LegendaryAbilityType; // 能力类型

  // 能力效果
  effects: AbilityEffect[]; // 具体效果列表
  cooldown?: number; // 冷却时间 (回合)
  cost?: ResourceCost; // 使用成本

  // 触发条件
  triggerConditions?: TriggerCondition[]; // 触发条件
  passiveBonus?: PassiveBonus; // 被动加成
}

enum LegendaryAbilityType {
  PASSIVE = '被动技能', // 持续生效的被动能力
  ACTIVE = '主动技能', // 需要主动激活的能力
  AURA = '光环效果', // 影响周围成员的光环
  CONDITIONAL = '条件技能', // 特定条件下触发的能力
}

// 传奇能力效果
interface AbilityEffect {
  target: TargetType; // 影响目标
  attribute: string; // 影响属性
  modifier: number; // 修正值
  duration?: number; // 持续时间
  conditions?: string[]; // 生效条件
}

enum TargetType {
  SELF = '自身', // 仅影响自己
  TEAM = '团队', // 影响整个团队
  GUILD = '公会', // 影响整个公会
  ACTIVITY = '活动', // 影响特定活动
  OPPONENTS = '对手', // 影响对手 (PVP)
}

// 传奇成员展示信息 (用于NPC公会信息显示)
interface LegendaryMemberInfo {
  id: string; // 成员ID
  name: string; // 成员名称
  race: string; // 种族
  class: string; // 职业
  legendaryType: LegendaryType; // 传奇类型
  joinDate: Date; // 加入日期
  achievements: string[]; // 主要成就
  specialAbility: string; // 特殊能力简述
}

// 性格特质枚举
enum PersonalityTrait {
  COMPETITIVE = '好胜心强',
  COOPERATIVE = '合作精神',
  PERFECTIONIST = '完美主义',
  CASUAL = '休闲随性',
  SOCIAL = '社交活跃',
  INTROVERTED = '内向专注',
  AMBITIOUS = '雄心勃勃',
  LOYAL = '忠诚可靠',
}

// 公会职位
enum GuildRole {
  LEADER = '会长',
  OFFICER = '官员',
  VETERAN = '资深成员',
  MEMBER = '普通成员',
  TRIAL = '见习成员',
}
```

**亲密度系统设计**

核心社交机制，管理玩家会长与游戏世界中所有角色的关系网络：

```typescript
// 亲密度系统核心接口
interface IntimacySystem {
  // 全局亲密度映射 (包括所有NPC公会成员、非会员AI等)
  globalIntimacyMap: Map<string, IntimacyData>;

  // 联系人清单 (亲密度 >= 1 的角色)
  contactList: ContactEntry[];

  // 亲密度事件触发器
  intimacyTriggers: IntimacyTrigger[];

  // 核心方法
  updateIntimacy(characterId: string, change: number): void;
  triggerIntimacyEvent(characterId: string): void;
  addToContactList(characterId: string): void;
  getAvailableActions(characterId: string): ContactAction[];
}

// 亲密度数据结构
interface IntimacyData {
  characterId: string; // 角色ID
  intimacyLevel: number; // 亲密度等级 (0-10)
  intimacyValue: number; // 具体亲密度数值 (0-1000)
  relationshipType: RelationshipType; // 关系类型
  lastInteractionDate: Date; // 最后互动时间
  interactionHistory: InteractionRecord[]; // 互动历史

  // 角色基本信息
  characterInfo: {
    name: string;
    guildId?: string; // 所属公会ID (如果有)
    class: string; // 职业
    specialization: string; // 专精
    reputation: number; // 该角色的声望
  };
}

// 亲密度等级定义
enum IntimacyLevel {
  UNKNOWN = 0, // 陌生人，不在联系人清单
  ACQUAINTANCE = 1, // 认识，进入联系人清单
  FRIENDLY = 2, // 友好
  CLOSE_FRIEND = 3, // 亲密朋友
  TRUSTED_ALLY = 4, // 可信盟友
  BEST_FRIEND = 5, // 最好的朋友
}

// 关系类型
enum RelationshipType {
  POTENTIAL_RECRUIT = '潜在招募对象',
  GUILD_MEMBER = '公会成员',
  RIVAL_GUILD_MEMBER = '敌对公会成员',
  NEUTRAL_PLAYER = '中立玩家',
  MENTOR = '导师',
  PROTEGE = '门徒',
  BUSINESS_CONTACT = '商业伙伴',
}

// 联系人清单条目
interface ContactEntry {
  intimacyData: IntimacyData;
  availableActions: ContactAction[]; // 可执行的互动指令
  lastActionDate?: Date; // 最后行动时间
  actionCooldowns: Map<string, Date>; // 行动冷却时间
}

// 联系人可执行的行动
interface ContactAction {
  id: string;
  name: string; // 行动名称 (如"招募"、"送礼"、"邀请聊天")
  description: string; // 详细描述
  intimacyRequirement: number; // 所需最低亲密度
  cooldown: number; // 冷却时间 (小时)
  cost?: ResourceCost; // 消耗资源
  successRate: number; // 成功率 (基于当前亲密度)

  // 效果预期
  intimacyChange: IntimacyChange; // 亲密度变化
  possibleEvents: string[]; // 可能触发的事件ID
}

// 亲密度变化规则
interface IntimacyChange {
  onSuccess: number; // 成功时亲密度变化
  onFailure: number; // 失败时亲密度变化
  onCriticalSuccess?: number; // 大成功时额外变化
}

// 亲密度触发器
interface IntimacyTrigger {
  intimacyThreshold: number; // 触发阈值
  eventId: string; // 触发的事件ID
  triggerOnce: boolean; // 是否只触发一次
  additionalConditions?: Condition[]; // 额外触发条件
}

// 互动记录
interface InteractionRecord {
  actionId: string;
  date: Date;
  result: InteractionResult;
  intimacyChange: number;
}

enum InteractionResult {
  CRITICAL_SUCCESS = '大成功',
  SUCCESS = '成功',
  FAILURE = '失败',
  CRITICAL_FAILURE = '大失败',
}
```

**亲密度系统机制说明：**

1. **初始状态**: 所有角色亲密度为0，玩家不认识他们
2. **建立联系**: 通过事件邮件、推荐、主动招募等方式，亲密度提升至1，角色进入联系人清单
3. **主动互动**: 玩家可在联系人清单中选择行动指令，影响亲密度
4. **自动触发**: 达到特定亲密度阈值时自动触发相关事件
5. **动态管理**: 长期不互动的联系人亲密度会自然下降

**社交关系网络**

```typescript
interface SocialNetwork {
  memberHierarchy: HierarchyStructure; // 层级管理
  relationshipGraph: RelationshipMap; // 关系网络图
  satisfactionSystem: SatisfactionMetrics; // 满意度系统
  friendGroups: FriendGroupAI[]; // AI形成的小团体
  intimacySystem: IntimacySystem; // 亲密度系统集成
}

// 招募系统规格 (与亲密度系统集成)
interface RecruitmentSystem {
  searchFilters: RecruitmentFilters; // 多维度搜索
  negotiationSystem: NegotiationFlow; // 合同谈判流程
  talentRankings: TalentLeaderboard; // 天梯排行榜
  intimacyBasedRecruitment: boolean; // 基于亲密度的招募加成

  // 传奇成员专用功能 (新增)
  legendaryMemberSearch: LegendarySearchSystem; // 传奇成员检索系统
  legendaryRecruitmentEvents: LegendaryRecruitmentEventPool; // 传奇成员招募事件池
}

// 招募搜索过滤器 (扩展传奇成员支持)
interface RecruitmentFilters {
  // 基础过滤
  classFilter: string[]; // 职业过滤
  levelRange: [number, number]; // 等级区间
  skillRange: [number, number]; // 技能区间

  // 传奇成员过滤 (新增)
  rarityFilter: MemberRarity[]; // 稀有度过滤
  legendaryOnly: boolean; // 仅显示传奇成员
  legendaryTypeFilter: LegendaryType[]; // 传奇类型过滤
  availableLegendariesOnly: boolean; // 仅显示可招募的传奇成员

  // 高级过滤
  personalityTraits: PersonalityTrait[]; // 性格特质过滤
  experienceRequirement: number; // 经验要求
  intimacyLevelFilter: number; // 亲密度等级过滤
}

// 传奇成员搜索系统
interface LegendarySearchSystem {
  // 搜索功能
  searchAvailableLegendaries(): LegendaryMemberCandidate[]; // 搜索可招募传奇成员
  filterByType(type: LegendaryType): LegendaryMemberCandidate[]; // 按类型筛选
  searchByAbility(abilityKeyword: string): LegendaryMemberCandidate[]; // 按能力搜索

  // 展示功能
  displayLegendaryRoster(guildId: string): LegendaryMemberInfo[]; // 显示公会传奇成员
  compareLegendaryMembers(member1: string, member2: string): ComparisonResult; // 传奇成员对比

  // 统计功能
  getLegendaryStatistics(): LegendaryStatistics; // 获取传奇成员统计
}

// 传奇成员候选人
interface LegendaryMemberCandidate {
  memberInfo: GuildMember; // 基础成员信息
  recruitmentCost: ResourceCost; // 招募成本
  negotiationDifficulty: number; // 谈判难度
  competingGuilds: string[]; // 竞争公会列表
  exclusiveRequirements?: string[]; // 特殊招募要求
  timeLimit?: Date; // 招募截止时间
}
```

**Acceptance（就地验收，占位）**

- P95 ≤ 200ms 首屏反馈；≤1s 上报 `txn.prd-guild-manager_chunk_004.primary`。

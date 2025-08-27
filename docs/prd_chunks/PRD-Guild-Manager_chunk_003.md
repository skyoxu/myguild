---
PRD-ID: "PRD-GM-PRD-GUILD-MANAGER_CHUNK_003"
Title: "公会管理器PRD - 分片3"
Status: "Active"
Owner: "Product-Team"
Created: "2024-12-01T00:00:00Z"
Updated: "2025-08-22T00:00:00Z"
Version: "v1.2.0"
Priority: "High"
Risk: "Medium"
Depends-On:
  - "PRD-GM-BASE-ARCHITECTURE"
chunk: "3/24"
size: "8685 chars"
source: "PRD-Guild-Manager.md"
Arch-Refs: [CH01, CH03, CH04, CH05, CH06]
Test-Refs:
  - "tests/unit/guild-manager-chunk-003.spec.ts"
Monitors:
  - "txn.prd-guild-manager_chunk_003.primary"
SLO-Refs:
  - "UI_P95_100ms"
  - "EVENT_P95_50ms"
  - "CRASH_FREE_99.5"
ADRs: [ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0010]
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
---
#### 3.2.3 战术中心模块

##### 3.2.3.1 阵容管理系统详细设计

```typescript
// 战术中心核心接口
interface TacticalCenter {
  raidCompositionManager: RaidCompositionManager   // PVE阵容管理器
  pvpCompositionManager: PVPCompositionManager     // PVP阵容管理器
  tacticsLibrary: TacticsLibrary                   // 战术库系统
  aiAutoAssignment: AIAutoAssignmentSystem         // AI自动分配系统
  memberAvailabilityTracker: MemberAvailabilityTracker // 成员可用性追踪
}

// PVE阵容管理器
interface RaidCompositionManager {
  maxRaidMembers: number                           // 最大阵容人数: 50人
  
  // 阵容配置
  raidCompositions: Map<string, RaidComposition>   // PVE阵容列表
  
  /* 创建PVE阵容 */
  createRaidComposition(name: string, raidType: RaidType): RaidComposition
  
  /* AI自动人员调配 */
  autoAssignMembers(compositionId: string, raidType: RaidType): AssignmentResult
  
  /* 手动分配成员到位置 */
  assignMemberToRole(compositionId: string, memberId: string, role: RaidRole): boolean
  
  /* 验证阵容有效性 */
  validateComposition(compositionId: string, raidType: RaidType): ValidationResult
}

// PVE阵容定义
interface RaidComposition {
  compositionId: string                            // 阵容ID
  name: string                                     // 阵容名称
  raidType: RaidType                              // 适用副本类型
  maxMembers: number                              // 该阵容最大人数
  
  // 三个核心位置
  roles: {
    tanks: RaidMemberSlot[]                       // 坦克位置
    dps: RaidMemberSlot[]                        // 输出位置  
    healers: RaidMemberSlot[]                    // 治疗位置
  }
  
  // 阵容状态
  currentMemberCount: number                       // 当前成员数量
  readinessLevel: ReadinessLevel                  // 准备程度
  lastModified: Date                              // 最后修改时间
  
  // AI分配影响因素
  assignmentFactors: {
    raidLeaderInfluence: OfficerInfluence         // RL官员影响
    classLeaderInfluence: Map<CharacterClass, OfficerInfluence> // 职业队长影响
    raidExperience: RaidExperienceLevel          // 副本熟练度
  }
}

// 副本类型及人数限制
enum RaidType {
  SMALL_DUNGEON = "小型副本",                      // 5人上限
  MEDIUM_DUNGEON = "中型副本",                     // 10人上限
  LARGE_DUNGEON = "大型副本",                      // 25人上限
  RAID_INSTANCE = "团队副本",                      // 40人上限
  MEGA_RAID = "超大副本"                          // 50人上限
}

// 成员槽位
interface RaidMemberSlot {
  slotId: string                                  // 槽位ID
  assignedMember?: string                         // 分配的成员ID
  requiredRole: RaidRole                          // 需要的角色
  priority: SlotPriority                          // 槽位优先级
  
  // 槽位状态
  isRequired: boolean                             // 是否必需
  isLocked: boolean                               // 是否锁定
  aiRecommendation?: string                       // AI推荐成员
}

enum RaidRole {
  MAIN_TANK = "主坦克",                           // 主坦克
  OFF_TANK = "副坦克",                            // 副坦克
  MELEE_DPS = "近战输出",                         // 近战输出
  RANGED_DPS = "远程输出",                        // 远程输出
  MAIN_HEALER = "主治疗",                         // 主治疗
  BACKUP_HEALER = "副治疗",                       // 副治疗
  UTILITY = "多用途"                              // 多用途角色
}

// PVP阵容管理器
interface PVPCompositionManager {
  // PVP阵容类型
  battlegroundCompositions: Map<string, PVPComposition> // 战场阵容
  arenaCompositions: Map<string, PVPComposition>        // 竞技场阵容
  
  /* 创建PVP阵容 */
  createPVPComposition(name: string, type: PVPType): PVPComposition
  
  /* 分配队长 */
  assignCaptain(compositionId: string, memberId: string): boolean
  
  /* 添加成员到PVP阵容 */
  addMemberToComposition(compositionId: string, memberId: string): boolean
}

// PVP阵容定义
interface PVPComposition {
  compositionId: string                           // 阵容ID
  name: string                                    // 阵容名称
  type: PVPType                                   // PVP类型
  
  // 成员配置
  captain: string                                 // 队长ID
  members: string[]                               // 成员ID列表
  maxMembers: number                              // 最大成员数
  
  // 队长影响
  captainBonuses: {
    leadershipBonus: number                       // 领导力加成
    tacticalBonus: number                         // 战术加成
    moraleBonus: number                           // 士气加成
  }
}

enum PVPType {
  BATTLEGROUND = "战场",                          // 战场PVP
  ARENA = "竞技场"                                // 竞技场PVP
}

// 成员可用性追踪
interface MemberAvailabilityTracker {
  /* 检查成员阵容冲突 */
  checkMemberConflicts(memberId: string): ConflictCheck
  
  /* 获取成员当前阵容 */
  getMemberCompositions(memberId: string): MemberCompositionStatus
  
  /* 验证成员可加入阵容 */
  canJoinComposition(memberId: string, compositionId: string, type: CompositionType): boolean
}

// 成员阵容状态
interface MemberCompositionStatus {
  memberId: string                                // 成员ID
  memberName: string                              // 成员姓名
  
  // 当前阵容归属
  currentCompositions: {
    pveComposition?: string                       // 当前PVE阵容
    battlegroundComposition?: string              // 当前战场阵容
    arenaComposition?: string                     // 当前竞技场阵容
  }
  
  // 冲突检查
  conflictStatus: {
    hasPVEConflict: boolean                       // 是否有PVE冲突
    hasBattlegroundConflict: boolean              // 是否有战场冲突
    hasArenaConflict: boolean                     // 是否有竞技场冲突
  }
}

// AI自动分配系统
interface AIAutoAssignmentSystem {
  /* 智能分配PVE阵容 */
  autoAssignRaidComposition(compositionId: string): AutoAssignmentResult
  
  /* 考虑官员影响的分配 */
  assignWithOfficerInfluence(compositionId: string): AssignmentResult
/* 生成最优阵容建议 */
  generateOptimalComposition(raidType: RaidType): CompositionRecommendation
}

// 官员影响系统
interface OfficerInfluence {
  officerId: string                               // 官员ID
  officerType: OfficerType                        // 官员类型
  influenceLevel: number                          // 影响力等级 (1-10)
  
  // 具体影响
  influences: {
    memberSelectionWeight: number                 // 成员选择权重
    roleAssignmentBonus: number                   // 角色分配加成
    compositionEfficiency: number                // 阵容效率提升
  }
}

enum OfficerType {
  RAID_LEADER = "团队领袖",                       // RL官员
  TANK_LEADER = "坦克队长",                       // 坦克职业队长
  DPS_LEADER = "输出队长",                         // 输出职业队长
  HEALER_LEADER = "治疗队长",                     // 治疗职业队长
  TACTICAL_OFFICER = "战术官员"                   // 战术专员
}
```

##### 3.2.3.2 战术库系统设计

```typescript
// 战术库系统
interface TacticsLibrary {
  unlockedTactics: Map<string, Tactic>            // 已解锁战术
  researchQueue: TacticResearchQueue              // 战术研究队列
  
  /* 解锁新战术 */
  unlockTactic(tacticId: string, unlockMethod: UnlockMethod): UnlockResult
  
  /* 升级战术 */
  upgradeTactic(tacticId: string): UpgradeResult
  
  /* 获取可用战术 */
  getAvailableTactics(compositionId: string, activityType: ActivityType): Tactic[]
}

// 战术定义
interface Tactic {
  tacticId: string                                // 战术ID
  name: string                                    // 战术名称
  description: string                             // 战术描述
  category: TacticCategory                        // 战术类别
  level: number                                   // 战术等级 (1-10)
  
  // 使用限制
  usageRestrictions: {
    raidTypeRestrictions: RaidType[]              // 副本类型限制
    minimumGuildLevel: number                     // 最低公会等级要求
    requiredOfficerLevel: number                  // 所需官员等级
    cooldownPeriod: number                        // 冷却期 (小时)
  }
  
  // 战术效果
  effects: TacticEffect[]                         // 战术效果列表
  
  // 选择影响因素
  selectionFactors: {
    guildLevelBonus: number                       // 公会等级加成
    raidLeaderBonus: number                       // RL官员属性加成
    raidFamiliarity: number                       // 副本熟练度加成
    maxSelectableCount: number                    // 最大可选数量
  }
}

// 战术类别
enum TacticCategory {
  RESOURCE_CONSUMPTION = "资源消耗型",             // 消耗资源增强战力
  SKILL_NEGATION = "技能抵消型",                  // 无消耗抵消特定技能
  FORMATION_ENHANCEMENT = "阵型强化型",            // 强化阵容配置
  EMERGENCY_RESPONSE = "应急响应型",               // 紧急情况处理
  BUFF_AMPLIFICATION = "增益放大型",               // 放大团队增益效果
  DEBUFF_RESISTANCE = "减益抗性型"                // 抵抗负面效果
}

// 战术效果
interface TacticEffect {
  effectId: string                                // 效果ID
  effectType: EffectType                          // 效果类型
  magnitude: number                               // 效果强度
  duration: number                                // 持续时间 (分钟)
  
  // 资源消耗
  resourceCost?: ResourceCost                     // 资源消耗 (如果有)
  
  // 目标和条件
  targets: EffectTarget[]                         // 作用目标
  conditions: EffectCondition[]                   // 生效条件
}

enum EffectType {
  DAMAGE_BOOST = "伤害提升",                      // 伤害增强
  DEFENSE_BOOST = "防御提升",                     // 防御增强
  HEALING_BOOST = "治疗提升",                     // 治疗增强
  RESISTANCE_GRANT = "抗性赋予",                  // 给予特定抗性
  SKILL_IMMUNITY = "技能免疫",                    // 免疫特定技能
  RESOURCE_EFFICIENCY = "资源效率",                // 提升资源使用效率
  COORDINATION_ENHANCEMENT = "协调强化"            // 提升团队协调性
}

// 战术解锁方式
enum UnlockMethod {
  BASE_FACILITY_RESEARCH = "基地设施研究",         // 通过基地设施研究解锁
  EVENT_COMPLETION = "事件完成",                  // 完成特定事件解锁
  LEGENDARY_MEMBER_JOIN = "传奇成员加入",          // 传奇成员带来的战术
  BOSS_FIRST_KILL = "Boss首杀",                  // Boss首杀奖励
  ALLIANCE_EXCHANGE = "联盟交换",                 // 与其他公会交换
  ACHIEVEMENT_REWARD = "成就奖励",                // 成就系统奖励
  SPECIAL_EVENT = "特殊事件"                      // 特殊活动解锁
}

// 战术选择系统
interface TacticSelectionSystem {
  /* 计算可选战术数量 */
  calculateSelectableCount(compositionId: string, activityType: ActivityType): number
  
  /* 选择战术组合 */
  selectTacticCombination(compositionId: string, selectedTactics: string[]): SelectionResult
  
  /* 验证战术兼容性 */
  validateTacticCompatibility(tactics: string[]): CompatibilityCheck
}

// 示例战术配置
const ExampleTactics: Record<string, Tactic> = {
  // 资源消耗型战术示例
  BLACK_DRAGON_HEAD: {
    tacticId: "black_dragon_head",
    name: "黑龙头挂饰",
    description: "消耗黑龙头道具，为全团提供火抗和伤害加成",
    category: TacticCategory.RESOURCE_CONSUMPTION,
    level: 5,
    effects: [
      {
        effectId: "fire_resistance_boost",
        effectType: EffectType.RESISTANCE_GRANT,
        magnitude: 50,
        duration: 60,
        resourceCost: {
          itemId: "black_dragon_head",
          quantity: 1
        }
      },
      {
        effectId: "damage_boost",
        effectType: EffectType.DAMAGE_BOOST,
        magnitude: 15,
        duration: 60
      }
    ]
  },
  
  // 技能抵消型战术示例
  FULL_FIRE_RESISTANCE: {
    tacticId: "full_fire_resistance",
    name: "全团火抗",
    description: "无消耗抵消Boss燃烧技能效果",
    category: TacticCategory.SKILL_NEGATION,
    level: 3,
    effects: [
      {
        effectId: "burn_immunity",
        effectType: EffectType.SKILL_IMMUNITY,
        magnitude: 100,
        duration: 180,
        conditions: [{
          conditionType: "boss_skill",
          targetSkill: "burning_flame"
        }]
      }
    ]
  }
}
```

**阵容管理规则：**

1. **成员分配限制**
   - 每位成员在同一类型阵容中只能加入一个（PVE、战场、竞技场各自独立）
   - 最大PVE阵容人数：50人
   - AI根据副本类型自动限制参战人员（如大型副本25人上限）

2. **AI智能分配**
   - 考虑RL官员和职业队长的影响
   - 基于成员属性、技能、经验进行最优匹配
   - 自动平衡角色分配（坦克/输出/治疗比例）

3. **战术系统机制**
   - 多种解锁途径：研究、事件、传奇成员等
   - 战术可升级强化，等级影响效果
   - 每次活动可多选战术，数量受多因素影响

**Acceptance（就地验收，占位）**
- P95 ≤ 200ms 首屏反馈；≤1s 上报 `txn.prd-guild-manager_chunk_003.primary`。
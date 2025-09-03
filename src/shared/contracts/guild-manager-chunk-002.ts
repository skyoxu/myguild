/**
 * 公会管理器 PVE 系统与战术中心 - 契约定义
 * @description PRD-GM-PRD-GUILD-MANAGER_CHUNK_002 对应的 TypeScript 契约
 */

import type { CloudEvent } from './cloudevents-core';
import { mkEvent } from './cloudevents-core';
import type { IRepository, Port, Id } from './ports';

// ============================================================================
// 核心枚举定义
// ============================================================================

export enum RaidType {
  SMALL_DUNGEON = '小型副本', // 5人
  MEDIUM_DUNGEON = '中型副本', // 10人
  LARGE_DUNGEON = '大型副本', // 25人
  RAID_INSTANCE = '团队副本', // 40人
  MEGA_RAID = '超大副本', // 50人
}

export enum DifficultyLevel {
  NORMAL = '普通',
  HEROIC = '英雄',
  EPIC = '史诗',
  LEGENDARY = '传奇',
}

export enum RaidRole {
  MAIN_TANK = '主坦克',
  OFF_TANK = '副坦克',
  MELEE_DPS = '近战输出',
  RANGED_DPS = '远程输出',
  MAIN_HEALER = '主治疗',
  BACKUP_HEALER = '副治疗',
  UTILITY = '多用途',
}

export enum ReadinessLevel {
  DRAFT = '草稿',
  INCOMPLETE = '不完整',
  READY = '就绪',
  ACTIVE = '活跃',
  ARCHIVED = '已归档',
}

export enum SlotPriority {
  REQUIRED = '必需',
  PREFERRED = '优先',
  OPTIONAL = '可选',
}

export enum ItemRarity {
  COMMON = '普通',
  UNCOMMON = '优秀',
  RARE = '稀有',
  EPIC = '史诗',
  LEGENDARY = '传奇',
}

// ============================================================================
// 核心实体接口
// ============================================================================

/**
 * 副本配置实体
 */
export interface RaidDungeon {
  id: Id;
  name: string;
  type: RaidType;
  difficulty: DifficultyLevel;
  minPlayers: number;
  maxPlayers: number;
  estimatedDuration: number; // 分钟
  lootTable: RaidReward[];
  bossEncounters: BossEncounter[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * 副本奖励定义
 */
export interface RaidReward {
  itemId: Id;
  itemName: string;
  rarity: ItemRarity;
  dropChance: number; // 0-1
  itemLevel: number;
  stats: Record<string, number>;
  requirements: ItemRequirement[];
}

/**
 * Boss 战斗遭遇
 */
export interface BossEncounter {
  encounterId: Id;
  name: string;
  phase: number;
  requiredRoles: RaidRole[];
  mechanics: string[];
  difficultyModifier: number;
}

/**
 * 物品需求
 */
export interface ItemRequirement {
  type: 'level' | 'class' | 'achievement';
  value: string | number;
  description: string;
}

/**
 * 阵容配置实体
 */
export interface RaidComposition {
  id: Id;
  compositionId: Id;
  name: string;
  raidType: RaidType;
  maxMembers: number;
  roles: {
    tanks: RaidMemberSlot[];
    dps: RaidMemberSlot[];
    healers: RaidMemberSlot[];
  };
  currentMemberCount: number;
  readinessLevel: ReadinessLevel;
  guildId: Id;
  createdBy: Id;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * 阵容成员槽位
 */
export interface RaidMemberSlot {
  slotId: Id;
  assignedMember?: Id;
  requiredRole: RaidRole;
  priority: SlotPriority;
  isRequired: boolean;
  isLocked: boolean;
  aiRecommendation?: Id;
  assignedAt?: string;
}

/**
 * 成员统计数据
 */
export interface MemberStats {
  memberId: Id;
  characterClass: string;
  itemLevel: number;
  raidExperience: number; // 0-100
  performanceScore: number; // 0-100
  availability: AvailabilityStatus;
  preferredRoles: RaidRole[];
  lastRaidDate?: string;
}

/**
 * 可用性状态
 */
export interface AvailabilityStatus {
  isOnline: boolean;
  isAvailable: boolean;
  unavailableUntil?: string;
  timezone: string;
}

/**
 * 战斗模拟实体
 */
export interface CombatSimulation {
  id: Id;
  simulationId: Id;
  raidComposition: RaidComposition;
  targetDungeon: RaidDungeon;
  memberStats: MemberStats[];
  tacticModifiers: TacticEffect[];
  predictedOutcome: CombatResult;
  confidenceScore: number; // 0-1
  readonly createdAt: Date;
  readonly updatedAt: Date;
  simulationTimeMs: number;
}

/**
 * 战术效果
 */
export interface TacticEffect {
  effectId: Id;
  name: string;
  type: 'buff' | 'debuff' | 'neutral';
  magnitude: number;
  duration?: number;
  applicableRoles: RaidRole[];
}

/**
 * 战斗结果
 */
export interface CombatResult {
  successProbability: number; // 0-1
  estimatedWipeCount: number;
  averageClearTime: number; // 分钟
  keyRisks: string[];
  strengthAreas: string[];
  recommendations: string[];
}

// ============================================================================
// 请求/响应 DTO
// ============================================================================

/**
 * 创建阵容请求
 */
export interface CreateRaidCompositionRequest {
  name: string;
  raidType: RaidType;
  guildId: Id;
  maxMembers?: number;
  templateId?: Id;
}

/**
 * AI 分配偏好设置
 */
export interface AssignmentPreferences {
  prioritizeExperience: boolean;
  prioritizeItemLevel: boolean;
  allowRoleFlexibility: boolean;
  preferredMembers?: Id[];
  excludedMembers?: Id[];
}

/**
 * 分配结果
 */
export interface AssignmentResult {
  success: boolean;
  assignedCount: number;
  unassignedSlots: Id[];
  conflicts: AssignmentConflict[];
  recommendations: string[];
  processingTimeMs: number;
}

/**
 * 分配冲突
 */
export interface AssignmentConflict {
  slotId: Id;
  conflictType: 'role_mismatch' | 'availability' | 'item_level' | 'experience';
  description: string;
  suggestedResolution: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number; // 0-100
}

/**
 * 验证错误
 */
export interface ValidationError {
  code: string;
  message: string;
  field: string;
  severity: 'error' | 'warning';
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  code: string;
  message: string;
  suggestion: string;
}

/**
 * 优化标准
 */
export interface OptimizationCriteria {
  targetDungeon?: Id;
  priorityWeights: {
    successProbability: number;
    clearTime: number;
    memberSatisfaction: number;
    resourceEfficiency: number;
  };
  constraints: OptimizationConstraint[];
}

/**
 * 优化约束
 */
export interface OptimizationConstraint {
  type: 'member_count' | 'role_distribution' | 'item_level' | 'experience';
  minValue?: number;
  maxValue?: number;
  exactValue?: number;
}

/**
 * 阵容优化结果
 */
export interface CompositionOptimization {
  optimizedComposition: RaidComposition;
  improvements: OptimizationImprovement[];
  estimatedGain: number; // 预期提升百分比
  confidence: number; // 0-1
}

/**
 * 优化改进项
 */
export interface OptimizationImprovement {
  type: 'role_swap' | 'member_replace' | 'slot_adjustment';
  description: string;
  expectedImpact: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * 战术报告
 */
export interface TacticalReport {
  compositionId: Id;
  overallRating: number; // 0-100
  strengthsAnalysis: string[];
  weaknessesAnalysis: string[];
  recommendations: TacticalRecommendation[];
  comparedCompositions?: CompositionComparison[];
  generatedAt: string;
}

/**
 * 战术建议
 */
export interface TacticalRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'composition' | 'tactics' | 'preparation' | 'equipment';
  description: string;
  expectedBenefit: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * 阵容对比
 */
export interface CompositionComparison {
  comparedCompositionId: Id;
  comparedCompositionName: string;
  scoreDifference: number;
  keyDifferences: string[];
}

// ============================================================================
// 事件定义 (CloudEvents 1.0)
// ============================================================================

/**
 * 副本相关域事件类型（CloudEvents 1.0格式）
 */
export type RaidDomainEventType =
  | 'io.vitegame.gm.raid.composition.created'
  | 'io.vitegame.gm.raid.composition.updated'
  | 'io.vitegame.gm.raid.composition.deleted'
  | 'io.vitegame.gm.raid.member.assigned'
  | 'io.vitegame.gm.raid.member.removed'
  | 'io.vitegame.gm.raid.simulation.started'
  | 'io.vitegame.gm.raid.simulation.completed'
  | 'io.vitegame.gm.raid.schedule.created'
  | 'io.vitegame.gm.raid.schedule.updated';

/**
 * 战术中心事件类型（CloudEvents 1.0格式）
 */
export type TacticalCenterEventType =
  | 'io.vitegame.gm.tactical.ai.assignment.started'
  | 'io.vitegame.gm.tactical.ai.assignment.completed'
  | 'io.vitegame.gm.tactical.composition.validated'
  | 'io.vitegame.gm.tactical.composition.optimized';

/**
 * 阵容创建事件数据
 */
export interface RaidCompositionCreatedData {
  compositionId: Id;
  raidType: RaidType;
  createdBy: Id;
  guildId: Id;
  timestamp: string;
  memberSlots: number;
}

/**
 * 战斗模拟完成事件数据
 */
export interface CombatSimulationCompletedData {
  simulationId: Id;
  compositionId: Id;
  dungeonId: Id;
  result: {
    successProbability: number;
    estimatedWipeCount: number;
    keyRisks: string[];
  };
  performance: {
    simulationTimeMs: number;
    accuracy: number;
  };
}

/**
 * AI 分配完成事件数据
 */
export interface AIAssignmentCompletedData {
  compositionId: Id;
  assignmentResult: AssignmentResult;
  requestedBy: Id;
  preferences?: AssignmentPreferences;
  timestamp: string;
}

// ============================================================================
// Repository 端口定义
// ============================================================================

/**
 * 副本管理 Repository
 */
export interface IRaidRepository extends IRepository<RaidDungeon, Id> {
  findByType(raidType: RaidType): Promise<RaidDungeon[]>;
  findByDifficulty(difficulty: DifficultyLevel): Promise<RaidDungeon[]>;
  findByPlayerCount(
    minPlayers: number,
    maxPlayers: number
  ): Promise<RaidDungeon[]>;
}

/**
 * 阵容管理 Repository
 */
export interface IRaidCompositionRepository
  extends IRepository<RaidComposition, Id> {
  findByGuildId(guildId: Id): Promise<RaidComposition[]>;
  findByRaidType(raidType: RaidType): Promise<RaidComposition[]>;
  findActiveCompositions(): Promise<RaidComposition[]>;
  updateMemberAssignment(
    compositionId: Id,
    slotId: Id,
    memberId: Id
  ): Promise<void>;
  findByCreator(creatorId: Id): Promise<RaidComposition[]>;
}

/**
 * 战斗模拟 Repository
 */
export interface ICombatSimulationRepository
  extends IRepository<CombatSimulation, Id> {
  findByComposition(compositionId: Id): Promise<CombatSimulation[]>;
  findRecentSimulations(limit: number): Promise<CombatSimulation[]>;
  saveSimulationResult(simulation: CombatSimulation): Promise<void>;
  findByDungeon(dungeonId: Id): Promise<CombatSimulation[]>;
}

// ============================================================================
// 应用服务端口定义
// ============================================================================

/**
 * 副本管理服务端口
 */
export interface IRaidManagementService extends Port {
  createRaidComposition(
    request: CreateRaidCompositionRequest
  ): Promise<RaidComposition>;
  assignMemberToRole(
    compositionId: Id,
    memberId: Id,
    role: RaidRole
  ): Promise<void>;
  autoAssignMembers(
    compositionId: Id,
    preferences?: AssignmentPreferences
  ): Promise<AssignmentResult>;
  validateComposition(compositionId: Id): Promise<ValidationResult>;
  removeComposition(compositionId: Id): Promise<void>;
  duplicateComposition(
    compositionId: Id,
    newName: string
  ): Promise<RaidComposition>;
}

/**
 * 战术中心服务端口
 */
export interface ITacticalCenterService extends Port {
  simulateCombat(compositionId: Id, dungeonId: Id): Promise<CombatSimulation>;
  optimizeComposition(
    compositionId: Id,
    criteria: OptimizationCriteria
  ): Promise<CompositionOptimization>;
  generateTacticalReport(compositionId: Id): Promise<TacticalReport>;
  compareCompositions(compositionIds: Id[]): Promise<CompositionComparison[]>;
}

// ============================================================================
// 事件源常量
// ============================================================================

export const RAID_EVENT_SOURCES = {
  RAID_MANAGEMENT: 'io.vitegame.gm://raid-management',
  TACTICAL_CENTER: 'io.vitegame.gm://tactical-center',
  COMBAT_SIMULATOR: 'io.vitegame.gm://combat-simulator',
  AI_ASSIGNMENT: 'io.vitegame.gm://ai-assignment',
} as const;

// ============================================================================
// SLO 常量定义
// ============================================================================

export const GUILD_MANAGER_CHUNK_002_SLOS = {
  RAID_UI_P95_MS: 100,
  COMBAT_SIM_P95_MS: 200,
  AI_ASSIGNMENT_P95_MS: 500,
  COMPOSITION_SAVE_P95_MS: 50,
  COMPOSITION_SUCCESS_RATE: 0.98,
  AI_ASSIGNMENT_ACCURACY: 0.85,
  SIMULATION_CONFIDENCE: 0.8,
} as const;

/**
 * 类型守卫和工具函数
 */
export function isValidRaidType(value: string): value is RaidType {
  return Object.values(RaidType).includes(value as RaidType);
}

export function isValidRaidRole(value: string): value is RaidRole {
  return Object.values(RaidRole).includes(value as RaidRole);
}

export function isValidDifficultyLevel(
  value: string
): value is DifficultyLevel {
  return Object.values(DifficultyLevel).includes(value as DifficultyLevel);
}

/**
 * 阵容容量限制映射
 */
export const RAID_TYPE_CAPACITY: Record<
  RaidType,
  { min: number; max: number }
> = {
  [RaidType.SMALL_DUNGEON]: { min: 3, max: 5 },
  [RaidType.MEDIUM_DUNGEON]: { min: 5, max: 10 },
  [RaidType.LARGE_DUNGEON]: { min: 15, max: 25 },
  [RaidType.RAID_INSTANCE]: { min: 25, max: 40 },
  [RaidType.MEGA_RAID]: { min: 35, max: 50 },
};

/**
 * 角色分配建议比例
 */
export const ROLE_DISTRIBUTION_GUIDE: Record<
  RaidType,
  { tanks: number; healers: number; dps: number }
> = {
  [RaidType.SMALL_DUNGEON]: { tanks: 1, healers: 1, dps: 3 },
  [RaidType.MEDIUM_DUNGEON]: { tanks: 2, healers: 2, dps: 6 },
  [RaidType.LARGE_DUNGEON]: { tanks: 3, healers: 5, dps: 17 },
  [RaidType.RAID_INSTANCE]: { tanks: 4, healers: 8, dps: 28 },
  [RaidType.MEGA_RAID]: { tanks: 5, healers: 10, dps: 35 },
};

// ============================================================================
// CloudEvents 1.0 完整实现
// ============================================================================

/** 联合事件类型 */
export type RaidManagerEventType =
  | RaidDomainEventType
  | TacticalCenterEventType;

/** 副本管理CloudEvent类型定义 */
export type RaidManagerCloudEvent<T = any> = CloudEvent<T> & {
  type: RaidManagerEventType;
  source: (typeof RAID_EVENT_SOURCES)[keyof typeof RAID_EVENT_SOURCES];
};

/** CloudEvent工厂函数 */
export const createRaidEvent = <T>(
  type: RaidManagerEventType,
  source: keyof typeof RAID_EVENT_SOURCES,
  data: T,
  options: {
    compositionId?: Id;
    guildId?: Id;
    subject?: string;
  } = {}
): RaidManagerCloudEvent<T> => {
  return mkEvent({
    type,
    source: RAID_EVENT_SOURCES[source],
    data,
    subject: options.subject || options.compositionId?.toString() || options.guildId?.toString(),
    datacontenttype: 'application/json',
  }) as RaidManagerCloudEvent<T>;
};

/** 具体事件类型定义 */
export type RaidCompositionCreatedEvent =
  RaidManagerCloudEvent<RaidCompositionCreatedData>;
export type CombatSimulationCompletedEvent =
  RaidManagerCloudEvent<CombatSimulationCompletedData>;
export type AIAssignmentCompletedEvent =
  RaidManagerCloudEvent<AIAssignmentCompletedData>;

/**
 * 公会管理器核心类型定义
 * 包含值对象、数据传输对象和领域特定类型
 */

import {
  GuildRole,
  MemberRarity,
  LegendaryType,
  RaidType,
  DifficultyLevel,
  RaidRole,
  ReadinessLevel,
  RecruitmentSource,
  PersonalityTrait,
  RelationshipType,
  AttitudeCategory,
  ActivityType,
  FacilityType,
  TacticCategory,
  EffectType,
} from './guild-manager-interfaces';

// ============== 值对象类型 ==============

export class GuildId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('GuildId cannot be empty');
    }
  }

  static generate(): GuildId {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return new GuildId(`guild-${timestamp}-${random}`);
  }

  equals(other: GuildId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class MemberId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('MemberId cannot be empty');
    }
  }

  static generate(): MemberId {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return new MemberId(`member-${timestamp}-${random}`);
  }

  equals(other: MemberId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class ResourceAmount {
  constructor(
    public readonly gold: number,
    public readonly materials: number,
    public readonly influence: number
  ) {
    if (gold < 0 || materials < 0 || influence < 0) {
      throw new Error('Resource amounts cannot be negative');
    }
  }

  static empty(): ResourceAmount {
    return new ResourceAmount(0, 0, 0);
  }

  static create(
    resources: Partial<{ gold: number; materials: number; influence: number }>
  ): ResourceAmount {
    return new ResourceAmount(
      resources.gold || 0,
      resources.materials || 0,
      resources.influence || 0
    );
  }

  add(other: ResourceAmount): ResourceAmount {
    return new ResourceAmount(
      this.gold + other.gold,
      this.materials + other.materials,
      this.influence + other.influence
    );
  }

  subtract(other: ResourceAmount): ResourceAmount {
    const newGold = this.gold - other.gold;
    const newMaterials = this.materials - other.materials;
    const newInfluence = this.influence - other.influence;

    if (newGold < 0 || newMaterials < 0 || newInfluence < 0) {
      throw new Error('Cannot subtract more resources than available');
    }

    return new ResourceAmount(newGold, newMaterials, newInfluence);
  }

  canAfford(cost: ResourceAmount): boolean {
    return (
      this.gold >= cost.gold &&
      this.materials >= cost.materials &&
      this.influence >= cost.influence
    );
  }

  getTotal(): number {
    return this.gold + this.materials + this.influence;
  }

  isEmpty(): boolean {
    return this.gold === 0 && this.materials === 0 && this.influence === 0;
  }
}

export class SatisfactionLevel {
  private static readonly MIN_VALUE = 0;
  private static readonly MAX_VALUE = 100;

  constructor(public readonly value: number) {
    if (
      value < SatisfactionLevel.MIN_VALUE ||
      value > SatisfactionLevel.MAX_VALUE
    ) {
      throw new Error(
        `Satisfaction level must be between ${SatisfactionLevel.MIN_VALUE} and ${SatisfactionLevel.MAX_VALUE}`
      );
    }
  }

  get level(): SatisfactionCategory {
    if (this.value >= 80) return SatisfactionCategory.VERY_SATISFIED;
    if (this.value >= 60) return SatisfactionCategory.SATISFIED;
    if (this.value >= 40) return SatisfactionCategory.NEUTRAL;
    if (this.value > 20) return SatisfactionCategory.DISSATISFIED;
    return SatisfactionCategory.VERY_DISSATISFIED;
  }

  adjust(change: number): SatisfactionLevel {
    const newValue = Math.max(
      SatisfactionLevel.MIN_VALUE,
      Math.min(SatisfactionLevel.MAX_VALUE, this.value + change)
    );
    return new SatisfactionLevel(newValue);
  }

  isLow(): boolean {
    return this.value < 30;
  }

  isHigh(): boolean {
    return this.value > 70;
  }
}

export enum SatisfactionCategory {
  VERY_DISSATISFIED = 'VERY_DISSATISFIED',
  DISSATISFIED = 'DISSATISFIED',
  NEUTRAL = 'NEUTRAL',
  SATISFIED = 'SATISFIED',
  VERY_SATISFIED = 'VERY_SATISFIED',
}

// ============== 数据传输对象 ==============

export interface GuildDTO {
  readonly id: string;
  readonly name: string;
  readonly leaderId: string;
  readonly level: number;
  readonly experience: number;
  readonly reputation: number;
  readonly resources: ResourceAmountDTO;
  readonly memberCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResourceAmountDTO {
  readonly gold: number;
  readonly materials: number;
  readonly influence: number;
}

export interface GuildMemberDTO {
  readonly id: string;
  readonly guildId: string;
  readonly name: string;
  readonly race: string;
  readonly characterClass: string;
  readonly specialization: string;
  readonly level: number;
  readonly gearScore: number;
  readonly isLegendary: boolean;
  readonly legendaryType?: LegendaryType;
  readonly rarity: MemberRarity;

  // 核心属性
  readonly skill: number;
  readonly loyalty: number;
  readonly teamwork: number;
  readonly ambition: number;

  // 状态属性
  readonly satisfaction: number;
  readonly fatigue: number;
  readonly morale: number;
  readonly availability: number;

  // 社交属性
  readonly intimacyWithLeader: number;
  readonly personality: readonly PersonalityTrait[];

  // 游戏机制属性
  readonly recruitmentSource: RecruitmentSource;
  readonly joinDate: string;
  readonly currentRole: GuildRole;

  // 统计数据
  readonly activityStats: ActivityStatsDTO;
  readonly experience: MemberExperienceDTO;
}

export interface ActivityStatsDTO {
  readonly totalActivities: number;
  readonly successRate: number;
  readonly mvpCount: number;
  readonly lastActivityDate: string;
}

export interface MemberExperienceDTO {
  readonly totalLevel: number;
  readonly raidExperience: number;
  readonly pvpExperience: number;
  readonly socialExperience: number;
  readonly leadershipExperience: number;
}

export interface RaidCompositionDTO {
  readonly id: string;
  readonly name: string;
  readonly guildId: string;
  readonly raidType: RaidType;
  readonly maxMembers: number;
  readonly currentMemberCount: number;
  readonly readinessLevel: ReadinessLevel;
  readonly lastModified: string;
  readonly roles: {
    readonly tanks: readonly RaidMemberSlotDTO[];
    readonly dps: readonly RaidMemberSlotDTO[];
    readonly healers: readonly RaidMemberSlotDTO[];
  };
}

export interface RaidMemberSlotDTO {
  readonly slotId: string;
  readonly assignedMemberId?: string;
  readonly requiredRole: RaidRole;
  readonly priority: SlotPriority;
  readonly isRequired: boolean;
  readonly isLocked: boolean;
  readonly aiRecommendation?: string;
}

export interface RaidConfigurationDTO {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly raidType: RaidType;
  readonly difficulty: DifficultyLevel;
  readonly minLevel: number;
  readonly recommendedLevel: number;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly estimatedDuration: number;
  readonly roleRequirements: RoleRequirementsDTO;
  readonly encounters: readonly EncounterDTO[];
  readonly rewards: readonly RaidRewardDTO[];
}

export interface RoleRequirementsDTO {
  readonly minTanks: number;
  readonly maxTanks: number;
  readonly minHealers: number;
  readonly maxHealers: number;
  readonly minDPS: number;
  readonly maxDPS: number;
}

export interface EncounterDTO {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly level: number;
  readonly health: number;
  readonly armor: number;
  readonly abilities: readonly BossAbilityDTO[];
  readonly phases: readonly EncounterPhaseDTO[];
  readonly lootTable: readonly LootEntryDTO[];
}

export interface BossAbilityDTO {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly castTime: number;
  readonly cooldown: number;
  readonly range: number;
  readonly damageType: DamageType;
  readonly targetType: TargetType;
  readonly effects: readonly AbilityEffectDTO[];
}

export interface RaidResultDTO {
  readonly raidId: string;
  readonly success: boolean;
  readonly duration: number;
  readonly successProbability: number;
  readonly casualties: readonly CasualtyDTO[];
  readonly lootDrops: readonly LootEntryDTO[];
  readonly experienceGained: number;
  readonly reputationGained: number;
  readonly mvpMemberId?: string;
  readonly completedAt: string;
}

export interface IntimacyDataDTO {
  readonly characterId: string;
  readonly intimacyLevel: number;
  readonly intimacyValue: number;
  readonly relationshipType: RelationshipType;
  readonly lastInteractionDate: string;
  readonly characterInfo: CharacterInfoDTO;
  readonly interactionHistory: readonly InteractionRecordDTO[];
}

export interface CharacterInfoDTO {
  readonly name: string;
  readonly guildId?: string;
  readonly characterClass: string;
  readonly specialization: string;
  readonly reputation: number;
  readonly avatar?: string;
}

export interface ContactActionDTO {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly intimacyRequirement: number;
  readonly cooldown: number;
  readonly cost?: ResourceAmountDTO;
  readonly successRate: number;
  readonly intimacyChange: IntimacyChangeDTO;
  readonly possibleEvents: readonly string[];
}

export interface IntimacyChangeDTO {
  readonly onSuccess: number;
  readonly onFailure: number;
  readonly onCriticalSuccess?: number;
}

export interface NPCGuildDTO {
  readonly id: string;
  readonly name: string;
  readonly tier: number;
  readonly reputation: number;
  readonly strategy: GuildStrategy;
  readonly specialties: readonly string[];
  readonly personality: readonly AIPersonalityTrait[];
  readonly homebase: string;
  readonly legendaryMemberCount: number;
  readonly diplomaticAttitude: DiplomaticAttitudeDTO;
  readonly historyMilestones: readonly GuildHistoryRecordDTO[];
  readonly currentRanking: number;
  readonly relationshipWithPlayer: number;
}

export interface DiplomaticAttitudeDTO {
  readonly attitudeValue: number;
  readonly attitudeCategory: AttitudeCategory;
  readonly stabilityFactor: number;
  readonly lastUpdateTime: string;
  readonly attitudeFactors: DiplomaticAttitudeFactorsDTO;
}

export interface DiplomaticAttitudeFactorsDTO {
  readonly historicalRelations: number;
  readonly recentInteractions: number;
  readonly competitiveRivalry: number;
  readonly diplomaticEfforts: number;
  readonly thirdPartyInfluence: number;
  readonly personalityAlignment: number;
}

// ============== 业务规则类型 ==============

export interface ValidationRule<T> {
  readonly name: string;
  readonly validate: (item: T) => ValidationResult;
  readonly severity: ValidationSeverity;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

export interface ValidationError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly value?: any;
}

export interface ValidationWarning {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly suggestion?: string;
}

export enum ValidationSeverity {
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

// ============== 查询和过滤类型 ==============

export interface MemberSearchCriteria {
  readonly classFilter?: readonly string[];
  readonly levelRange?: readonly [number, number];
  readonly skillRange?: readonly [number, number];
  readonly rarityFilter?: readonly MemberRarity[];
  readonly legendaryOnly?: boolean;
  readonly personalityTraits?: readonly PersonalityTrait[];
  readonly availabilityMin?: number;
  readonly satisfactionMin?: number;
  readonly roleFilter?: readonly RaidRole[];
}

export interface GuildSearchCriteria {
  readonly namePattern?: string;
  readonly tierRange?: readonly [number, number];
  readonly reputationRange?: readonly [number, number];
  readonly hasLegendaryMembers?: boolean;
  readonly diplomaticAttitude?: AttitudeCategory;
  readonly specialties?: readonly string[];
}

export interface RaidSearchCriteria {
  readonly difficultyFilter?: readonly DifficultyLevel[];
  readonly typeFilter?: readonly RaidType[];
  readonly levelRange?: readonly [number, number];
  readonly durationRange?: readonly [number, number];
  readonly rewardType?: readonly string[];
}

export interface PaginationOptions {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy?: string;
  readonly sortDirection?: 'ASC' | 'DESC';
}

export interface SortOptions {
  readonly field: string;
  readonly direction: 'ASC' | 'DESC';
}

// ============== 事件相关类型 ==============

export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventVersion: number;
  readonly occurredAt: Date;
  readonly eventData: any;
}

export interface EventStore {
  readonly saveEvents: (
    aggregateId: string,
    events: readonly DomainEvent[],
    expectedVersion: number
  ) => Promise<void>;
  readonly getEvents: (
    aggregateId: string,
    fromVersion?: number
  ) => Promise<readonly DomainEvent[]>;
}

// ============== 枚举补充 ==============

export enum SlotPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  FLEXIBLE = 'FLEXIBLE',
}

export enum DamageType {
  PHYSICAL = 'PHYSICAL',
  MAGICAL = 'MAGICAL',
  FIRE = 'FIRE',
  ICE = 'ICE',
  POISON = 'POISON',
  HOLY = 'HOLY',
  SHADOW = 'SHADOW',
}

export enum TargetType {
  SINGLE_ENEMY = 'SINGLE_ENEMY',
  MULTIPLE_ENEMIES = 'MULTIPLE_ENEMIES',
  SINGLE_ALLY = 'SINGLE_ALLY',
  MULTIPLE_ALLIES = 'MULTIPLE_ALLIES',
  SELF = 'SELF',
  AREA_OF_EFFECT = 'AREA_OF_EFFECT',
}

export enum GuildStrategy {
  AGGRESSIVE_EXPANSION = 'AGGRESSIVE_EXPANSION',
  DEFENSIVE_CONSOLIDATION = 'DEFENSIVE_CONSOLIDATION',
  DIPLOMATIC_NETWORKING = 'DIPLOMATIC_NETWORKING',
  ECONOMIC_FOCUS = 'ECONOMIC_FOCUS',
  RESEARCH_ORIENTED = 'RESEARCH_ORIENTED',
  BALANCED_APPROACH = 'BALANCED_APPROACH',
}

export enum AIPersonalityTrait {
  COMPETITIVE = 'COMPETITIVE',
  COLLABORATIVE = 'COLLABORATIVE',
  INNOVATIVE = 'INNOVATIVE',
  TRADITIONAL = 'TRADITIONAL',
  RISK_TAKING = 'RISK_TAKING',
  RISK_AVERSE = 'RISK_AVERSE',
  DIPLOMATIC = 'DIPLOMATIC',
  AGGRESSIVE = 'AGGRESSIVE',
}

export enum BenefitType {
  RESOURCE_GENERATION = 'RESOURCE_GENERATION',
  MEMBER_CAPACITY = 'MEMBER_CAPACITY',
  RESEARCH_SPEED = 'RESEARCH_SPEED',
  RECRUITMENT_EFFICIENCY = 'RECRUITMENT_EFFICIENCY',
  DIPLOMATIC_INFLUENCE = 'DIPLOMATIC_INFLUENCE',
  COMBAT_EFFECTIVENESS = 'COMBAT_EFFECTIVENESS',
}

export enum UnlockMethod {
  BASE_FACILITY_RESEARCH = 'BASE_FACILITY_RESEARCH',
  EVENT_COMPLETION = 'EVENT_COMPLETION',
  LEGENDARY_MEMBER_JOIN = 'LEGENDARY_MEMBER_JOIN',
  BOSS_FIRST_KILL = 'BOSS_FIRST_KILL',
  ALLIANCE_EXCHANGE = 'ALLIANCE_EXCHANGE',
  ACHIEVEMENT_REWARD = 'ACHIEVEMENT_REWARD',
  SPECIAL_EVENT = 'SPECIAL_EVENT',
}

// ============== 扩展的DTO类型 ==============

export interface EncounterPhaseDTO {
  readonly phaseId: string;
  readonly name: string;
  readonly healthThreshold: number;
  readonly duration?: number;
  readonly specialMechanics: readonly string[];
  readonly phaseAbilities: readonly string[];
}

export interface AbilityEffectDTO {
  readonly effectId: string;
  readonly effectType: EffectType;
  readonly magnitude: number;
  readonly duration: number;
  readonly target: TargetType;
}

export interface LootEntryDTO {
  readonly itemId: string;
  readonly itemName: string;
  readonly rarity: ItemRarity;
  readonly dropChance: number;
  readonly itemLevel: number;
  readonly stats?: ItemStatsDTO;
}

export interface ItemStatsDTO {
  readonly strength?: number;
  readonly agility?: number;
  readonly intellect?: number;
  readonly stamina?: number;
  readonly criticalStrike?: number;
  readonly haste?: number;
  readonly mastery?: number;
}

export enum ItemRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

export interface CasualtyDTO {
  readonly memberId: string;
  readonly memberName: string;
  readonly casualtyType: CasualtyType;
  readonly recoveryTime?: number;
  readonly impactOnMorale: number;
}

export enum CasualtyType {
  MINOR_INJURY = 'MINOR_INJURY',
  SERIOUS_INJURY = 'SERIOUS_INJURY',
  TEMPORARY_UNAVAILABLE = 'TEMPORARY_UNAVAILABLE',
  EQUIPMENT_DAMAGE = 'EQUIPMENT_DAMAGE',
  MORALE_DAMAGE = 'MORALE_DAMAGE',
}

export interface InteractionRecordDTO {
  readonly actionId: string;
  readonly date: string;
  readonly result: InteractionResult;
  readonly intimacyChange: number;
  readonly description?: string;
}

export enum InteractionResult {
  CRITICAL_SUCCESS = 'CRITICAL_SUCCESS',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  CRITICAL_FAILURE = 'CRITICAL_FAILURE',
}

export interface GuildHistoryRecordDTO {
  readonly id: string;
  readonly eventType: HistoryEventType;
  readonly eventTitle: string;
  readonly eventDescription: string;
  readonly achievementDate: string;
  readonly significance: SignificanceLevel;
  readonly relatedData: Record<string, any>;
  readonly impactAssessment: HistoryImpactAssessmentDTO;
}

export interface HistoryImpactAssessmentDTO {
  readonly reputationGain: number;
  readonly rivalryEffect: Record<string, number>;
  readonly memberMoraleBoost: number;
}

export enum HistoryEventType {
  RAID_FIRST_CLEAR = 'RAID_FIRST_CLEAR',
  BOSS_FIRST_KILL = 'BOSS_FIRST_KILL',
  RANKING_ACHIEVEMENT = 'RANKING_ACHIEVEMENT',
  PVP_VICTORY = 'PVP_VICTORY',
  DIPLOMATIC_BREAKTHROUGH = 'DIPLOMATIC_BREAKTHROUGH',
  MEMBER_LEGENDARY = 'MEMBER_LEGENDARY',
  FACILITY_BREAKTHROUGH = 'FACILITY_BREAKTHROUGH',
  ECONOMIC_MILESTONE = 'ECONOMIC_MILESTONE',
  CRISIS_RESOLUTION = 'CRISIS_RESOLUTION',
  ALLIANCE_FORMATION = 'ALLIANCE_FORMATION',
}

export enum SignificanceLevel {
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  MAJOR = 'MAJOR',
  LEGENDARY = 'LEGENDARY',
  EPOCH_MAKING = 'EPOCH_MAKING',
}

export interface RaidRewardDTO {
  readonly rewardId: string;
  readonly type: RewardType;
  readonly amount: number;
  readonly description: string;
  readonly conditions?: readonly string[];
}

export enum RewardType {
  EXPERIENCE = 'EXPERIENCE',
  GOLD = 'GOLD',
  MATERIALS = 'MATERIALS',
  REPUTATION = 'REPUTATION',
  ITEM = 'ITEM',
  BLUEPRINT = 'BLUEPRINT',
}

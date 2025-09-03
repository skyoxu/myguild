/**
 * 公会管理器核心接口定义
 * 定义系统中主要实体和值对象的接口契约
 */

// ============== 公会核心接口 ==============

export interface IGuild {
  readonly id: string;
  readonly name: string;
  readonly leader: IGuildLeader;
  readonly level: number;
  readonly experience: number;
  readonly reputation: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  // 方法
  recruitMember(
    candidate: IMemberCandidate,
    cost: IResourceCost
  ): Promise<IOperationResult<void>>;
  promoteMember(
    memberId: string,
    newRole: GuildRole
  ): Promise<IOperationResult<void>>;
  dismissMember(
    memberId: string,
    reason: string
  ): Promise<IOperationResult<void>>;
  organizeRaid(
    config: IRaidConfiguration,
    composition: IRaidComposition
  ): Promise<IOperationResult<IRaidInstance>>;
  upgradeGuild(targetLevel: number): Promise<IOperationResult<void>>;

  // 查询方法
  getMembers(): readonly IGuildMember[];
  getMember(memberId: string): IGuildMember | undefined;
  getFacilities(): readonly IGuildFacility[];
  getResources(): IGuildResources;
}

export interface IGuildLeader extends IBaseCharacter {
  readonly leadership: number;
  readonly charisma: number;
  readonly strategy: number;
  readonly management: number;
  readonly reputation: number;
  readonly leadershipSkills: readonly ILeadershipSkill[];
  readonly intimacyMap: ReadonlyMap<string, number>;
  readonly contactList: readonly IContactEntry[];
}

export interface IGuildMember extends IBaseCharacter {
  readonly guildId: string;
  readonly race: string;
  readonly characterClass: string;
  readonly specialization: string;
  readonly isLegendary: boolean;
  readonly legendaryType?: LegendaryType;
  readonly legendaryAbilities?: readonly ILegendaryAbility[];
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

  // 社交和AI属性
  readonly intimacyWithLeader: number;
  readonly memberRelationships: ReadonlyMap<string, number>;
  readonly personality: readonly PersonalityTrait[];
  readonly aiGoals: readonly IPersonalGoal[];
  readonly behaviorPattern: IBehaviorPattern;

  // 游戏机制属性
  readonly recruitmentSource: RecruitmentSource;
  readonly joinDate: Date;
  readonly currentRole: GuildRole;

  // 方法
  updateSatisfaction(change: number, reason: string): void;
  gainExperience(activityType: ActivityType, amount: number): void;
  canParticipateInActivity(activityType: ActivityType): boolean;
}

export interface IBaseCharacter {
  readonly id: string;
  readonly name: string;
  readonly avatar: string;
  readonly level: number;
  readonly gearScore: number;
  readonly experience: IMemberExperience;
  readonly activityStats: IActivityStats;
}

// ============== 资源和设施接口 ==============

export interface IGuildResources {
  readonly gold: number;
  readonly materials: number;
  readonly influence: number;

  canAfford(cost: IResourceCost): boolean;
  deduct(cost: IResourceCost): IOperationResult<void>;
  add(resources: Partial<IGuildResources>): void;
  getTotal(): number;
}

export interface IResourceCost {
  readonly gold?: number;
  readonly materials?: number;
  readonly influence?: number;
}

export interface IGuildFacility {
  readonly id: string;
  readonly name: string;
  readonly type: FacilityType;
  readonly level: number;
  readonly maxLevel: number;
  readonly upgradeCost: IResourceCost;
  readonly benefits: readonly IFacilityBenefit[];
  readonly isUnlocked: boolean;
  readonly constructionProgress?: number;
}

export interface IFacilityBenefit {
  readonly type: BenefitType;
  readonly value: number;
  readonly description: string;
}

export enum BenefitType {
  MEMBER_CAPACITY = 'MEMBER_CAPACITY',
  RESOURCE_PRODUCTION = 'RESOURCE_PRODUCTION',
  SKILL_BOOST = 'SKILL_BOOST',
  EXPERIENCE_BONUS = 'EXPERIENCE_BONUS',
  REPUTATION_BONUS = 'REPUTATION_BONUS',
  COST_REDUCTION = 'COST_REDUCTION',
  UNLOCK_FEATURE = 'UNLOCK_FEATURE',
}

// ============== 战斗和副本接口 ==============

export interface IRaidConfiguration {
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
  readonly roleRequirements: IRoleRequirements;
  readonly encounters: readonly IEncounter[];
  readonly rewards: readonly IRaidReward[];
}

export interface IRoleRequirements {
  readonly minTanks: number;
  readonly maxTanks: number;
  readonly minHealers: number;
  readonly maxHealers: number;
  readonly minDPS: number;
  readonly maxDPS: number;
}

export interface IRaidReward {
  readonly id: string;
  readonly type: 'ITEM' | 'RESOURCE' | 'EXPERIENCE' | 'REPUTATION';
  readonly itemId?: string;
  readonly amount: number;
  readonly rarity?: ItemRarity;
  readonly dropChance: number;
}

export interface IEncounter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly level: number;
  readonly health: number;
  readonly abilities: readonly IBossAbility[];
  readonly phases: readonly IEncounterPhase[];
  readonly lootTable: readonly ILootEntry[];
}

export interface IRaidComposition {
  readonly id: string;
  readonly name: string;
  readonly guildId: string;
  readonly raidType: RaidType;
  readonly maxMembers: number;
  readonly currentMemberCount: number;
  readonly readinessLevel: ReadinessLevel;
  readonly lastModified: Date;

  readonly roles: {
    readonly tanks: readonly IRaidMemberSlot[];
    readonly dps: readonly IRaidMemberSlot[];
    readonly healers: readonly IRaidMemberSlot[];
  };

  // 方法
  assignMember(slotId: string, memberId: string): IOperationResult<void>;
  removeMember(slotId: string): IOperationResult<void>;
  validate(): IValidationResult;
  getTotalMemberCount(): number;
  getParticipantIds(): readonly string[];
}

export enum SlotPriority {
  REQUIRED = 'REQUIRED',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  OPTIONAL = 'OPTIONAL',
}

export interface IRaidMemberSlot {
  readonly slotId: string;
  readonly assignedMember?: string;
  readonly requiredRole: RaidRole;
  readonly priority: SlotPriority;
  readonly isRequired: boolean;
  readonly isLocked: boolean;
  readonly aiRecommendation?: string;
}

export interface IRaidInstance {
  readonly id: string;
  readonly guildId: string;
  readonly raidConfigId: string;
  readonly compositionId: string;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly result?: IRaidResult;
  readonly participants: readonly string[];

  // 方法
  start(): Promise<void>;
  complete(result: IRaidResult): Promise<void>;
  calculateResult(): Promise<IRaidResult>;
}

export interface IRaidResult {
  readonly success: boolean;
  readonly duration: number;
  readonly successProbability: number;
  readonly casualties: readonly ICasualty[];
  readonly lootDrops: readonly ILootEntry[];
  readonly experienceGained: number;
  readonly reputationGained: number;
  readonly combatLog: readonly ICombatLogEntry[];
}

// ============== 战术系统接口 ==============

export interface ITacticalCenter {
  readonly raidCompositionManager: IRaidCompositionManager;
  readonly pvpCompositionManager: IPVPCompositionManager;
  readonly tacticsLibrary: ITacticsLibrary;
  readonly aiAutoAssignment: IAIAutoAssignmentSystem;
  readonly memberAvailabilityTracker: IMemberAvailabilityTracker;
}

export enum UnlockMethod {
  RESEARCH = 'RESEARCH',
  PURCHASE = 'PURCHASE',
  REWARD = 'REWARD',
  DISCOVERY = 'DISCOVERY',
  TRADE = 'TRADE',
}

export interface ITacticsLibrary {
  readonly unlockedTactics: ReadonlyMap<string, ITactic>;
  readonly researchQueue: ITacticResearchQueue;

  unlockTactic(
    tacticId: string,
    method: UnlockMethod
  ): Promise<IOperationResult<void>>;
  upgradeTactic(tacticId: string): Promise<IOperationResult<void>>;
  getAvailableTactics(
    compositionId: string,
    activityType: ActivityType
  ): readonly ITactic[];
}

export interface ITactic {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: TacticCategory;
  readonly level: number;
  readonly effects: readonly ITacticEffect[];
  readonly usageRestrictions: ITacticRestrictions;
  readonly selectionFactors: ITacticSelectionFactors;
}

export interface ITacticEffect {
  readonly id: string;
  readonly type: EffectType;
  readonly magnitude: number;
  readonly duration: number;
  readonly resourceCost?: IResourceCost;
  readonly targets: readonly EffectTarget[];
  readonly conditions: readonly IEffectCondition[];
}

// ============== 亲密度和社交系统接口 ==============

export interface IIntimacySystem {
  readonly globalIntimacyMap: ReadonlyMap<string, IIntimacyData>;
  readonly contactList: readonly IContactEntry[];
  readonly intimacyTriggers: readonly IIntimacyTrigger[];

  updateIntimacy(characterId: string, change: number): void;
  triggerIntimacyEvent(characterId: string): Promise<void>;
  addToContactList(characterId: string): void;
  getAvailableActions(characterId: string): readonly IContactAction[];
}

export interface IIntimacyData {
  readonly characterId: string;
  readonly intimacyLevel: number;
  readonly intimacyValue: number;
  readonly relationshipType: RelationshipType;
  readonly lastInteractionDate: Date;
  readonly interactionHistory: readonly IInteractionRecord[];
  readonly characterInfo: ICharacterInfo;
}

export interface IContactEntry {
  readonly intimacyData: IIntimacyData;
  readonly availableActions: readonly IContactAction[];
  readonly lastActionDate?: Date;
  readonly actionCooldowns: ReadonlyMap<string, Date>;
}

export interface IContactAction {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly intimacyRequirement: number;
  readonly cooldown: number;
  readonly cost?: IResourceCost;
  readonly successRate: number;
  readonly intimacyChange: IIntimacyChange;
  readonly possibleEvents: readonly string[];
}

// ============== NPC公会和世界生成接口 ==============

export interface IWorldGenerationSystem {
  readonly guildArchetypes: readonly INPCGuildArchetype[];

  generateCompetitors(): readonly INPCGuild[];
  initializeWorldState(competitors: readonly INPCGuild[]): IWorldState;
}

export enum GuildStrategy {
  AGGRESSIVE_EXPANSION = 'AGGRESSIVE_EXPANSION',
  DIPLOMATIC = 'DIPLOMATIC',
  ECONOMIC_FOCUSED = 'ECONOMIC_FOCUSED',
  MILITARY_DOMINANCE = 'MILITARY_DOMINANCE',
  TECHNOLOGICAL_ADVANCEMENT = 'TECHNOLOGICAL_ADVANCEMENT',
  BALANCED_GROWTH = 'BALANCED_GROWTH',
}

export enum AIPersonalityTrait {
  AGGRESSIVE = 'AGGRESSIVE',
  CAUTIOUS = 'CAUTIOUS',
  COLLABORATIVE = 'COLLABORATIVE',
  COMPETITIVE = 'COMPETITIVE',
  INNOVATIVE = 'INNOVATIVE',
  TRADITIONAL = 'TRADITIONAL',
  DIPLOMATIC = 'DIPLOMATIC',
  MILITARISTIC = 'MILITARISTIC',
}

export interface INPCGuildArchetype {
  readonly id: string;
  readonly name: string;
  readonly tier: number;
  readonly reputation: number;
  readonly strategy: GuildStrategy;
  readonly initialMembers: readonly IMemberTemplate[];
  readonly initialOfficers: readonly IOfficerTemplate[];
  readonly specialties: readonly string[];
  readonly personality: readonly AIPersonalityTrait[];
  readonly feud?: string;
  readonly homebase: string;
  readonly legendaryMembers: readonly ILegendaryMemberInfo[];
  readonly legendaryMemberCount: number;
  readonly historyMilestones: readonly IGuildHistoryRecord[];
  readonly leagueSchedule: IGuildLeagueSchedule;
  readonly diplomaticAttitude: IDiplomaticAttitude;
}

export interface INPCGuild extends INPCGuildArchetype {
  readonly currentMembers: readonly IGuildMember[];
  readonly currentOfficers: readonly IOfficer[];
  readonly currentResources: IGuildResources;
  readonly currentRanking: number;
  readonly relationshipWithPlayer: number;
}

export interface IDiplomaticAttitude {
  readonly attitudeValue: number;
  readonly attitudeCategory: AttitudeCategory;
  readonly stabilityFactor: number;
  readonly attitudeFactors: IDiplomaticAttitudeFactors;
  readonly adjustmentTriggers: readonly IAttitudeTrigger[];
  readonly decayRate: number;
  readonly lastUpdateTime: Date;
}

// ============== 招募系统接口 ==============

export interface IRecruitmentSystem {
  readonly searchFilters: IRecruitmentFilters;
  readonly negotiationSystem: INegotiationFlow;
  readonly talentRankings: ITalentLeaderboard;
  readonly legendaryMemberSearch: ILegendarySearchSystem;
  readonly legendaryRecruitmentEvents: ILegendaryRecruitmentEventPool;
  readonly intimacyBasedRecruitment: boolean;
}

export interface IMemberCandidate extends IBaseCharacter {
  readonly race: string;
  readonly characterClass: string;
  readonly specialization: string;
  readonly skill: number;
  readonly loyalty: number;
  readonly teamwork: number;
  readonly ambition: number;
  readonly personality: readonly PersonalityTrait[];
  readonly recruitmentSource: RecruitmentSource;
  readonly recruitmentCost: IResourceCost;
  readonly negotiationDifficulty: number;
  readonly isLegendary: boolean;
  readonly legendaryType?: LegendaryType;
}

export interface IRecruitmentFilters {
  readonly classFilter: readonly string[];
  readonly levelRange: readonly [number, number];
  readonly skillRange: readonly [number, number];
  readonly rarityFilter: readonly MemberRarity[];
  readonly legendaryOnly: boolean;
  readonly legendaryTypeFilter: readonly LegendaryType[];
  readonly availableLegendariesOnly: boolean;
  readonly personalityTraits: readonly PersonalityTrait[];
  readonly experienceRequirement: number;
  readonly intimacyLevelFilter: number;
}

// ============== 服务接口 ==============

export interface ICompositionValidationService {
  validateComposition(
    composition: IRaidComposition,
    raidConfig: IRaidConfiguration
  ): Promise<IValidationResult>;
  validateRoleDistribution(
    composition: IRaidComposition,
    requirements: IRoleRequirements
  ): IValidationResult;
  validateMemberAvailability(
    composition: IRaidComposition
  ): Promise<IValidationResult>;
}

export interface ICombatCalculationService {
  calculateRaidResult(
    composition: IRaidComposition,
    raidConfig: IRaidConfiguration,
    tactics: readonly ITactic[]
  ): Promise<IRaidResult>;
  calculateTeamPower(composition: IRaidComposition): number;
  calculateSuccessProbability(
    basePower: number,
    difficulty: number,
    modifiers: number
  ): number;
}

export interface IGuildEventService {
  publishEvent<T>(event: T): Promise<void>;
  subscribeToEvents<T>(
    eventType: string,
    handler: (event: T) => Promise<void>
  ): void;
  unsubscribeFromEvents(eventType: string, handler: Function): void;
}

// ============== 通用接口 ==============

export interface IOperationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly errorCode?: string;
}

export interface IValidationResult {
  readonly valid: boolean;
  readonly errors: readonly IValidationError[];

  hasErrors(): boolean;
  getErrors(): readonly IValidationError[];
  getErrorMessages(): readonly string[];
}

export interface IValidationError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly severity: 'ERROR' | 'WARNING' | 'INFO';
}

export interface IPaginatedResult<T> {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly pageSize: number;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

// ============== 枚举类型 ==============

export enum GuildRole {
  LEADER = 'LEADER',
  OFFICER = 'OFFICER',
  VETERAN = 'VETERAN',
  MEMBER = 'MEMBER',
  TRIAL = 'TRIAL',
}

export enum MemberRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  LEGENDARY = 'LEGENDARY',
}

export enum LegendaryType {
  COMBAT_MASTER = 'COMBAT_MASTER',
  STRATEGIC_GENIUS = 'STRATEGIC_GENIUS',
  SOCIAL_BUTTERFLY = 'SOCIAL_BUTTERFLY',
  TECHNICAL_EXPERT = 'TECHNICAL_EXPERT',
  LEADERSHIP_ICON = 'LEADERSHIP_ICON',
  LEGENDARY_CRAFTER = 'LEGENDARY_CRAFTER',
  MASTER_STRATEGIST = 'MASTER_STRATEGIST',
}

export enum RaidType {
  SMALL_DUNGEON = 'SMALL_DUNGEON',
  MEDIUM_DUNGEON = 'MEDIUM_DUNGEON',
  LARGE_DUNGEON = 'LARGE_DUNGEON',
  RAID_INSTANCE = 'RAID_INSTANCE',
  MEGA_RAID = 'MEGA_RAID',
}

export enum DifficultyLevel {
  NORMAL = 'NORMAL',
  HEROIC = 'HEROIC',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

export enum RaidRole {
  MAIN_TANK = 'MAIN_TANK',
  OFF_TANK = 'OFF_TANK',
  MELEE_DPS = 'MELEE_DPS',
  RANGED_DPS = 'RANGED_DPS',
  MAIN_HEALER = 'MAIN_HEALER',
  BACKUP_HEALER = 'BACKUP_HEALER',
  UTILITY = 'UTILITY',
}

export enum ReadinessLevel {
  NOT_READY = 'NOT_READY',
  PARTIALLY_READY = 'PARTIALLY_READY',
  READY = 'READY',
  OPTIMIZED = 'OPTIMIZED',
}

export enum RecruitmentSource {
  SEARCH = 'SEARCH',
  RECOMMENDATION = 'RECOMMENDATION',
  EVENT = 'EVENT',
  HEADHUNT = 'HEADHUNT',
  TRANSFER = 'TRANSFER',
  CONTACT_REFERRAL = 'CONTACT_REFERRAL',
}

export enum PersonalityTrait {
  COMPETITIVE = 'COMPETITIVE',
  COOPERATIVE = 'COOPERATIVE',
  PERFECTIONIST = 'PERFECTIONIST',
  CASUAL = 'CASUAL',
  SOCIAL = 'SOCIAL',
  INTROVERTED = 'INTROVERTED',
  AMBITIOUS = 'AMBITIOUS',
  LOYAL = 'LOYAL',
}

export enum RelationshipType {
  POTENTIAL_RECRUIT = 'POTENTIAL_RECRUIT',
  GUILD_MEMBER = 'GUILD_MEMBER',
  RIVAL_GUILD_MEMBER = 'RIVAL_GUILD_MEMBER',
  NEUTRAL_PLAYER = 'NEUTRAL_PLAYER',
  MENTOR = 'MENTOR',
  PROTEGE = 'PROTEGE',
  BUSINESS_CONTACT = 'BUSINESS_CONTACT',
}

export enum AttitudeCategory {
  HOSTILE = 'HOSTILE',
  UNFRIENDLY = 'UNFRIENDLY',
  NEUTRAL = 'NEUTRAL',
  FRIENDLY = 'FRIENDLY',
  ALLIED = 'ALLIED',
}

export enum ActivityType {
  RAID = 'RAID',
  PVP = 'PVP',
  SOCIAL = 'SOCIAL',
  RESEARCH = 'RESEARCH',
  DIPLOMACY = 'DIPLOMACY',
}

export enum FacilityType {
  BARRACKS = 'BARRACKS',
  WORKSHOP = 'WORKSHOP',
  LIBRARY = 'LIBRARY',
  TREASURY = 'TREASURY',
  EMBASSY = 'EMBASSY',
  TRAINING_GROUND = 'TRAINING_GROUND',
}

export enum TacticCategory {
  RESOURCE_CONSUMPTION = 'RESOURCE_CONSUMPTION',
  SKILL_NEGATION = 'SKILL_NEGATION',
  FORMATION_ENHANCEMENT = 'FORMATION_ENHANCEMENT',
  EMERGENCY_RESPONSE = 'EMERGENCY_RESPONSE',
  BUFF_AMPLIFICATION = 'BUFF_AMPLIFICATION',
  DEBUFF_RESISTANCE = 'DEBUFF_RESISTANCE',
}

export enum EffectType {
  DAMAGE_BOOST = 'DAMAGE_BOOST',
  DEFENSE_BOOST = 'DEFENSE_BOOST',
  HEALING_BOOST = 'HEALING_BOOST',
  RESISTANCE_GRANT = 'RESISTANCE_GRANT',
  SKILL_IMMUNITY = 'SKILL_IMMUNITY',
  RESOURCE_EFFICIENCY = 'RESOURCE_EFFICIENCY',
  COORDINATION_ENHANCEMENT = 'COORDINATION_ENHANCEMENT',
}

// ============== 扩展接口定义 ==============

export interface IActivityStats {
  readonly totalActivities: number;
  readonly successRate: number;
  readonly mvpCount: number;
  readonly lastActivityDate: Date;
}

export interface IMemberExperience {
  readonly totalLevel: number;
  readonly raidExperience: number;
  readonly pvpExperience: number;
  readonly socialExperience: number;
  readonly leadershipExperience: number;

  add(type: ActivityType, amount: number): void;
  getTotalLevel(): number;
}

export interface ILegendaryAbility {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: LegendaryAbilityType;
  readonly effects: readonly IAbilityEffect[];
  readonly cooldown?: number;
  readonly cost?: IResourceCost;
  readonly triggerConditions?: readonly ITriggerCondition[];
  readonly passiveBonus?: IPassiveBonus;
}

export enum LegendaryAbilityType {
  PASSIVE = 'PASSIVE',
  ACTIVE = 'ACTIVE',
  AURA = 'AURA',
  CONDITIONAL = 'CONDITIONAL',
}

export interface IBehaviorPattern {
  readonly id: string;
  readonly name: string;
  readonly tendencies: readonly ITendency[];
  readonly socialPreferences: readonly SocialPreference[];
  readonly conflictResolutionStyle: ConflictResolutionStyle;
}

export interface IPersonalGoal {
  readonly id: string;
  readonly description: string;
  readonly priority: number;
  readonly targetDate?: Date;
  readonly progress: number;
  readonly type: GoalType;
}

export enum GoalType {
  SKILL_IMPROVEMENT = 'SKILL_IMPROVEMENT',
  SOCIAL_RECOGNITION = 'SOCIAL_RECOGNITION',
  LEADERSHIP_ADVANCEMENT = 'LEADERSHIP_ADVANCEMENT',
  WEALTH_ACCUMULATION = 'WEALTH_ACCUMULATION',
  LEGENDARY_STATUS = 'LEGENDARY_STATUS',
}

// ============== 缺失的核心接口定义 ==============

export interface IAbilityEffect {
  readonly id: string;
  readonly type: EffectType;
  readonly magnitude: number;
  readonly duration: number;
  readonly target: EffectTarget;
  readonly conditions?: readonly IEffectCondition[];
}

export interface ITriggerCondition {
  readonly id: string;
  readonly type: 'health' | 'time' | 'event' | 'combat_state';
  readonly operator: 'eq' | 'lt' | 'gt' | 'lte' | 'gte';
  readonly value: number | string;
  readonly description: string;
}

export interface IPassiveBonus {
  readonly id: string;
  readonly type: 'stat' | 'skill' | 'resistance';
  readonly target: string;
  readonly modifier: number;
  readonly description: string;
}

export interface ITendency {
  readonly type: 'social' | 'combat' | 'leadership' | 'learning';
  readonly strength: number; // 0-100
  readonly manifestation: string;
}

export enum SocialPreference {
  GROUP_ACTIVITIES = 'GROUP_ACTIVITIES',
  ONE_ON_ONE = 'ONE_ON_ONE',
  LEADERSHIP_ROLE = 'LEADERSHIP_ROLE',
  SUPPORT_ROLE = 'SUPPORT_ROLE',
  COMPETITIVE = 'COMPETITIVE',
  COLLABORATIVE = 'COLLABORATIVE',
}

export enum ConflictResolutionStyle {
  DIRECT_CONFRONTATION = 'DIRECT_CONFRONTATION',
  DIPLOMATIC_NEGOTIATION = 'DIPLOMATIC_NEGOTIATION',
  AVOIDANCE = 'AVOIDANCE',
  SEEKING_MEDIATION = 'SEEKING_MEDIATION',
  COMPROMISE = 'COMPROMISE',
}

export interface IEffectCondition {
  readonly type: 'target_health' | 'caster_mana' | 'party_size' | 'time_of_day';
  readonly operator: 'eq' | 'lt' | 'gt' | 'lte' | 'gte';
  readonly value: number | string;
}

export enum EffectTarget {
  SELF = 'SELF',
  SINGLE_ALLY = 'SINGLE_ALLY',
  ALL_ALLIES = 'ALL_ALLIES',
  SINGLE_ENEMY = 'SINGLE_ENEMY',
  ALL_ENEMIES = 'ALL_ENEMIES',
  PARTY = 'PARTY',
  RAID = 'RAID',
}

export interface ILeadershipSkill {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly maxLevel: number;
  readonly effects: readonly IAbilityEffect[];
  readonly description: string;
  readonly unlockRequirement?: string;
}

export interface IContactEntry {
  readonly intimacyData: IIntimacyData;
  readonly availableActions: readonly IContactAction[];
  readonly lastActionDate?: Date;
  readonly actionCooldowns: ReadonlyMap<string, Date>;
}

export interface IIntimacyChange {
  readonly onSuccess: number;
  readonly onFailure: number;
  readonly onCriticalSuccess?: number;
}

export interface IInteractionRecord {
  readonly actionId: string;
  readonly date: Date;
  readonly result:
    | 'SUCCESS'
    | 'FAILURE'
    | 'CRITICAL_SUCCESS'
    | 'CRITICAL_FAILURE';
  readonly intimacyChange: number;
  readonly description?: string;
}

export interface ICharacterInfo {
  readonly name: string;
  readonly guildId?: string;
  readonly characterClass: string;
  readonly specialization: string;
  readonly reputation: number;
  readonly avatar?: string;
}

export interface IMemberTemplate {
  readonly name: string;
  readonly characterClass: string;
  readonly specialization: string;
  readonly level: number;
  readonly rarity: MemberRarity;
  readonly personalityTraits: readonly PersonalityTrait[];
  readonly baseStats: IBaseStats;
}

export interface IOfficerTemplate extends IMemberTemplate {
  readonly officerRole:
    | 'QUARTERMASTER'
    | 'RAID_LEADER'
    | 'DIPLOMAT'
    | 'TRAINER';
  readonly leadershipSkills: readonly string[];
  readonly specialAbilities: readonly string[];
}

export interface IOfficer extends IGuildMember {
  readonly officerRole:
    | 'QUARTERMASTER'
    | 'RAID_LEADER'
    | 'DIPLOMAT'
    | 'TRAINER';
  readonly officerLevel: number;
  readonly subordinates: readonly string[];
  readonly responsibilities: readonly string[];
  readonly decisionMakingAuthority: readonly string[];
}

export interface ILegendaryMemberInfo {
  readonly memberId: string;
  readonly name: string;
  readonly legendaryType: LegendaryType;
  readonly legendaryRank: number;
  readonly specialAbilities: readonly string[];
  readonly historicalAchievements: readonly string[];
  readonly influenceLevel: number;
}

export interface IGuildHistoryRecord {
  readonly id: string;
  readonly eventType: 'FIRST_KILL' | 'RANKING' | 'DIPLOMATIC' | 'ECONOMIC';
  readonly title: string;
  readonly description: string;
  readonly date: Date;
  readonly significance: 'MINOR' | 'MAJOR' | 'LEGENDARY';
  readonly impactOnReputation: number;
}

export interface IGuildLeagueSchedule {
  readonly seasonId: string;
  readonly matches: readonly ILeagueMatch[];
  readonly currentRanking: number;
  readonly seasonRecord: {
    readonly wins: number;
    readonly losses: number;
    readonly draws: number;
  };
}

export interface ILeagueMatch {
  readonly matchId: string;
  readonly opponent: string;
  readonly scheduledDate: Date;
  readonly matchType: 'RAID_CHALLENGE' | 'PVP_BATTLE' | 'ECONOMIC_COMPETITION';
  readonly status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  readonly result?: 'WIN' | 'LOSS' | 'DRAW';
}

export interface IAttitudeTrigger {
  readonly triggerId: string;
  readonly eventType: string;
  readonly attitudeChange: number;
  readonly conditions: readonly string[];
  readonly description: string;
}

export interface INegotiationFlow {
  readonly negotiationId: string;
  readonly phases: readonly INegotiationPhase[];
  readonly currentPhase: number;
  readonly participantIds: readonly string[];
  readonly stakes: INegotiationStakes;
  readonly outcome?: INegotiationOutcome;
}

export interface INegotiationPhase {
  readonly phaseId: string;
  readonly name: string;
  readonly description: string;
  readonly availableActions: readonly string[];
  readonly successConditions: readonly string[];
  readonly failureConsequences: readonly string[];
}

export interface INegotiationStakes {
  readonly offeredResources: IResourceCost;
  readonly demandedResources: IResourceCost;
  readonly additionalTerms: readonly string[];
  readonly dealBreakers: readonly string[];
}

export interface INegotiationOutcome {
  readonly success: boolean;
  readonly finalTerms: readonly string[];
  readonly resourceExchange: IResourceCost;
  readonly relationshipImpact: number;
  readonly completedAt: Date;
}

export interface ITalentLeaderboard {
  readonly rankings: readonly ITalentRanking[];
  readonly categories: readonly string[];
  readonly lastUpdated: Date;
  readonly seasonId: string;
}

export interface ITalentRanking {
  readonly memberId: string;
  readonly memberName: string;
  readonly category: string;
  readonly score: number;
  readonly rank: number;
  readonly guild?: string;
  readonly achievements: readonly string[];
}

export interface ILegendarySearchSystem {
  readonly availableLegendaries: readonly ILegendaryCandidate[];
  readonly searchCriteria: ILegendarySearchCriteria;
  readonly discoveryEvents: readonly ILegendaryDiscoveryEvent[];
}

export interface ILegendaryCandidate extends IMemberCandidate {
  readonly legendaryType: LegendaryType;
  readonly legendaryRank: number;
  readonly uniqueAbilities: readonly string[];
  readonly discoveryConditions: readonly string[];
  readonly recruitmentComplexity:
    | 'SIMPLE'
    | 'MODERATE'
    | 'COMPLEX'
    | 'LEGENDARY';
}

export interface ILegendarySearchCriteria {
  readonly legendaryTypes: readonly LegendaryType[];
  readonly minRank: number;
  readonly requiredAbilities: readonly string[];
  readonly excludedMembers: readonly string[];
  readonly budgetLimit: IResourceCost;
}

export interface ILegendaryDiscoveryEvent {
  readonly eventId: string;
  readonly eventType: 'RUMOR' | 'SIGHTING' | 'DIRECT_CONTACT' | 'THIRD_PARTY';
  readonly legendaryMemberId: string;
  readonly reliabilityScore: number; // 0-1
  readonly discoveredAt: Date;
  readonly discoverySource: string;
  readonly followUpRequired: boolean;
}

export interface ILegendaryRecruitmentEventPool {
  readonly activeEvents: readonly ILegendaryRecruitmentEvent[];
  readonly eventProbabilities: ReadonlyMap<LegendaryType, number>;
  readonly seasonalModifiers: readonly ISeasonalModifier[];
}

export interface ILegendaryRecruitmentEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly description: string;
  readonly targetLegendary: ILegendaryCandidate;
  readonly requirements: readonly string[];
  readonly successRate: number;
  readonly duration: number; // hours
  readonly rewards: readonly string[];
  readonly penalties: readonly string[];
}

export interface ISeasonalModifier {
  readonly season: 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
  readonly modifierType: 'DISCOVERY_RATE' | 'SUCCESS_RATE' | 'COST_REDUCTION';
  readonly magnitude: number;
  readonly affectedLegendaryTypes: readonly LegendaryType[];
}

export interface IRaidCompositionManager {
  readonly activeCompositions: ReadonlyMap<string, IRaidComposition>;
  readonly templates: readonly IRaidCompositionTemplate[];
  readonly autoAssignmentRules: readonly IAutoAssignmentRule[];
}

export interface IRaidCompositionTemplate {
  readonly templateId: string;
  readonly name: string;
  readonly raidType: RaidType;
  readonly recommendedRoles: ReadonlyMap<RaidRole, number>;
  readonly description: string;
  readonly difficulty: DifficultyLevel;
  readonly successRate: number;
}

export interface IAutoAssignmentRule {
  readonly ruleId: string;
  readonly name: string;
  readonly conditions: readonly string[];
  readonly priority: number;
  readonly assignmentLogic: string;
  readonly isActive: boolean;
}

export interface IPVPCompositionManager {
  readonly pvpCompositions: ReadonlyMap<string, IPVPComposition>;
  readonly pvpStrategies: readonly IPVPStrategy[];
  readonly competitiveRankings: ReadonlyMap<string, number>;
}

export interface IPVPComposition {
  readonly compositionId: string;
  readonly name: string;
  readonly pvpMode: 'ARENA' | 'BATTLEGROUND' | 'GUILD_WAR' | 'TOURNAMENT';
  readonly teamSize: number;
  readonly members: readonly IPVPMemberSlot[];
  readonly strategy: IPVPStrategy;
  readonly winRate: number;
}

export interface IPVPMemberSlot {
  readonly slotId: string;
  readonly memberId?: string;
  readonly pvpRole:
    | 'DAMAGE_DEALER'
    | 'SUPPORT'
    | 'TANK'
    | 'HEALER'
    | 'SPECIALIST';
  readonly isFlexible: boolean;
  readonly performanceRating: number;
}

export interface IPVPStrategy {
  readonly strategyId: string;
  readonly name: string;
  readonly description: string;
  readonly tacticalApproach:
    | 'AGGRESSIVE'
    | 'DEFENSIVE'
    | 'BALANCED'
    | 'CONTROL';
  readonly keyTactics: readonly string[];
  readonly counters: readonly string[];
  readonly effectiveness: ReadonlyMap<string, number>;
}

export interface ITacticResearchQueue {
  readonly queuedResearch: readonly ITacticResearchItem[];
  readonly researchCapacity: number;
  readonly researchSpeed: number;
  readonly completedResearch: readonly string[];
}

export interface ITacticResearchItem {
  readonly tacticId: string;
  readonly researchProgress: number; // 0-100
  readonly estimatedCompletion: Date;
  readonly requiredResources: IResourceCost;
  readonly prerequisites: readonly string[];
}

export interface ITacticRestrictions {
  readonly requiredLevel: number;
  readonly requiredFacilities: readonly string[];
  readonly requiredMembers: readonly string[];
  readonly cooldownPeriod: number;
  readonly resourceCost: IResourceCost;
}

export interface ITacticSelectionFactors {
  readonly situationalModifiers: ReadonlyMap<string, number>;
  readonly memberCompatibility: ReadonlyMap<string, number>;
  readonly difficultyEffectiveness: ReadonlyMap<DifficultyLevel, number>;
  readonly raidTypeOptimization: ReadonlyMap<RaidType, number>;
}

export interface IAIAutoAssignmentSystem {
  readonly assignmentAlgorithm: string;
  readonly learningModel: string;
  readonly accuracyScore: number;
  readonly recentPerformance: readonly IAssignmentPerformance[];
}

export interface IAssignmentPerformance {
  readonly assignmentId: string;
  readonly accuracy: number;
  readonly memberSatisfaction: number;
  readonly raidSuccess: boolean;
  readonly executedAt: Date;
  readonly feedbackScore: number;
}

export interface IMemberAvailabilityTracker {
  readonly memberAvailability: ReadonlyMap<string, IAvailabilityData>;
  readonly scheduleConflicts: readonly IScheduleConflict[];
  readonly predictiveModel: IPredictiveAvailabilityModel;
}

export interface IAvailabilityData {
  readonly memberId: string;
  readonly currentStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'ON_COOLDOWN';
  readonly availableUntil?: Date;
  readonly weeklySchedule: ReadonlyMap<string, ITimeSlot[]>;
  readonly preferredPlayTimes: readonly ITimeSlot[];
}

export interface ITimeSlot {
  readonly startTime: string; // HH:MM format
  readonly endTime: string; // HH:MM format
  readonly dayOfWeek: number; // 0-6
  readonly timezone: string;
}

export interface IScheduleConflict {
  readonly conflictId: string;
  readonly affectedMembers: readonly string[];
  readonly conflictType:
    | 'TIME_OVERLAP'
    | 'RESOURCE_COMPETITION'
    | 'ROLE_SHORTAGE';
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly suggestedResolution: string;
}

export interface IPredictiveAvailabilityModel {
  readonly modelType: string;
  readonly accuracy: number;
  readonly lastTrainingDate: Date;
  readonly predictions: ReadonlyMap<string, IAvailabilityPrediction>;
}

export interface IAvailabilityPrediction {
  readonly memberId: string;
  readonly predictedAvailability: number; // 0-1
  readonly confidence: number; // 0-1
  readonly timeframe: string;
  readonly factors: readonly string[];
}

export interface IIntimacyTrigger {
  readonly triggerId: string;
  readonly eventType: string;
  readonly intimacyChange: number;
  readonly conditions: readonly string[];
  readonly priority: number;
}

export interface IDiplomaticAttitudeFactors {
  readonly historicalRelations: number;
  readonly recentInteractions: number;
  readonly competitiveRivalry: number;
  readonly diplomaticEfforts: number;
  readonly thirdPartyInfluence: number;
  readonly personalityAlignment: number;
}

export interface IBaseStats {
  readonly strength: number;
  readonly agility: number;
  readonly intellect: number;
  readonly stamina: number;
  readonly luck: number;
  readonly charisma: number;
}

export interface IBossAbility {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly damage: number;
  readonly castTime: number;
  readonly cooldown: number;
  readonly targetType: 'SINGLE' | 'MULTIPLE' | 'ALL' | 'RANDOM';
  readonly effects: readonly IAbilityEffect[];
}

export interface IEncounterPhase {
  readonly phaseId: string;
  readonly name: string;
  readonly healthThreshold: number;
  readonly duration?: number;
  readonly specialMechanics: readonly string[];
  readonly abilities: readonly IBossAbility[];
}

export interface ILootEntry {
  readonly itemId: string;
  readonly itemName: string;
  readonly rarity: ItemRarity;
  readonly dropChance: number;
  readonly itemLevel: number;
  readonly stats: ReadonlyMap<string, number>;
}

export enum ItemRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

export interface ICasualty {
  readonly memberId: string;
  readonly memberName: string;
  readonly injuryType: 'MINOR' | 'SERIOUS' | 'CRITICAL';
  readonly recoveryTime: number;
  readonly treatmentCost: IResourceCost;
}

export interface ICombatLogEntry {
  readonly timestamp: Date;
  readonly eventType:
    | 'DAMAGE'
    | 'HEALING'
    | 'BUFF'
    | 'DEBUFF'
    | 'DEATH'
    | 'RESURRECTION';
  readonly source: string;
  readonly target: string;
  readonly amount: number;
  readonly description: string;
}

export interface IWorldState {
  readonly worldId: string;
  readonly competingGuilds: readonly string[];
  readonly globalEvents: readonly IGlobalEvent[];
  readonly economicState: IEconomicState;
  readonly politicalSituation: IPoliticalSituation;
}

export interface IGlobalEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly name: string;
  readonly description: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly globalEffects: readonly IGlobalEffect[];
  readonly participationRewards: readonly IEventReward[];
}

export interface IGlobalEffect {
  readonly effectType: string;
  readonly magnitude: number;
  readonly affectedSystems: readonly string[];
  readonly duration: number;
}

export interface IEventReward {
  readonly rewardType: 'RESOURCES' | 'ITEMS' | 'EXPERIENCE' | 'REPUTATION';
  readonly amount: number;
  readonly conditions: readonly string[];
  readonly description: string;
}

export interface IEconomicState {
  readonly marketTrends: ReadonlyMap<string, number>;
  readonly resourcePrices: ReadonlyMap<string, number>;
  readonly tradingVolume: number;
  readonly economicStability: number;
}

export interface IPoliticalSituation {
  readonly dominantGuild?: string;
  readonly alliances: readonly IAlliance[];
  readonly conflicts: readonly IConflict[];
  readonly diplomaticTensions: ReadonlyMap<string, number>;
}

export interface IAlliance {
  readonly allianceId: string;
  readonly memberGuilds: readonly string[];
  readonly allianceType: 'TRADE' | 'MILITARY' | 'RESEARCH' | 'DEFENSIVE';
  readonly benefits: readonly string[];
  readonly obligations: readonly string[];
  readonly createdAt: Date;
}

export interface IConflict {
  readonly conflictId: string;
  readonly involvedGuilds: readonly string[];
  readonly conflictType:
    | 'TERRITORIAL'
    | 'RESOURCE'
    | 'IDEOLOGICAL'
    | 'PERSONAL';
  readonly intensity: number; // 0-100
  readonly startDate: Date;
  readonly resolution?: IConflictResolution;
}

export interface IConflictResolution {
  readonly resolutionType: 'VICTORY' | 'DEFEAT' | 'NEGOTIATED' | 'STALEMATE';
  readonly victor?: string;
  readonly terms: readonly string[];
  readonly resolvedAt: Date;
}

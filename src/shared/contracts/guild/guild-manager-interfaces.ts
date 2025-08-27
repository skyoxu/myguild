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

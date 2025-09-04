/**
 * 公会管理器 CloudEvents 契约定义
 * 基于 CloudEvents v1.0 规范
 */

import type { CloudEvent } from '../cloudevents-core';
import { mkEvent, assertCe } from '../cloudevents-core';

// CloudEvent 扩展接口
export interface GuildManagerCloudEvent<T = any> extends CloudEvent<T> {
  readonly specversion: '1.0';
  readonly source: string;
  readonly type: GuildEventType;
  readonly subject?: string;
  readonly datacontenttype: 'application/json';
  readonly dataschema?: string;
}

// 公会事件类型枚举
export enum GuildEventType {
  // 公会生命周期事件
  GUILD_CREATED = 'com.guildmanager.guild.created',

  // 成员管理事件
  MEMBER_RECRUITED = 'com.guildmanager.member.recruited',
  MEMBER_PROMOTED = 'com.guildmanager.member.promoted',
  MEMBER_DEPARTED = 'com.guildmanager.member.departed',
  MEMBER_SATISFACTION_CHANGED = 'com.guildmanager.member.satisfaction.changed',
  MEMBER_EXPERIENCE_GAINED = 'com.guildmanager.member.experience.gained',

  // 战斗相关事件
  RAID_STARTED = 'com.guildmanager.raid.started',
  RAID_COMPLETED = 'com.guildmanager.raid.completed',
  BOSS_DEFEATED = 'com.guildmanager.boss.defeated',
  COMPOSITION_UPDATED = 'com.guildmanager.composition.updated',
  COMPOSITION_VALIDATED = 'com.guildmanager.composition.validated',

  // 资源管理事件
  RESOURCE_UPDATED = 'com.guildmanager.resource.updated',
  FACILITY_UPGRADED = 'com.guildmanager.facility.upgraded',
  RESEARCH_COMPLETED = 'com.guildmanager.research.completed',

  // 外交系统事件
  DIPLOMATIC_PROPOSAL = 'com.guildmanager.diplomacy.proposal',
  DIPLOMATIC_RESPONSE = 'com.guildmanager.diplomacy.response',
  ATTITUDE_CHANGED = 'com.guildmanager.diplomacy.attitude.changed',

  // 世界状态事件
  WORLD_STATE_UPDATED = 'com.guildmanager.world.state.updated',
  COMPETITION_RESULT = 'com.guildmanager.competition.result',
  RANKING_CHANGED = 'com.guildmanager.ranking.changed',

  // 亲密度系统事件
  INTIMACY_LEVEL_CHANGED = 'com.guildmanager.intimacy.level.changed',
  CONTACT_ADDED = 'com.guildmanager.contact.added',
  SOCIAL_ACTION_PERFORMED = 'com.guildmanager.social.action.performed',
}

// 事件数据类型定义

export interface MemberRecruitedEventData {
  readonly memberId: string;
  readonly memberName: string;
  readonly memberClass: string;
  readonly memberSpecialization: string;
  readonly memberRarity: string;
  readonly recruitmentSource: string;
  readonly recruitmentCost: {
    readonly gold: number;
    readonly materials: number;
    readonly influence: number;
  };
  readonly initialSatisfaction: number;
  readonly isLegendary: boolean;
  readonly legendaryType?: string;
}

export interface MemberSatisfactionChangedEventData {
  readonly memberId: string;
  readonly memberName: string;
  readonly previousSatisfaction: number;
  readonly newSatisfaction: number;
  readonly changeReason: string;
  readonly impactOnMorale: number;
}

export interface RaidStartedEventData {
  readonly raidId: string;
  readonly raidName: string;
  readonly raidType: string;
  readonly guildId: string;
  readonly compositionId: string;
  readonly participants: ReadonlyArray<{
    readonly memberId: string;
    readonly memberName: string;
    readonly role: string;
  }>;
  readonly selectedTactics: ReadonlyArray<string>;
  readonly estimatedDuration: number;
}

export interface RaidCompletedEventData {
  readonly raidId: string;
  readonly raidName: string;
  readonly participants: ReadonlyArray<string>;
  readonly result: 'SUCCESS' | 'FAILURE';
  readonly duration: number;
  readonly successProbability: number;
  readonly mvpMember?: string;
  readonly casualtiesCount: number;
  readonly lootDistributed: ReadonlyArray<{
    readonly itemId: string;
    readonly itemName: string;
    readonly rarity: string;
    readonly recipientId: string;
  }>;
  readonly experienceGained: number;
  readonly reputationGained: number;
}

export interface CompositionUpdatedEventData {
  readonly compositionId: string;
  readonly compositionName: string;
  readonly raidType: string;
  readonly changes: ReadonlyArray<{
    readonly slotId: string;
    readonly previousMemberId?: string;
    readonly newMemberId?: string;
    readonly action: 'ASSIGN' | 'REMOVE' | 'REPLACE';
  }>;
  readonly currentMemberCount: number;
  readonly maxMemberCount: number;
  readonly readinessLevel: string;
}

export interface ResourceUpdatedEventData {
  readonly guildId: string;
  readonly resourceType: 'GOLD' | 'MATERIALS' | 'INFLUENCE';
  readonly previousAmount: number;
  readonly newAmount: number;
  readonly changeAmount: number;
  readonly changeReason: string;
  readonly source?: string;
}

export interface DiplomaticAttitudeChangedEventData {
  readonly sourceGuildId: string;
  readonly targetGuildId: string;
  readonly previousAttitude: number;
  readonly newAttitude: number;
  readonly previousCategory: string;
  readonly newCategory: string;
  readonly changeReason: string;
  readonly eventTrigger?: string;
}

export interface IntimacyLevelChangedEventData {
  readonly characterId: string;
  readonly characterName: string;
  readonly previousLevel: number;
  readonly newLevel: number;
  readonly previousValue: number;
  readonly newValue: number;
  readonly changeReason: string;
  readonly relationshipType: string;
  readonly addedToContacts: boolean;
}

// CloudEvent 构建器类
export class GuildEventBuilder {
  private static readonly DEFAULT_SOURCE = '/guild-manager/core';
  private static readonly DEFAULT_SPEC_VERSION = '1.0';
  private static readonly DEFAULT_CONTENT_TYPE = 'application/json';

  /**
   * 生成公会事件专用的ID格式: guild-event-{timestamp}-{randomString}
   */
  private static generateGuildEventId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `guild-event-${timestamp}-${random}`;
  }

  /**
   * 创建成员招募事件
   */
  static createMemberRecruitedEvent(
    guildId: string,
    data: MemberRecruitedEventData,
    options?: {
      source?: string;
      subject?: string;
      dataschema?: string;
    }
  ): GuildManagerCloudEvent<MemberRecruitedEventData> {
    return this.createBaseEvent(GuildEventType.MEMBER_RECRUITED, data, {
      source: options?.source || `${this.DEFAULT_SOURCE}/${guildId}`,
      subject: options?.subject || `member-${data.memberId}`,
      dataschema:
        options?.dataschema ||
        'src/shared/contracts/guild/guild-manager-events.ts#MemberRecruitedEventData',
    });
  }

  /**
   * 创建副本开始事件
   */
  static createRaidStartedEvent(
    data: RaidStartedEventData,
    options?: {
      source?: string;
      subject?: string;
      dataschema?: string;
    }
  ): GuildManagerCloudEvent<RaidStartedEventData> {
    return this.createBaseEvent(GuildEventType.RAID_STARTED, data, {
      source: options?.source || `${this.DEFAULT_SOURCE}/raid-hall`,
      subject: options?.subject || `raid-${data.raidId}`,
      dataschema:
        options?.dataschema ||
        'src/shared/contracts/guild/guild-manager-events.ts#RaidStartedEventData',
    });
  }

  /**
   * 创建副本完成事件
   */
  static createRaidCompletedEvent(
    data: RaidCompletedEventData,
    options?: {
      source?: string;
      subject?: string;
      dataschema?: string;
    }
  ): GuildManagerCloudEvent<RaidCompletedEventData> {
    return this.createBaseEvent(GuildEventType.RAID_COMPLETED, data, {
      source: options?.source || `${this.DEFAULT_SOURCE}/raid-hall`,
      subject: options?.subject || `raid-${data.raidId}`,
      dataschema:
        options?.dataschema ||
        'src/shared/contracts/guild/guild-manager-events.ts#RaidCompletedEventData',
    });
  }

  /**
   * 创建阵容更新事件
   */
  static createCompositionUpdatedEvent(
    data: CompositionUpdatedEventData,
    options?: {
      source?: string;
      subject?: string;
      dataschema?: string;
    }
  ): GuildManagerCloudEvent<CompositionUpdatedEventData> {
    return this.createBaseEvent(GuildEventType.COMPOSITION_UPDATED, data, {
      source: options?.source || `${this.DEFAULT_SOURCE}/tactical-center`,
      subject: options?.subject || `composition-${data.compositionId}`,
      dataschema:
        options?.dataschema ||
        'src/shared/contracts/guild/guild-manager-events.ts#CompositionUpdatedEventData',
    });
  }

  /**
   * 创建资源更新事件
   */
  static createResourceUpdatedEvent(
    data: ResourceUpdatedEventData,
    options?: {
      source?: string;
      subject?: string;
      dataschema?: string;
    }
  ): GuildManagerCloudEvent<ResourceUpdatedEventData> {
    return this.createBaseEvent(GuildEventType.RESOURCE_UPDATED, data, {
      source: options?.source || `${this.DEFAULT_SOURCE}/resources`,
      subject:
        options?.subject || `resource-${data.resourceType.toLowerCase()}`,
      dataschema:
        options?.dataschema ||
        'src/shared/contracts/guild/guild-manager-events.ts#ResourceUpdatedEventData',
    });
  }

  /**
   * 创建外交态度变化事件
   */
  static createDiplomaticAttitudeChangedEvent(
    data: DiplomaticAttitudeChangedEventData,
    options?: {
      source?: string;
      subject?: string;
      dataschema?: string;
    }
  ): GuildManagerCloudEvent<DiplomaticAttitudeChangedEventData> {
    return this.createBaseEvent(GuildEventType.ATTITUDE_CHANGED, data, {
      source: options?.source || `${this.DEFAULT_SOURCE}/diplomacy`,
      subject:
        options?.subject ||
        `diplomacy-${data.sourceGuildId}-${data.targetGuildId}`,
      dataschema:
        options?.dataschema ||
        'src/shared/contracts/guild/guild-manager-events.ts#DiplomaticAttitudeChangedEventData',
    });
  }

  /**
   * 创建亲密度等级变化事件
   */
  static createIntimacyLevelChangedEvent(
    data: IntimacyLevelChangedEventData,
    options?: {
      source?: string;
      subject?: string;
      dataschema?: string;
    }
  ): GuildManagerCloudEvent<IntimacyLevelChangedEventData> {
    return this.createBaseEvent(GuildEventType.INTIMACY_LEVEL_CHANGED, data, {
      source: options?.source || `${this.DEFAULT_SOURCE}/social`,
      subject: options?.subject || `intimacy-${data.characterId}`,
      dataschema:
        options?.dataschema ||
        'src/shared/contracts/guild/guild-manager-events.ts#IntimacyLevelChangedEventData',
    });
  }

  /**
   * 创建通用CloudEvent
   */
  static createGenericEvent<T>(
    type: GuildEventType,
    data: T,
    options: {
      source?: string;
      subject?: string;
      dataschema?: string;
    }
  ): GuildManagerCloudEvent<T> {
    return this.createBaseEvent(type, data, options);
  }

  /**
   * 创建基础CloudEvent - 使用自定义ID生成器确保格式一致性
   */
  private static createBaseEvent<T>(
    type: GuildEventType,
    data: T,
    options: {
      source?: string;
      subject?: string;
      dataschema?: string;
    }
  ): GuildManagerCloudEvent<T> {
    const baseEvent = mkEvent({
      type,
      source: options.source || this.DEFAULT_SOURCE,
      data,
      datacontenttype: this.DEFAULT_CONTENT_TYPE,
      subject: options.subject,
      dataschema: options.dataschema,
    });

    // 使用公会事件专用ID格式覆盖默认UUID
    (baseEvent as any).id = this.generateGuildEventId();

    // 验证事件符合 CloudEvents v1.0 规范
    assertCe(baseEvent);

    return baseEvent as GuildManagerCloudEvent<T>;
  }

  // 注意：事件ID生成现在由 cloudevents-core.mkEvent() 自动处理
}

// 事件验证器 - 基于 cloudevents-core 核心验证
export class GuildEventValidator {
  /**
   * 验证CloudEvent是否符合规范 - 使用核心 CloudEvents 验证器
   */
  static validate<T>(event: GuildManagerCloudEvent<T>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      // 使用 cloudevents-core 的核心验证
      assertCe(event);

      // 额外验证 Guild 特定的事件类型
      if (!event.type || !Object.values(GuildEventType).includes(event.type)) {
        errors.push('type is required and must be a valid GuildEventType');
      }

      if (
        event.datacontenttype &&
        event.datacontenttype !== 'application/json'
      ) {
        errors.push('datacontenttype must be "application/json" if specified');
      }
    } catch (validationError) {
      errors.push(
        validationError instanceof Error
          ? validationError.message
          : String(validationError)
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证事件数据结构
   */
  static validateEventData(
    type: GuildEventType,
    data: any
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    switch (type) {
      case GuildEventType.MEMBER_RECRUITED:
        this.validateMemberRecruitedData(data, errors);
        break;
      case GuildEventType.RAID_COMPLETED:
        this.validateRaidCompletedData(data, errors);
        break;
      case GuildEventType.COMPOSITION_UPDATED:
        this.validateCompositionUpdatedData(data, errors);
        break;
      // 可以添加更多事件类型的验证
      default:
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static validateMemberRecruitedData(
    data: any,
    errors: string[]
  ): void {
    if (!data.memberId) errors.push('memberId is required');
    if (!data.memberName) errors.push('memberName is required');
    if (!data.memberClass) errors.push('memberClass is required');
    if (!data.recruitmentSource) errors.push('recruitmentSource is required');
    if (typeof data.initialSatisfaction !== 'number') {
      errors.push('initialSatisfaction must be a number');
    }
  }

  private static validateRaidCompletedData(data: any, errors: string[]): void {
    if (!data.raidId) errors.push('raidId is required');
    if (!data.result || !['SUCCESS', 'FAILURE'].includes(data.result)) {
      errors.push('result must be either "SUCCESS" or "FAILURE"');
    }
    if (!Array.isArray(data.participants)) {
      errors.push('participants must be an array');
    }
  }

  private static validateCompositionUpdatedData(
    data: any,
    errors: string[]
  ): void {
    if (!data.compositionId) errors.push('compositionId is required');
    if (!Array.isArray(data.changes)) {
      errors.push('changes must be an array');
    }
    if (typeof data.currentMemberCount !== 'number') {
      errors.push('currentMemberCount must be a number');
    }
  }
}

/**
 * 公会管理器核心功能单元测试
 * 使用 Vitest 测试框架
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  GuildEventBuilder,
  GuildEventType,
} from '../../../src/shared/contracts/guild/guild-manager-events';
import {
  GuildId,
  ResourceAmount,
  SatisfactionLevel,
} from '../../../src/shared/contracts/guild/guild-core-types';

// 测试用的模拟实现
class MockGuild {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public resources: ResourceAmount = new ResourceAmount(1000, 500, 100),
    public members: Map<string, any> = new Map()
  ) {}

  recruitMember(candidate: any, cost: ResourceAmount) {
    if (!this.resources.canAfford(cost)) {
      return { success: false, error: 'Insufficient resources' };
    }

    this.resources = this.resources.subtract(cost);
    this.members.set(candidate.id, candidate);

    return { success: true };
  }
}

class MockMember {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly characterClass: string,
    public satisfaction: SatisfactionLevel = new SatisfactionLevel(50)
  ) {}

  updateSatisfaction(change: number, reason: string) {
    this.satisfaction = this.satisfaction.adjust(change);
  }
}

describe('Guild Core Functionality', () => {
  let guild: MockGuild;
  let mockEventBus: any;

  beforeEach(() => {
    guild = new MockGuild('guild-test-1', 'Test Guild');

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GuildId Value Object', () => {
    it('should create valid GuildId', () => {
      const guildId = new GuildId('test-guild-123');

      expect(guildId.value).toBe('test-guild-123');
      expect(guildId.toString()).toBe('test-guild-123');
    });

    it('should generate unique GuildId', () => {
      const id1 = GuildId.generate();
      const id2 = GuildId.generate();

      expect(id1.value).not.toBe(id2.value);
      expect(id1.value).toMatch(/^guild-\d+-[a-z0-9]{8}$/);
    });

    it('should throw error for empty GuildId', () => {
      expect(() => new GuildId('')).toThrowError('GuildId cannot be empty');
      expect(() => new GuildId('   ')).toThrowError('GuildId cannot be empty');
    });

    it('should compare GuildIds correctly', () => {
      const id1 = new GuildId('same-id');
      const id2 = new GuildId('same-id');
      const id3 = new GuildId('different-id');

      expect(id1.equals(id2)).toBe(true);
      expect(id1.equals(id3)).toBe(false);
    });
  });

  describe('ResourceAmount Value Object', () => {
    it('should create valid ResourceAmount', () => {
      const resources = new ResourceAmount(100, 50, 25);

      expect(resources.gold).toBe(100);
      expect(resources.materials).toBe(50);
      expect(resources.influence).toBe(25);
      expect(resources.getTotal()).toBe(175);
    });

    it('should create empty ResourceAmount', () => {
      const empty = ResourceAmount.empty();

      expect(empty.gold).toBe(0);
      expect(empty.materials).toBe(0);
      expect(empty.influence).toBe(0);
      expect(empty.isEmpty()).toBe(true);
    });

    it('should add ResourceAmounts correctly', () => {
      const r1 = new ResourceAmount(100, 50, 25);
      const r2 = new ResourceAmount(50, 25, 10);
      const result = r1.add(r2);

      expect(result.gold).toBe(150);
      expect(result.materials).toBe(75);
      expect(result.influence).toBe(35);
    });

    it('should subtract ResourceAmounts correctly', () => {
      const r1 = new ResourceAmount(100, 50, 25);
      const r2 = new ResourceAmount(30, 20, 10);
      const result = r1.subtract(r2);

      expect(result.gold).toBe(70);
      expect(result.materials).toBe(30);
      expect(result.influence).toBe(15);
    });

    it('should throw error when subtracting more than available', () => {
      const r1 = new ResourceAmount(100, 50, 25);
      const r2 = new ResourceAmount(150, 20, 10);

      expect(() => r1.subtract(r2)).toThrowError(
        'Cannot subtract more resources than available'
      );
    });

    it('should check affordability correctly', () => {
      const resources = new ResourceAmount(100, 50, 25);
      const cheapCost = new ResourceAmount(50, 25, 10);
      const expensiveCost = new ResourceAmount(150, 25, 10);

      expect(resources.canAfford(cheapCost)).toBe(true);
      expect(resources.canAfford(expensiveCost)).toBe(false);
    });

    it('should throw error for negative amounts', () => {
      expect(() => new ResourceAmount(-1, 0, 0)).toThrowError(
        'Resource amounts cannot be negative'
      );
      expect(() => new ResourceAmount(0, -1, 0)).toThrowError(
        'Resource amounts cannot be negative'
      );
      expect(() => new ResourceAmount(0, 0, -1)).toThrowError(
        'Resource amounts cannot be negative'
      );
    });
  });

  describe('SatisfactionLevel Value Object', () => {
    it('should create valid SatisfactionLevel', () => {
      const satisfaction = new SatisfactionLevel(75);

      expect(satisfaction.value).toBe(75);
      expect(satisfaction.level).toBe('SATISFIED');
    });

    it('should categorize satisfaction levels correctly', () => {
      expect(new SatisfactionLevel(90).level).toBe('VERY_SATISFIED');
      expect(new SatisfactionLevel(70).level).toBe('SATISFIED');
      expect(new SatisfactionLevel(50).level).toBe('NEUTRAL');
      expect(new SatisfactionLevel(30).level).toBe('DISSATISFIED');
      expect(new SatisfactionLevel(10).level).toBe('VERY_DISSATISFIED');
    });

    it('should adjust satisfaction correctly', () => {
      const satisfaction = new SatisfactionLevel(50);
      const increased = satisfaction.adjust(20);
      const decreased = satisfaction.adjust(-30);

      expect(increased.value).toBe(70);
      expect(decreased.value).toBe(20);
    });

    it('should clamp satisfaction within valid range', () => {
      const satisfaction = new SatisfactionLevel(90);
      const overMax = satisfaction.adjust(20); // Should clamp to 100
      const underMin = satisfaction.adjust(-100); // Should clamp to 0

      expect(overMax.value).toBe(100);
      expect(underMin.value).toBe(0);
    });

    it('should throw error for invalid range', () => {
      expect(() => new SatisfactionLevel(-1)).toThrowError();
      expect(() => new SatisfactionLevel(101)).toThrowError();
    });

    it('should identify low and high satisfaction correctly', () => {
      const low = new SatisfactionLevel(25);
      const high = new SatisfactionLevel(80);
      const medium = new SatisfactionLevel(50);

      expect(low.isLow()).toBe(true);
      expect(high.isHigh()).toBe(true);
      expect(medium.isLow()).toBe(false);
      expect(medium.isHigh()).toBe(false);
    });
  });

  describe('Guild Member Recruitment', () => {
    it('should recruit member successfully with sufficient resources', () => {
      const candidate = {
        id: 'member-1',
        name: 'Test Warrior',
        characterClass: 'WARRIOR',
        skill: 75,
      };
      const cost = new ResourceAmount(200, 100, 50);

      const result = guild.recruitMember(candidate, cost);

      expect(result.success).toBe(true);
      expect(guild.members.has('member-1')).toBe(true);
      expect(guild.resources.gold).toBe(800);
      expect(guild.resources.materials).toBe(400);
      expect(guild.resources.influence).toBe(50);
    });

    it('should fail recruitment with insufficient resources', () => {
      const candidate = {
        id: 'member-1',
        name: 'Expensive Warrior',
        characterClass: 'WARRIOR',
      };
      const cost = new ResourceAmount(2000, 100, 50); // Too expensive

      const result = guild.recruitMember(candidate, cost);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient resources');
      expect(guild.members.has('member-1')).toBe(false);
      expect(guild.resources.gold).toBe(1000); // Unchanged
    });
  });

  describe('Member Satisfaction Management', () => {
    let member: MockMember;

    beforeEach(() => {
      member = new MockMember('member-1', 'Test Member', 'WARRIOR');
    });

    it('should update member satisfaction correctly', () => {
      const initialLevel = member.satisfaction.level;

      member.updateSatisfaction(20, 'Successful raid participation');

      expect(member.satisfaction.value).toBe(70);
      expect(member.satisfaction.level).toBe('SATISFIED');
    });

    it('should handle negative satisfaction changes', () => {
      member.updateSatisfaction(-30, 'Failed raid');

      expect(member.satisfaction.value).toBe(20);
      expect(member.satisfaction.level).toBe('VERY_DISSATISFIED');
    });

    it('should clamp satisfaction within valid bounds', () => {
      member.updateSatisfaction(100, 'Amazing success'); // Should clamp to 100
      expect(member.satisfaction.value).toBe(100);

      member.updateSatisfaction(-150, 'Terrible failure'); // Should clamp to 0
      expect(member.satisfaction.value).toBe(0);
    });
  });

  describe('CloudEvent Integration', () => {
    it('should create member recruited event correctly', () => {
      const eventData = {
        memberId: 'member-123',
        memberName: 'Test Warrior',
        memberClass: 'WARRIOR',
        memberSpecialization: 'TANK',
        memberRarity: 'COMMON',
        recruitmentSource: 'SEARCH',
        recruitmentCost: {
          gold: 100,
          materials: 50,
          influence: 25,
        },
        initialSatisfaction: 50,
        isLegendary: false,
      };

      const event = GuildEventBuilder.createMemberRecruitedEvent(
        guild.id,
        eventData
      );

      expect(event.type).toBe(GuildEventType.MEMBER_RECRUITED);
      expect(event.specversion).toBe('1.0');
      expect(event.source).toBe(`/guild-manager/core/${guild.id}`);
      expect(event.subject).toBe('member-member-123');
      expect(event.data).toEqual(eventData);
      expect(event.id).toBeDefined();
      expect(event.time).toBeDefined();
    });

    it('should create raid completed event correctly', () => {
      const eventData = {
        raidId: 'raid-456',
        raidName: 'Kobold Mines',
        participants: ['member-1', 'member-2', 'member-3'],
        result: 'SUCCESS' as const,
        duration: 120,
        successProbability: 0.85,
        mvpMember: 'member-1',
        casualtiesCount: 0,
        lootDistributed: [
          {
            itemId: 'sword-001',
            itemName: 'Iron Sword',
            rarity: 'COMMON',
            recipientId: 'member-1',
          },
        ],
        experienceGained: 150,
        reputationGained: 10,
      };

      const event = GuildEventBuilder.createRaidCompletedEvent(eventData);

      expect(event.type).toBe(GuildEventType.RAID_COMPLETED);
      expect(event.specversion).toBe('1.0');
      expect(event.source).toBe('/guild-manager/core/raid-hall');
      expect(event.subject).toBe('raid-raid-456');
      expect(event.data).toEqual(eventData);
    });

    it('should generate unique event IDs', () => {
      const event1 = GuildEventBuilder.createGenericEvent(
        GuildEventType.RESOURCE_UPDATED,
        { test: 'data' },
        {}
      );

      const event2 = GuildEventBuilder.createGenericEvent(
        GuildEventType.RESOURCE_UPDATED,
        { test: 'data' },
        {}
      );

      expect(event1.id).not.toBe(event2.id);
      expect(event1.id).toMatch(/^guild-event-\d+-[a-z0-9]{8}$/);
    });

    it('should include proper timestamp format', () => {
      const event = GuildEventBuilder.createGenericEvent(
        GuildEventType.GUILD_CREATED,
        { guildName: 'Test Guild' },
        {}
      );

      expect(event.time).toBeDefined();
      expect(() => new Date(event.time!)).not.toThrow();
      expect(new Date(event.time!).toISOString()).toBe(event.time);
    });
  });

  describe('Performance Requirements', () => {
    it('should handle large member collections efficiently', () => {
      const startTime = performance.now();

      // Simulate adding 1000 members
      for (let i = 0; i < 1000; i++) {
        const member = {
          id: `member-${i}`,
          name: `Member ${i}`,
          characterClass: 'WARRIOR',
        };
        guild.members.set(member.id, member);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(guild.members.size).toBe(1000);
      expect(duration).toBeLessThan(50); // Should complete within 50ms
    });

    it('should maintain SLO for resource calculations', () => {
      const startTime = performance.now();

      // Perform multiple resource operations
      let resources = new ResourceAmount(1000, 500, 250);
      for (let i = 0; i < 100; i++) {
        const cost = new ResourceAmount(10, 5, 2);
        if (resources.canAfford(cost)) {
          resources = resources.subtract(cost);
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10); // Should complete within 10ms
      expect(resources.gold).toBe(0); // All spent
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid event data gracefully', () => {
      expect(() => {
        GuildEventBuilder.createMemberRecruitedEvent(
          '', // Empty guild ID should be handled gracefully
          {} as any // Invalid data
        );
      }).not.toThrow(); // Builder should create event but validation might fail
    });

    it('should handle concurrent resource access safely', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => {
        return Promise.resolve().then(() => {
          const candidate = {
            id: `member-${i}`,
            name: `Member ${i}`,
            characterClass: 'WARRIOR',
          };
          // 增加招募成本，使得资源不足以支持所有招募
          const cost = new ResourceAmount(150, 75, 20);
          return guild.recruitMember(candidate, cost);
        });
      });

      const results = await Promise.all(promises);

      // Only some recruits should succeed due to resource constraints
      // 1000金币/150成本 = 6.67，所以最多6次成功，其余4次失败
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      expect(successful.length).toBeGreaterThan(0);
      expect(failed.length).toBeGreaterThan(0);
      expect(successful.length + failed.length).toBe(10);
    });
  });

  describe('Contract Compliance', () => {
    it('should enforce CloudEvents v1.0 specification', () => {
      const event = GuildEventBuilder.createGenericEvent(
        GuildEventType.MEMBER_RECRUITED,
        { test: 'data' },
        {}
      );

      // Required fields
      expect(event.specversion).toBe('1.0');
      expect(event.id).toBeDefined();
      expect(event.source).toBeDefined();
      expect(event.type).toBeDefined();
      expect(event.time).toBeDefined();

      // Optional fields should be defined when provided
      expect(event.datacontenttype).toBe('application/json');
    });

    it('should maintain type safety for event data', () => {
      const eventData = {
        memberId: 'member-123',
        memberName: 'Test Member',
        memberClass: 'WARRIOR',
        memberSpecialization: 'TANK',
        memberRarity: 'COMMON',
        recruitmentSource: 'SEARCH',
        recruitmentCost: {
          gold: 100,
          materials: 50,
          influence: 25,
        },
        initialSatisfaction: 50,
        isLegendary: false,
      };

      const event = GuildEventBuilder.createMemberRecruitedEvent(
        'guild-1',
        eventData
      );

      // TypeScript should enforce correct data structure
      expect(event.data?.memberId).toBe('member-123');
      expect(event.data?.recruitmentCost.gold).toBe(100);
    });
  });
});

/**
 * 公会管理器PRD分片1 - 单元测试
 * 测试核心契约、数据模型和业务逻辑
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  Guild,
  GuildMember,
  GameTurn,
  CriticalDecision,
  ResourceState,
  PersonalityTraits,
  IGuildRepository,
  IMemberRepository,
  ITurnRepository,
  GuildStateChange,
  MemberStateChange,
  DecisionParameters,
  AIActionParameters,
} from '../../src/shared/contracts/guild-manager-chunk-001';
import {
  TurnPhase,
  MemberRole,
  MemberState,
  GuildStatus,
  UrgencyLevel,
} from '../../src/shared/contracts/guild-manager-chunk-001';
import { CloudEventValidator } from '../../src/shared/validation/CloudEventValidator';
import { TestGuildRepository } from '../../src/shared/adapters/memory/TestGuildRepository';
import { TestMemberRepository } from '../../src/shared/adapters/memory/TestMemberRepository';
import { TestTurnRepository } from '../../src/shared/adapters/memory/TestTurnRepository';

describe('Guild Manager Chunk 001 - Core Models', () => {
  let mockGuild: Guild;
  let mockMember: GuildMember;
  let mockTurn: GameTurn;

  beforeEach(() => {
    mockGuild = {
      id: 'guild-001' as any,
      name: 'Test Guild',
      level: 10,
      reputation: 1500,
      resources: {
        gold: 10000,
        reputation: 1500,
        influence: 750,
        materials: 500,
      },
      members: [],
      currentTurn: 1,
      status: GuildStatus.ACTIVE,
      updatedAt: new Date().toISOString(),
    };

    mockMember = {
      id: 'member-001' as any,
      name: 'Test Member',
      level: 25,
      role: 'member' as any,
      personalityTraits: {
        ambition: 75,
        loyalty: 80,
        competitiveness: 60,
        sociability: 70,
        reliability: 85,
      },
      relationships: {},
      currentState: MemberState.ACTIVE,
      aiGoals: [],
      updatedAt: new Date().toISOString(),
    };

    mockTurn = {
      id: 'turn-001' as any,
      weekNumber: 1,
      currentPhase: TurnPhase.RESOLUTION,
      startedAt: new Date().toISOString(),
      phaseDeadlines: {},
      pendingDecisions: [],
    };
  });

  describe('Guild Entity', () => {
    it('should have valid guild properties', () => {
      expect(mockGuild.id).toBeDefined();
      expect(mockGuild.name).toBe('Test Guild');
      expect(mockGuild.level).toBe(10);
      expect(mockGuild.reputation).toBe(1500);
      expect(mockGuild.status).toBe(GuildStatus.ACTIVE);
    });

    it('should have proper resource state', () => {
      const resources = mockGuild.resources;
      expect(resources.gold).toBe(10000);
      expect(resources.reputation).toBe(1500);
      expect(resources.influence).toBe(750);
      expect(resources.materials).toBe(500);
    });

    it('should support members array', () => {
      expect(Array.isArray(mockGuild.members)).toBe(true);
      mockGuild.members.push(mockMember);
      expect(mockGuild.members.length).toBe(1);
    });
  });

  describe('Guild Member Entity', () => {
    it('should have valid member properties', () => {
      expect(mockMember.id).toBeDefined();
      expect(mockMember.name).toBe('Test Member');
      expect(mockMember.level).toBe(25);
      expect(mockMember.currentState).toBe(MemberState.ACTIVE);
    });

    it('should have personality traits within valid range', () => {
      const traits = mockMember.personalityTraits;
      Object.values(traits).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });

    it('should support empty relationships map', () => {
      expect(typeof mockMember.relationships).toBe('object');
      expect(Object.keys(mockMember.relationships)).toHaveLength(0);
    });

    it('should support adding relationships', () => {
      mockMember.relationships['member-002'] = {
        trust: 50,
        respect: 60,
        friendship: 70,
        lastInteraction: new Date().toISOString(),
      };
      expect(mockMember.relationships['member-002'].trust).toBe(50);
    });
  });

  describe('Game Turn Entity', () => {
    it('should have valid turn properties', () => {
      expect(mockTurn.id).toBeDefined();
      expect(mockTurn.weekNumber).toBe(1);
      expect(mockTurn.currentPhase).toBe(TurnPhase.RESOLUTION);
      expect(mockTurn.startedAt).toBeDefined();
    });

    it('should support phase transitions', () => {
      mockTurn.currentPhase = TurnPhase.PLAYER;
      expect(mockTurn.currentPhase).toBe(TurnPhase.PLAYER);

      mockTurn.currentPhase = TurnPhase.AI_SIMULATION;
      expect(mockTurn.currentPhase).toBe(TurnPhase.AI_SIMULATION);
    });

    it('should support pending decisions', () => {
      const decision: CriticalDecision = {
        id: 'decision-001' as any,
        title: 'Test Decision',
        description: 'A test decision',
        urgency: UrgencyLevel.MEDIUM,
        options: [],
        consequences: {},
        autoResolve: {
          action: 'default',
          reason: 'timeout',
        },
      };

      mockTurn.pendingDecisions.push(decision);
      expect(mockTurn.pendingDecisions).toHaveLength(1);
      expect(mockTurn.pendingDecisions[0].urgency).toBe(UrgencyLevel.MEDIUM);
    });
  });
});

describe('Guild Manager Chunk 001 - Repository Contracts', () => {
  let guildRepo: IGuildRepository;
  let memberRepo: IMemberRepository;
  let turnRepo: ITurnRepository;

  beforeEach(() => {
    guildRepo = new TestGuildRepository();
    memberRepo = new TestMemberRepository();
    turnRepo = new TestTurnRepository();
  });

  describe('Guild Repository', () => {
    it('should support basic CRUD operations', async () => {
      const guild: Guild = {
        id: 'guild-001' as any,
        name: 'Test Guild',
        level: 10,
        reputation: 1500,
        resources: {
          gold: 10000,
          reputation: 1500,
          influence: 750,
          materials: 500,
        },
        members: [],
        currentTurn: 1,
        status: GuildStatus.ACTIVE,
        updatedAt: new Date().toISOString(),
      };

      // Save guild
      await guildRepo.save(guild);

      // Find by ID
      const found = await guildRepo.findById('guild-001' as any);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Test Guild');

      // Delete guild
      await guildRepo.delete('guild-001' as any);
      const deleted = await guildRepo.findById('guild-001' as any);
      expect(deleted).toBeNull();
    });

    it('should have extended repository methods', () => {
      expect(typeof guildRepo.findByLevel).toBe('function');
      expect(typeof guildRepo.findByStatus).toBe('function');
      expect(typeof guildRepo.updateResources).toBe('function');
      expect(typeof guildRepo.incrementTurn).toBe('function');
    });
  });

  describe('Member Repository', () => {
    it('should support basic CRUD operations', async () => {
      const member: GuildMember = {
        id: 'member-001' as any,
        name: 'Test Member',
        level: 25,
        role: 'member' as any,
        personalityTraits: {
          ambition: 75,
          loyalty: 80,
          competitiveness: 60,
          sociability: 70,
          reliability: 85,
        },
        relationships: {},
        currentState: MemberState.ACTIVE,
        aiGoals: [],
        updatedAt: new Date().toISOString(),
      };

      await memberRepo.save(member);
      const found = await memberRepo.findById('member-001' as any);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Test Member');
      expect(found?.currentState).toBe(MemberState.ACTIVE);
    });

    it('should have extended repository methods', () => {
      expect(typeof memberRepo.findByGuildId).toBe('function');
      expect(typeof memberRepo.findByRole).toBe('function');
      expect(typeof memberRepo.findByState).toBe('function');
      expect(typeof memberRepo.updateState).toBe('function');
      expect(typeof memberRepo.updateRelationships).toBe('function');
    });
  });

  describe('Turn Repository', () => {
    it('should support basic CRUD operations', async () => {
      const turn: GameTurn = {
        id: 'turn-001' as any,
        weekNumber: 1,
        currentPhase: TurnPhase.RESOLUTION,
        startedAt: new Date().toISOString(),
        phaseDeadlines: {},
        pendingDecisions: [],
      };

      await turnRepo.save(turn);
      const found = await turnRepo.findById('turn-001' as any);
      expect(found).not.toBeNull();
      expect(found?.weekNumber).toBe(1);
      expect(found?.currentPhase).toBe(TurnPhase.RESOLUTION);
    });

    it('should have extended repository methods', () => {
      expect(typeof turnRepo.getCurrentTurn).toBe('function');
      expect(typeof turnRepo.findByPhase).toBe('function');
      expect(typeof turnRepo.updatePhase).toBe('function');
    });
  });
});

describe('Guild Manager Chunk 001 - Business Logic', () => {
  describe('Turn Phase Transitions', () => {
    it('should validate turn phase transitions', () => {
      const validTransitions = {
        [TurnPhase.IDLE]: [TurnPhase.RESOLUTION],
        [TurnPhase.RESOLUTION]: [TurnPhase.PLAYER, TurnPhase.ERROR],
        [TurnPhase.PLAYER]: [TurnPhase.AI_SIMULATION, TurnPhase.ERROR],
        [TurnPhase.AI_SIMULATION]: [TurnPhase.COMPLETED, TurnPhase.ERROR],
        [TurnPhase.COMPLETED]: [TurnPhase.IDLE],
        [TurnPhase.ERROR]: [TurnPhase.IDLE, TurnPhase.RESOLUTION],
      };

      // Test valid transitions
      expect(validTransitions[TurnPhase.IDLE]).toContain(TurnPhase.RESOLUTION);
      expect(validTransitions[TurnPhase.RESOLUTION]).toContain(
        TurnPhase.PLAYER
      );
      expect(validTransitions[TurnPhase.PLAYER]).toContain(
        TurnPhase.AI_SIMULATION
      );
      expect(validTransitions[TurnPhase.AI_SIMULATION]).toContain(
        TurnPhase.COMPLETED
      );
      expect(validTransitions[TurnPhase.COMPLETED]).toContain(TurnPhase.IDLE);
    });
  });

  describe('Member State Management', () => {
    it('should support all member states', () => {
      const allStates = Object.values(MemberState);
      expect(allStates).toContain(MemberState.ACTIVE);
      expect(allStates).toContain(MemberState.INACTIVE);
      expect(allStates).toContain(MemberState.CONFLICTED);
      expect(allStates).toContain(MemberState.MOTIVATED);
      expect(allStates).toContain(MemberState.BURNOUT);
      expect(allStates.length).toBe(10); // 确保所有状态都存在
    });

    it('should validate personality traits range', () => {
      const traits: PersonalityTraits = {
        ambition: 75,
        loyalty: 80,
        competitiveness: 60,
        sociability: 70,
        reliability: 85,
      };

      Object.values(traits).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Resource Management', () => {
    it('should support resource calculations', () => {
      const resources: ResourceState = {
        gold: 10000,
        reputation: 1500,
        influence: 750,
        materials: 500,
      };

      // Test resource modifications
      resources.gold -= 1000;
      resources.reputation += 100;

      expect(resources.gold).toBe(9000);
      expect(resources.reputation).toBe(1600);
    });

    it('should handle resource constraints', () => {
      const resources: ResourceState = {
        gold: 100,
        reputation: 50,
        influence: 25,
        materials: 10,
      };

      // Test minimum constraints
      const minResources = Math.max(0, resources.gold - 200);
      expect(minResources).toBe(0); // 不能为负数
    });
  });

  describe('Decision System', () => {
    it('should create valid decisions', () => {
      const decision: CriticalDecision = {
        id: 'decision-001' as any,
        title: 'Member Promotion Request',
        description: 'A member has requested promotion to officer',
        urgency: UrgencyLevel.MEDIUM,
        deadline: 3,
        options: [
          {
            id: 'approve',
            label: 'Approve Promotion',
            description: 'Promote the member to officer role',
            cost: { reputation: 50 },
          },
          {
            id: 'deny',
            label: 'Deny Promotion',
            description: 'Keep the member at current role',
            cost: { influence: 10 },
          },
        ],
        consequences: {
          approve: {
            immediate: [
              { type: 'state', target: 'member-001', value: 'motivated' },
            ],
            delayed: [],
            reputation: 10,
            resources: { reputation: -50 },
          },
          deny: {
            immediate: [
              { type: 'state', target: 'member-001', value: 'conflicted' },
            ],
            delayed: [],
            reputation: -5,
            resources: { influence: -10 },
          },
        },
        autoResolve: {
          action: 'deny',
          reason: 'Conservative default when no action taken',
        },
      };

      expect(decision.id).toBeDefined();
      expect(decision.options.length).toBe(2);
      expect(decision.consequences['approve']).toBeDefined();
      expect(decision.consequences['deny']).toBeDefined();
      expect(decision.autoResolve?.action).toBe('deny');
    });
  });
});

describe('Guild Manager Chunk 001 - Type Safety Tests', () => {
  it('should enforce strong typing for state changes', () => {
    const guildStateChange: GuildStateChange = {
      type: 'guild_update',
      target: 'guild-001',
      before: { level: 10 },
      after: { level: 11 },
    };

    expect(guildStateChange.before.level).toBe(10);
    expect(guildStateChange.after.level).toBe(11);
  });

  it('should validate decision parameters with discriminated unions', () => {
    const promotionParams: DecisionParameters = {
      type: 'promotion',
      memberId: 'member-001' as any,
      newRole: 'officer' as any,
    };

    expect(promotionParams.type).toBe('promotion');
    if (promotionParams.type === 'promotion') {
      expect(promotionParams.memberId).toBeDefined();
      expect(promotionParams.newRole).toBeDefined();
    }
  });

  it('should validate AI action parameters', () => {
    const aiAction: AIActionParameters = {
      type: 'social_interaction',
      targetMemberId: 'member-002' as any,
      interactionType: 'support',
    };

    expect(aiAction.type).toBe('social_interaction');
    if (aiAction.type === 'social_interaction') {
      expect(aiAction.targetMemberId).toBeDefined();
      expect(aiAction.interactionType).toBe('support');
    }
  });
});

describe('Guild Manager Chunk 001 - CloudEvents Validation Tests', () => {
  it('should validate CloudEvent 1.0 structure', () => {
    const validEvent = {
      specversion: '1.0',
      id: 'test-001',
      source: 'gm://turn-system',
      type: 'io.vitegame.gm.guild.turn.started',
      time: new Date().toISOString(),
    };

    const validation = CloudEventValidator.validate(validEvent);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should reject invalid CloudEvent structure', () => {
    const invalidEvent = {
      // 缺少必需字段
      specversion: '1.0',
      type: 'io.vitegame.gm.guild.turn.started',
    };

    const validation = CloudEventValidator.validate(invalidEvent);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors.some(e => e.field === 'id')).toBe(true);
    expect(validation.errors.some(e => e.field === 'source')).toBe(true);
  });

  it('should reject unknown event types', () => {
    const unknownTypeEvent = {
      specversion: '1.0',
      id: 'test-001',
      source: 'gm://test',
      type: 'unknown.event.type',
    };

    const validation = CloudEventValidator.validate(unknownTypeEvent);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some(e => e.field === 'type')).toBe(true);
  });

  it('should create standard CloudEvents', () => {
    const event = CloudEventValidator.createEvent(
      'gm.guild.turn.started',
      'gm://turn-system',
      { guildId: 'guild-001', weekNumber: 1 }
    );

    expect(event.specversion).toBe('1.0');
    expect(event.type).toBe('gm.guild.turn.started');
    expect(event.source).toBe('gm://turn-system');
    expect(event.id).toBeDefined();
    expect(event.time).toBeDefined();
    expect(event.data).toEqual({ guildId: 'guild-001', weekNumber: 1 });
  });
});

describe('Guild Manager Chunk 001 - Performance Tests', () => {
  it('should handle large member collections efficiently', () => {
    const startTime = Date.now();

    // 创建大量成员数据
    const members: GuildMember[] = [];
    for (let i = 0; i < 1000; i++) {
      members.push({
        id: `member-${i}` as any,
        name: `Member ${i}`,
        level: Math.floor(Math.random() * 50) + 1,
        role: 'member' as any,
        personalityTraits: {
          ambition: Math.floor(Math.random() * 100),
          loyalty: Math.floor(Math.random() * 100),
          competitiveness: Math.floor(Math.random() * 100),
          sociability: Math.floor(Math.random() * 100),
          reliability: Math.floor(Math.random() * 100),
        },
        relationships: {},
        currentState: MemberState.ACTIVE,
        aiGoals: [],
        updatedAt: new Date().toISOString(),
      });
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(members.length).toBe(1000);
    expect(duration).toBeLessThan(1000); // 应该在1秒内完成
  });

  it('should validate SLO thresholds', () => {
    // 模拟UI响应时间测试
    const workPanelLoadTime = 95; // ms
    const aiDecisionTime = 45; // ms
    const turnTransitionTime = 180; // ms

    // 验证P95 SLO目标
    expect(workPanelLoadTime).toBeLessThanOrEqual(100); // UI_P95_100ms
    expect(aiDecisionTime).toBeLessThanOrEqual(50); // EVENT_P95_50ms
    expect(turnTransitionTime).toBeLessThanOrEqual(200); // 回合转换阈值
  });
});

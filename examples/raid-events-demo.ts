/**
 * 副本管理CloudEvents使用示例
 * 演示修复后的CloudEvents 1.0标准实现
 */

import {
  createRaidEvent,
  RaidCompositionCreatedData,
  CombatSimulationCompletedData,
  AIAssignmentCompletedData,
  RaidType,
} from '../src/shared/contracts/guild-manager-chunk-002';

// 示例1：创建阵容事件
const createCompositionEvent = () => {
  const data: RaidCompositionCreatedData = {
    compositionId: 'comp-123',
    raidType: RaidType.LARGE_DUNGEON,
    createdBy: 'user-456',
    guildId: 'guild-789',
    timestamp: new Date().toISOString(),
    memberSlots: 25,
  };

  return createRaidEvent(
    'io.vitegame.gm.raid.composition.created',
    'RAID_MANAGEMENT',
    data,
    {
      compositionId: data.compositionId,
      guildId: data.guildId,
    }
  );
};

// 示例2：战斗模拟完成事件
const createSimulationEvent = () => {
  const data: CombatSimulationCompletedData = {
    simulationId: 'sim-789',
    compositionId: 'comp-123',
    dungeonId: 'dungeon-456',
    result: {
      successProbability: 0.85,
      estimatedWipeCount: 2,
      keyRisks: ['坦克装备不足', 'DPS输出偏低'],
    },
    performance: {
      simulationTimeMs: 150,
      accuracy: 0.92,
    },
  };

  return createRaidEvent(
    'io.vitegame.gm.raid.simulation.completed',
    'COMBAT_SIMULATOR',
    data,
    {
      compositionId: data.compositionId,
    }
  );
};

// 示例3：AI分配完成事件
const createAIAssignmentEvent = () => {
  const data: AIAssignmentCompletedData = {
    compositionId: 'comp-123',
    assignmentResult: {
      success: true,
      assignedMembers: 23,
      unassignedSlots: 2,
      conflicts: [],
      suggestions: [],
    },
    requestedBy: 'user-456',
    timestamp: new Date().toISOString(),
  };

  return createRaidEvent(
    'io.vitegame.gm.tactical.ai.assignment.completed',
    'AI_ASSIGNMENT',
    data,
    {
      compositionId: data.compositionId,
    }
  );
};

// 验证CloudEvents 1.0标准合规性
const validateCloudEvent = () => {
  const event = createCompositionEvent();

  console.log('CloudEvents 1.0标准检查：');
  console.log('✓ specversion:', event.specversion === '1.0');
  console.log(
    '✓ type (reverse-DNS):',
    event.type.startsWith('io.vitegame.gm.')
  );
  console.log('✓ source (URI):', event.source.startsWith('io.vitegame.gm://'));
  console.log('✓ id (unique):', !!event.id);
  console.log(
    '✓ datacontenttype:',
    event.datacontenttype === 'application/json'
  );
  console.log('✓ data payload:', !!event.data);

  return event;
};

export {
  createCompositionEvent,
  createSimulationEvent,
  createAIAssignmentEvent,
  validateCloudEvent,
};

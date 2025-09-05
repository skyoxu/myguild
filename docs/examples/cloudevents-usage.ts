/**
 * CloudEvents v1.0规范兼容事件系统使用示例
 *
 * 本示例展示了修复后的事件系统如何正确创建和处理CloudEvents
 * 符合CloudEvents v1.0规范的同时保持向后兼容性
 */

import {
  EventUtils,
  type DomainEvent,
  type EventPriority,
} from '../src/shared/contracts/events';

// ============================================================================
// 示例1: 标准CloudEvents v1.0事件创建
// ============================================================================

// 使用对象调用方式 (推荐)
const gameEvent = EventUtils.createEvent({
  type: 'game.player.leveled_up',
  source: '/vitegame/player-system',
  data: {
    playerId: 'player-123',
    newLevel: 5,
    experience: 1250,
  },
  subject: 'player-123',
  datacontenttype: 'application/json',
});

console.log('CloudEvents兼容的游戏事件:', gameEvent);
// 输出将包含所有必需字段: specversion, id, source, type, time
// 以及可选字段: subject, datacontenttype, data

// ============================================================================
// 示例2: 使用参数调用方式 (向后兼容)
// ============================================================================

const uiEvent = EventUtils.createEvent(
  'ui.dialog.opened',
  '/vitegame/ui-system',
  { dialogType: 'settings', modal: true },
  {
    priority: 'high' as EventPriority,
    traceId: 'trace-abc123',
    sequenceId: 1,
  }
);

console.log('UI事件 (向后兼容模式):', uiEvent);
// 输出将包含: CloudEvents标准字段 + 扩展字段 (priority, traceId, sequenceId)

// ============================================================================
// 示例3: 系统事件创建
// ============================================================================

const systemEvent = EventUtils.createEvent({
  type: 'system.error.occurred',
  source: '/vitegame/error-handler',
  data: {
    errorCode: 'E001',
    message: 'Connection timeout',
    stack: 'Error stack trace...',
  },
  subject: 'network-connection',
  time: new Date().toISOString(),
});

console.log('系统错误事件:', systemEvent);

// ============================================================================
// 示例4: 验证事件是否符合CloudEvents v1.0规范
// ============================================================================

// 检查必需字段
function validateCloudEvent(event: any): boolean {
  const required = ['specversion', 'id', 'source', 'type'];

  for (const field of required) {
    if (!event[field]) {
      console.error(`缺少必需字段: ${field}`);
      return false;
    }
  }

  if (event.specversion !== '1.0') {
    console.error(`不支持的specversion: ${event.specversion}`);
    return false;
  }

  return true;
}

console.log('gameEvent有效:', validateCloudEvent(gameEvent));
console.log('uiEvent有效:', validateCloudEvent(uiEvent));
console.log('systemEvent有效:', validateCloudEvent(systemEvent));

// ============================================================================
// 示例5: 事件优先级和批处理
// ============================================================================

const priorities: EventPriority[] = ['critical', 'high', 'medium', 'low'];

priorities.forEach(priority => {
  const event = EventUtils.createEvent(
    `test.priority.${priority}`,
    '/vitegame/test',
    { priority },
    { priority }
  );

  console.log(`${priority} 优先级事件:`, {
    type: event.type,
    priority: event.priority,
    id: event.id,
  });
});

// ============================================================================
// 示例6: 事件名称验证
// ============================================================================

const validEventNames = [
  'game.player.created',
  'ui.dialog.opened',
  'system.lifecycle.started',
];

const invalidEventNames = ['invalid-name', 'game.player', 'game..empty'];

console.log('\n有效的事件名称:');
validEventNames.forEach(name => {
  console.log(`${name}: ${EventUtils.isValidEventName(name)}`);
});

console.log('\n无效的事件名称:');
invalidEventNames.forEach(name => {
  console.log(`${name}: ${EventUtils.isValidEventName(name)}`);
});

// ============================================================================
// 示例7: 事件模式匹配
// ============================================================================

const patterns = ['game.*', 'ui.dialog.*', 'system.**.occurred'];

const eventNames = [
  'game.player.created',
  'ui.dialog.opened',
  'ui.button.clicked',
  'system.error.occurred',
];

console.log('\n模式匹配测试:');
patterns.forEach(pattern => {
  console.log(`模式 "${pattern}" 匹配:`);
  eventNames.forEach(name => {
    const matches = EventUtils.matchesPattern(name, pattern);
    if (matches) {
      console.log(`  ✓ ${name}`);
    }
  });
});

export { gameEvent, uiEvent, systemEvent, validateCloudEvent };

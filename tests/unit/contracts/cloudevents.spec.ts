/**
 * CloudEvents 1.0规范核心实现测试 - ADR-0004验证
 * 基于COPY.md的就地可执行测试片段
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  mkEvent,
  assertCe,
  createAppEvent,
  isCloudEvent,
  validateEvents,
  serializeEvent,
  deserializeEvent,
  type CeBase,
  type CloudEvent,
  EVENT_SOURCES,
} from '../../../src/shared/contracts/cloudevents-core';

describe('CloudEvents 1.0 Core Implementation - ADR-0004', () => {
  describe('mkEvent - CloudEvent Constructor', () => {
    it('创建符合CloudEvents 1.0规范的基本事件', () => {
      const event = mkEvent({
        source: 'app://test/source',
        type: 'test.event.created',
      });

      // 验证必填字段
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('source', 'app://test/source');
      expect(event).toHaveProperty('type', 'test.event.created');
      expect(event).toHaveProperty('specversion', '1.0');
      expect(event).toHaveProperty('time');

      // 验证ID格式（UUID）
      expect(event.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      // 验证时间格式（ISO 8601）
      expect(() => new Date(event.time)).not.toThrow();
      expect(new Date(event.time).toISOString()).toBe(event.time);
    });

    it('创建带数据负载的事件', () => {
      interface TestData {
        message: string;
        count: number;
      }

      const testData: TestData = { message: 'Hello CloudEvents', count: 42 };

      const event = mkEvent({
        source: 'app://test/data-source',
        type: 'test.data.processed',
        data: testData,
        datacontenttype: 'application/json',
        subject: 'test-subject-123',
      });

      expect(event.data).toEqual(testData);
      expect(event.datacontenttype).toBe('application/json');
      expect(event.subject).toBe('test-subject-123');
    });

    it('生成的事件ID应该唯一', () => {
      const event1 = mkEvent({ source: 'app://test1', type: 'test.unique.1' });
      const event2 = mkEvent({ source: 'app://test2', type: 'test.unique.2' });

      expect(event1.id).not.toBe(event2.id);
    });
  });

  describe('assertCe - CloudEvent Validator', () => {
    it('验证正确的CloudEvent通过', () => {
      const validEvent = mkEvent({
        source: 'app://guild',
        type: 'guild.created',
      });

      expect(() => assertCe(validEvent)).not.toThrow();
    });

    it('验证缺失必填字段的事件失败', () => {
      const testCases = [
        {
          source: 'app://test',
          type: 'test.event',
          specversion: '1.0',
          time: new Date().toISOString(),
        }, // 缺失id
        {
          id: '123',
          type: 'test.event',
          specversion: '1.0',
          time: new Date().toISOString(),
        }, // 缺失source
        {
          id: '123',
          source: 'app://test',
          specversion: '1.0',
          time: new Date().toISOString(),
        }, // 缺失type
        {
          id: '123',
          source: 'app://test',
          type: 'test.event',
          time: new Date().toISOString(),
        }, // 缺失specversion
        {
          id: '123',
          source: 'app://test',
          type: 'test.event',
          specversion: '1.0',
        }, // 缺失time
      ];

      testCases.forEach((testEvent, index) => {
        expect(
          () => assertCe(testEvent),
          `Test case ${index} should fail validation`
        ).toThrow(`CloudEvent missing required field`);
      });
    });

    it('验证错误的specversion失败', () => {
      const invalidEvent = {
        id: 'test-id',
        source: 'app://test',
        type: 'test.event',
        specversion: '2.0', // 不支持的版本
        time: new Date().toISOString(),
      };

      expect(() => assertCe(invalidEvent)).toThrow(
        "Unsupported CloudEvents specversion: 2.0, expected '1.0'"
      );
    });

    it('验证无效时间格式失败', () => {
      const invalidTimeEvent = {
        id: 'test-id',
        source: 'app://test',
        type: 'test.event',
        specversion: '1.0',
        time: 'invalid-time-format',
      };

      expect(() => assertCe(invalidTimeEvent)).toThrow('Invalid time format');
    });

    it('验证无效URI格式source给出警告', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const invalidSourceEvent = {
        id: 'test-id',
        source: 'not-a-valid-uri', // 无效URI
        type: 'test.event',
        specversion: '1.0',
        time: new Date().toISOString(),
      };

      assertCe(invalidSourceEvent); // 不抛出错误，但会警告

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CloudEvent source should be a valid URI')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createAppEvent - 类型安全事件工厂', () => {
    it('创建应用级事件', () => {
      const event = createAppEvent('app.lifecycle.started', 'APP', {
        version: '1.0.0',
        environment: 'test',
      });

      expect(event.type).toBe('app.lifecycle.started');
      expect(event.source).toBe(EVENT_SOURCES.APP);
      expect(event.data).toEqual({ version: '1.0.0', environment: 'test' });

      // 验证符合CloudEvents规范
      expect(() => assertCe(event)).not.toThrow();
    });

    it('创建游戏事件带主题', () => {
      const event = createAppEvent(
        'game.scene.loaded',
        'GAME',
        { sceneName: 'MainMenu', duration: 1200 },
        {
          subject: 'scene/main-menu',
          datacontenttype: 'application/json',
        }
      );

      expect(event.type).toBe('game.scene.loaded');
      expect(event.source).toBe(EVENT_SOURCES.GAME);
      expect(event.subject).toBe('scene/main-menu');
      expect(event.datacontenttype).toBe('application/json');
    });
  });

  describe('Event Validation Utilities', () => {
    it('isCloudEvent正确识别有效事件', () => {
      const validEvent = mkEvent({ source: 'app://test', type: 'test.valid' });
      const invalidEvent = { notACloudEvent: true };

      expect(isCloudEvent(validEvent)).toBe(true);
      expect(isCloudEvent(invalidEvent)).toBe(false);
      expect(isCloudEvent(null)).toBe(false);
      expect(isCloudEvent(undefined)).toBe(false);
    });

    it('validateEvents批量验证事件', () => {
      const validEvent1 = mkEvent({
        source: 'app://test1',
        type: 'test.event1',
      });
      const validEvent2 = mkEvent({
        source: 'app://test2',
        type: 'test.event2',
      });
      const invalidEvent = { source: 'app://test3' }; // 缺少type等字段

      // 所有有效事件
      const validEvents = validateEvents([validEvent1, validEvent2]);
      expect(validEvents).toHaveLength(2);

      // 包含无效事件
      expect(() =>
        validateEvents([validEvent1, invalidEvent, validEvent2])
      ).toThrow('Event validation failed');
    });
  });

  describe('Event Serialization', () => {
    it('事件序列化和反序列化往返测试', () => {
      const originalEvent = mkEvent({
        source: 'app://serialization-test',
        type: 'test.serialization.roundtrip',
        data: { message: 'Test serialization', timestamp: Date.now() },
        subject: 'serialization-test',
      });

      // 序列化
      const serialized = serializeEvent(originalEvent);
      expect(typeof serialized).toBe('string');

      // 反序列化
      const deserialized = deserializeEvent(serialized);

      // 验证数据完整性
      expect(deserialized).toEqual(originalEvent);
      expect(deserialized.id).toBe(originalEvent.id);
      expect(deserialized.source).toBe(originalEvent.source);
      expect(deserialized.type).toBe(originalEvent.type);
      expect(deserialized.data).toEqual(originalEvent.data);
    });

    it('反序列化无效JSON抛出错误', () => {
      expect(() => deserializeEvent('invalid json')).toThrow();

      expect(() => deserializeEvent('{"not": "a cloud event"}')).toThrow(
        'CloudEvent missing required field'
      );
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('Electron IPC事件流', () => {
      // 模拟渲染进程向主进程发送窗口控制事件
      const windowEvent = createAppEvent(
        'app.window.created',
        'WINDOW',
        {
          windowId: 'main-window-123',
          bounds: { width: 1920, height: 1080 },
          options: { resizable: true, maximizable: true },
        },
        {
          subject: 'window/main-window-123',
          datacontenttype: 'application/json',
        }
      );

      // 验证事件可以正常序列化传输
      const serialized = serializeEvent(windowEvent);
      const transmitted = deserializeEvent(serialized);

      expect(transmitted.data?.windowId).toBe('main-window-123');
      expect(() => assertCe(transmitted)).not.toThrow();
    });

    it('游戏状态同步事件', () => {
      // 模拟公会成员变化事件
      const memberJoinedEvent = createAppEvent('guild.member.joined', 'GUILD', {
        memberId: 'player-456',
        memberName: 'TestPlayer',
        joinedAt: new Date().toISOString(),
        role: 'member',
      });

      expect(memberJoinedEvent.type).toBe('guild.member.joined');
      expect(memberJoinedEvent.source).toBe(EVENT_SOURCES.GUILD);
      expect(memberJoinedEvent.data?.memberId).toBe('player-456');

      // 验证事件在不同进程间传输的完整性
      const crossProcess = deserializeEvent(serializeEvent(memberJoinedEvent));
      expect(crossProcess.data?.memberName).toBe('TestPlayer');
    });
  });

  describe('Performance Characteristics', () => {
    it('批量创建事件性能测试', () => {
      const start = performance.now();
      const events: CloudEvent[] = [];

      // 创建1000个事件
      for (let i = 0; i < 1000; i++) {
        events.push(
          mkEvent({
            source: `app://perf-test-${i}`,
            type: 'test.performance.batch',
            data: { index: i, message: `Event ${i}` },
          })
        );
      }

      const end = performance.now();
      const duration = end - start;

      expect(events).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // 应该在100ms内完成

      console.log(`创建1000个事件耗时: ${duration.toFixed(2)}ms`);
    });
  });
});

/**
 * CloudEvents 1.0 core contract tests (ADR-0004)
 * Converted to English; removed emojis and non-ASCII output.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  mkEvent,
  assertCe,
  createAppEvent,
  EVENT_SOURCES,
} from '../../../src/shared/contracts/cloudevents-core';

describe('CloudEvents 1.0 Core Implementation - ADR-0004', () => {
  describe('mkEvent - constructor', () => {
    it('creates a basic CloudEvents 1.0 compliant event', () => {
      const event = mkEvent({
        source: 'app://test/source',
        type: 'test.event.created',
      });
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('source', 'app://test/source');
      expect(event).toHaveProperty('type', 'test.event.created');
      expect(event).toHaveProperty('specversion', '1.0');
      expect(event).toHaveProperty('time');
      expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(new Date(event.time).toISOString()).toBe(event.time);
    });

    it('creates an event with custom data payload', () => {
      const event = mkEvent({
        source: 'app://test/data-source',
        type: 'test.data.processed',
        data: { message: 'Hello CloudEvents', count: 42 },
        datacontenttype: 'application/json',
        subject: 'test-subject-123',
      });
      expect(event.data).toEqual({ message: 'Hello CloudEvents', count: 42 });
      expect(event.datacontenttype).toBe('application/json');
      expect(event.subject).toBe('test-subject-123');
    });

    it('generates unique event ids', () => {
      const e1 = mkEvent({ source: 'app://a', type: 't.a' });
      const e2 = mkEvent({ source: 'app://b', type: 't.b' });
      expect(e1.id).not.toBe(e2.id);
    });
  });

  describe('assertCe - validator', () => {
    it('accepts a valid CloudEvent', () => {
      const valid = mkEvent({ source: 'app://guild', type: 'guild.created' });
      expect(() => assertCe(valid)).not.toThrow();
    });

    it('fails when required fields are missing', () => {
      const badCases = [
        {
          source: 'app://x',
          type: 't.x',
          specversion: '1.0',
          time: new Date().toISOString(),
        },
        {
          id: '123',
          type: 't.x',
          specversion: '1.0',
          time: new Date().toISOString(),
        },
        {
          id: '123',
          source: 'app://x',
          specversion: '1.0',
          time: new Date().toISOString(),
        },
        {
          id: '123',
          source: 'app://x',
          type: 't.x',
          time: new Date().toISOString(),
        },
        { id: '123', source: 'app://x', type: 't.x', specversion: '1.0' },
      ];
      badCases.forEach((evt, idx) => {
        expect(() => assertCe(evt as any), `case ${idx} should fail`).toThrow(
          'CloudEvent missing required field'
        );
      });
    });

    it('fails when specversion is unsupported', () => {
      const invalid = {
        id: 'test-id',
        source: 'app://test',
        type: 'test.event',
        specversion: '2.0',
        time: new Date().toISOString(),
      };
      expect(() => assertCe(invalid as any)).toThrow(
        "Unsupported CloudEvents specversion: 2.0, expected '1.0'"
      );
    });

    it('fails when time format is invalid', () => {
      const invalid = {
        id: 'test-id',
        source: 'app://test',
        type: 'test.event',
        specversion: '1.0',
        time: 'invalid-time-format',
      };
      expect(() => assertCe(invalid as any)).toThrow('Invalid time format');
    });

    it('warns when source is not a valid URI', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const evt = {
        id: 'test-id',
        source: 'not-a-valid-uri',
        type: 'test.event',
        specversion: '1.0',
        time: new Date().toISOString(),
      };
      assertCe(evt as any);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('CloudEvent source should be a valid URI')
      );
      spy.mockRestore();
    });
  });

  describe('createAppEvent - factories', () => {
    it('creates an application lifecycle event', () => {
      const e = createAppEvent('app.lifecycle.started', 'APP', {
        version: '1.0.0',
        environment: 'test',
      });
      expect(e.type).toBe('app.lifecycle.started');
      expect(e.source).toBe(EVENT_SOURCES.APP);
      expect(() => assertCe(e)).not.toThrow();
    });

    it('creates a game event with metadata', () => {
      const e = createAppEvent(
        'game.scene.loaded',
        'GAME',
        { sceneName: 'MainMenu', duration: 1200 },
        { subject: 'scene/main-menu', datacontenttype: 'application/json' }
      );
      expect(e.type).toBe('game.scene.loaded');
      expect(e.source).toBe(EVENT_SOURCES.GAME);
      expect(e.subject).toBe('scene/main-menu');
    });
  });
});

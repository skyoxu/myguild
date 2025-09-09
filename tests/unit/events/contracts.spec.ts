import { describe, it, expect } from 'vitest';
import { v4 as uuid } from 'uuid';
import type { SecurityGlobalInitEvent } from '@/shared/contracts/events';

describe('CloudEvents contracts', () => {
  it('security.global.init shape', () => {
    const e: SecurityGlobalInitEvent = {
      specversion: '1.0',
      type: 'security.global.init',
      source: 'app://main',
      id: uuid(),
      time: new Date().toISOString(),
      data: {
        readyAt: new Date().toISOString(),
        handlers: ['permissionCheck', 'beforeRequest'],
      },
    };
    expect(e.type).toBe('security.global.init');
  });
});

import { describe, it, expect, vi } from 'vitest';
import type { AppEvent } from '../../src/core/events/types';
import { InMemoryEventBus } from '../../src/core/events/bus';

describe('04 事件总线', () => {
  it('事件名应满足 <domain>.<action>', async () => {
    const bus = new InMemoryEventBus();
    await expect(
      bus.publish({ type: 'guild.create', name: 'A' } as AppEvent)
    ).resolves.not.toThrow();
    await expect(
      bus.publish({ type: 'invalid', name: 'A' } as any)
    ).rejects.toThrow();
  });

  it('订阅后仅收到对应类型事件（FIFO）', async () => {
    const bus = new InMemoryEventBus();
    const order: string[] = [];
    const a = vi.fn((e: AppEvent) => order.push('a:' + e.type));
    const b = vi.fn((e: AppEvent) => order.push('b:' + e.type));

    bus.subscribe('guild.create', a as any);
    bus.subscribe('guild.create', b as any);
    bus.subscribe('inventory.add', vi.fn()); // 不应被触发

    await bus.publish({ type: 'guild.create', name: 'A' } as AppEvent);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['a:guild.create', 'b:guild.create']);
  });

  it('可取消订阅', async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    const sub = bus.subscribe('guild.create', handler as any);
    sub.unsubscribe();
    await bus.publish({ type: 'guild.create', name: 'X' } as AppEvent);
    expect(handler).not.toHaveBeenCalled();
  });
});

import type {
  DomainEvent as AppEvent,
  EventType as AppEventType,
  EventHandler,
} from '../../shared/contracts/events/index';

export interface Subscription {
  unsubscribe(): void;
}
export interface EventBus {
  publish(e: AppEvent): Promise<void>;
  subscribe<T extends AppEvent = AppEvent>(
    type: T['type'],
    handler: EventHandler<T>
  ): Subscription;
  clear(): void;
}

/** 简单内存实现：同类型 FIFO，按订阅顺序触发。 */
export class InMemoryEventBus implements EventBus {
  private handlers = new Map<AppEventType, Array<EventHandler<any>>>();

  async publish(e: AppEvent): Promise<void> {
    if (!/^[a-z]+\.[a-z]+$/.test(e.type))
      throw new Error(`Invalid event type: ${e.type}`);
    const list = this.handlers.get(e.type) || [];
    for (const h of list) await h(e);
  }

  subscribe<T extends AppEvent = AppEvent>(
    type: T['type'],
    handler: EventHandler<T>
  ): Subscription {
    const list = this.handlers.get(type) || [];
    list.push(handler as any);
    this.handlers.set(type, list as any[]);
    let active = true;
    return {
      unsubscribe: () => {
        if (!active) return;
        const arr = this.handlers.get(type) || [];
        const idx = arr.indexOf(handler as any);
        if (idx >= 0) arr.splice(idx, 1);
        this.handlers.set(type, arr as any[]);
        active = false; // typo fixed
      },
    };
  }

  clear(): void {
    this.handlers.clear();
  }
}

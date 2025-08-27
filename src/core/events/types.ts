export type AppEvent =
  | { type: 'guild.create'; name: string }
  | { type: 'guild.rename'; id: string; name: string }
  | { type: 'inventory.add'; itemId: string; qty: number };

export type AppEventType = AppEvent['type'];

export type EventHandler<T extends AppEvent = AppEvent> = (
  e: T
) => void | Promise<void>;

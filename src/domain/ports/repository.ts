import type { Guild, InventoryItem } from '../models';

export interface GuildRepository {
  create(name: string): Promise<Guild>;
  rename(id: string, name: string): Promise<Guild>;
  getById(id: string): Promise<Guild | null>;
  list(): Promise<Guild[]>;
}

export interface InventoryRepository {
  add(itemId: string, qty: number): Promise<InventoryItem>;
  get(itemId: string): Promise<InventoryItem | null>;
  all(): Promise<InventoryItem[]>;
}

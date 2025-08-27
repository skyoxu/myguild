import { randomUUID } from 'node:crypto';
import type {
  Guild,
  InventoryItem,
  GuildRepository,
  InventoryRepository,
} from '../../../shared/contracts';

export class InMemoryGuildRepo implements GuildRepository {
  private byId = new Map<string, Guild>();
  async create(name: string): Promise<Guild> {
    const g: Guild = { id: randomUUID(), name, createdAt: Date.now() };
    this.byId.set(g.id, g);
    return g;
  }
  async rename(id: string, name: string): Promise<Guild> {
    const g = this.byId.get(id);
    if (!g) throw new Error('Guild not found');
    g.name = name;
    return g;
  }
  async getById(id: string) {
    return this.byId.get(id) ?? null;
  }
  async list() {
    return Array.from(this.byId.values());
  }
}

export class InMemoryInventoryRepo implements InventoryRepository {
  private items = new Map<string, InventoryItem>();
  async add(itemId: string, qty: number): Promise<InventoryItem> {
    const it = this.items.get(itemId) ?? { itemId, qty: 0 };
    it.qty += qty;
    this.items.set(itemId, it);
    return it;
  }
  async get(itemId: string) {
    return this.items.get(itemId) ?? null;
  }
  async all() {
    return Array.from(this.items.values());
  }
}

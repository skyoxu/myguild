import { describe, it, expect } from 'vitest';
import {
  InMemoryGuildRepo,
  InMemoryInventoryRepo,
} from '../../src/infra/repo/memory/inmemory';
import type {
  GuildRepository,
  InventoryRepository,
} from '../../src/domain/ports/repository';

function guildRepoContract(factory: () => GuildRepository) {
  describe('GuildRepository Contract', () => {
    it('create -> getById', async () => {
      const repo = factory();
      const g = await repo.create('A');
      const found = await repo.getById(g.id);
      expect(found?.name).toBe('A');
    });
    it('rename persists', async () => {
      const repo = factory();
      const g = await repo.create('A');
      await repo.rename(g.id, 'B');
      const found = await repo.getById(g.id);
      expect(found?.name).toBe('B');
    });
  });
}

function inventoryRepoContract(factory: () => InventoryRepository) {
  describe('InventoryRepository Contract', () => {
    it('add -> get', async () => {
      const repo = factory();
      await repo.add('wood', 5);
      const it = await repo.get('wood');
      expect(it?.qty).toBe(5);
    });
    it('aggregate qty', async () => {
      const repo = factory();
      await repo.add('wood', 5);
      await repo.add('wood', 7);
      const it = await repo.get('wood');
      expect(it?.qty).toBe(12);
    });
  });
}

describe('05 Repository Contracts', () => {
  guildRepoContract(() => new InMemoryGuildRepo());
  inventoryRepoContract(() => new InMemoryInventoryRepo());
});

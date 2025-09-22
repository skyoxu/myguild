/**
 * Repository and UnitOfWork contract tests (ADR-0007)
 * Converted to English; removed emojis and non-ASCII output.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Repository,
  Entity,
  AggregateRoot,
  EntityNotFoundError,
  ConcurrencyError,
  RepositoryQueryParams,
  IUnitOfWork,
} from '@/shared/contracts/repos';

interface TestEntity extends Entity {
  name: string;
  value: number;
  category?: string;
}

interface TestAggregateRoot extends AggregateRoot {
  name: string;
  status: 'active' | 'inactive';
}

class InMemoryRepository<T extends Entity> implements Repository<T> {
  private readonly store = new Map<string, T>();

  async getById(id: string): Promise<T | null> {
    return this.store.get(id) ?? null;
  }

  async upsert(entity: T): Promise<void> {
    const existing = this.store.get(entity.id);
    if (existing && existing.version > entity.version) {
      throw new ConcurrencyError('TestEntity', entity.id, entity.version, existing.version);
    }
    const updated = { ...entity, version: entity.version + 1, updatedAt: new Date() } as T;
    this.store.set(entity.id, updated);
  }

  async list(params?: RepositoryQueryParams): Promise<T[]> {
    let results = Array.from(this.store.values());
    if (params?.filters) {
      results = results.filter((e: any) =>
        Object.entries(params.filters!).every(([k, v]) => e[k] === v)
      );
    }
    if (params?.sortBy) {
      const { sortBy, sortOrder } = params;
      const dir = sortOrder === 'desc' ? -1 : 1;
      results.sort((a: any, b: any) => (a[sortBy!] < b[sortBy!] ? -dir : a[sortBy!] > b[sortBy!] ? dir : 0));
    }
    if (params?.offset || params?.limit) {
      const start = params.offset ?? 0;
      const end = params.limit ? start + params.limit : undefined;
      results = results.slice(start, end);
    }
    return results;
  }

  async remove(id: string): Promise<void> {
    if (!this.store.has(id)) throw new EntityNotFoundError('TestEntity', id);
    this.store.delete(id);
  }

  async count(params?: Omit<RepositoryQueryParams, 'limit' | 'offset'>): Promise<number> {
    return (await this.list({ ...params, limit: undefined, offset: undefined })).length;
  }

  clear(): void { this.store.clear(); }
}

class InMemoryUnitOfWork implements IUnitOfWork {
  private active = false;
  private clean = new Set<AggregateRoot>();
  private dirty = new Set<AggregateRoot>();
  private created = new Set<AggregateRoot>();
  private removed = new Set<AggregateRoot>();

  async begin(): Promise<void> {
    if (this.active) throw new Error('Transaction already active');
    this.active = true;
  }
  async commit(): Promise<void> {
    if (!this.active) throw new Error('No active transaction');
    this.reset();
    this.active = false;
  }
  async rollback(): Promise<void> {
    if (!this.active) throw new Error('No active transaction');
    this.reset();
    this.active = false;
  }
  registerClean<T extends AggregateRoot>(e: T): void { this.clean.add(e); }
  registerDirty<T extends AggregateRoot>(e: T): void { this.dirty.add(e); this.clean.delete(e); }
  registerNew<T extends AggregateRoot>(e: T): void { this.created.add(e); }
  registerRemoved<T extends AggregateRoot>(e: T): void {
    this.removed.add(e); this.clean.delete(e); this.dirty.delete(e); this.created.delete(e);
  }
  hasChanges(): boolean { return !!(this.dirty.size || this.created.size || this.removed.size); }
  private reset(): void { this.clean.clear(); this.dirty.clear(); this.created.clear(); this.removed.clear(); }
}

function createTestEntity(id: string, name: string, value: number, category?: string): TestEntity {
  return { id, name, value, category, version: 1, createdAt: new Date(), updatedAt: new Date() };
}

function createTestAggregate(id: string, name: string, status: 'active' | 'inactive' = 'active'): TestAggregateRoot {
  return {
    id,
    name,
    status,
    version: 1,
    aggregateVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    domainEvents: [],
    clearEvents: vi.fn(),
    addEvent: vi.fn(),
  };
}

describe('Repository<T> contract tests', () => {
  let repository: InMemoryRepository<TestEntity>;
  beforeEach(() => { repository = new InMemoryRepository<TestEntity>(); });
  afterEach(() => { repository.clear(); });

  describe('Basic CRUD operations', () => {
    it('creates and reads an entity', async () => {
      const entity = createTestEntity('test-1', 'Test Entity', 42);
      await repository.upsert(entity);
      const got = await repository.getById('test-1');
      expect(got?.name).toBe('Test Entity');
      expect(got?.value).toBe(42);
    });

    it('updates an existing entity', async () => {
      const entity = createTestEntity('test-1', 'Original', 10);
      await repository.upsert(entity);
      await repository.upsert({ ...entity, name: 'Updated', value: 20, version: 2 });
      const got = await repository.getById('test-1');
      expect(got?.name).toBe('Updated');
      expect(got?.value).toBe(20);
    });

    it('removes an entity', async () => {
      const entity = createTestEntity('test-1', 'To Delete', 100);
      await repository.upsert(entity);
      await repository.remove('test-1');
      expect(await repository.getById('test-1')).toBeNull();
    });

    it('throws when removing a non-existing entity', async () => {
      await expect(repository.remove('non-existent')).rejects.toThrow(EntityNotFoundError);
    });

    it('getById returns null for non-existing entity', async () => {
      expect(await repository.getById('missing')).toBeNull();
    });
  });

  describe('Query and pagination', () => {
    beforeEach(async () => {
      for (const e of [
        createTestEntity('1', 'Alpha', 10, 'A'),
        createTestEntity('2', 'Beta', 20, 'B'),
        createTestEntity('3', 'Gamma', 30, 'A'),
        createTestEntity('4', 'Delta', 40, 'B'),
        createTestEntity('5', 'Epsilon', 50, 'A'),
      ]) { await repository.upsert(e); }
    });

    it('lists all entities', async () => {
      const results = await repository.list();
      expect(results).toHaveLength(5);
    });

    it('supports pagination', async () => {
      const page1 = await repository.list({ limit: 2, offset: 0 });
      const page2 = await repository.list({ limit: 2, offset: 2 });
      const page3 = await repository.list({ limit: 2, offset: 4 });
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page3).toHaveLength(1);
    });

    it('supports filtered queries', async () => {
      const a = await repository.list({ filters: { category: 'A' } });
      const b = await repository.list({ filters: { category: 'B' } });
      expect(a).toHaveLength(3);
      expect(b).toHaveLength(2);
      a.forEach(e => expect(e.category).toBe('A'));
    });

    it('supports sorting', async () => {
      const asc = await repository.list({ sortBy: 'value', sortOrder: 'asc' });
      const desc = await repository.list({ sortBy: 'value', sortOrder: 'desc' });
      expect(asc[0].value).toBe(10);
      expect(desc[0].value).toBe(50);
    });

    it('supports combined filter + sort + pagination', async () => {
      const results = await repository.list({
        filters: { category: 'A' },
        sortBy: 'value',
        sortOrder: 'desc',
        limit: 2,
        offset: 0,
      });
      expect(results).toHaveLength(2);
      expect(results[0].value).toBe(50);
      expect(results[1].value).toBe(30);
      results.forEach(e => expect(e.category).toBe('A'));
    });

    it('supports counting', async () => {
      expect(await repository.count()).toBe(5);
      expect(await repository.count({ filters: { category: 'A' } })).toBe(3);
    });
  });

  describe('Concurrency', () => {
    it('detects and rejects conflicts', async () => {
      const e = createTestEntity('test-1', 'Concurrent', 100);
      await repository.upsert(e);
      const stale = { ...e, name: 'Stale Update' };
      await expect(repository.upsert(stale as any)).rejects.toThrow(ConcurrencyError);
    });

    it('increments version correctly', async () => {
      const e = createTestEntity('test-1', 'Versioned', 1);
      await repository.upsert(e);
      const v2 = await repository.getById('test-1');
      await repository.upsert({ ...(v2 as any), name: 'Updated' });
      const v3 = await repository.getById('test-1');
      expect(v2?.version).toBeGreaterThan(1);
      expect(v3?.version).toBeGreaterThan((v2?.version ?? 1));
    });
  });
});

describe('IUnitOfWork contract tests', () => {
  let uow: InMemoryUnitOfWork;
  let agg: TestAggregateRoot;

  beforeEach(() => {
    uow = new InMemoryUnitOfWork();
    agg = createTestAggregate('agg-1', 'Test Aggregate');
  });

  describe('Transactions', () => {
    it('supports begin and commit', async () => {
      await uow.begin();
      uow.registerNew(agg);
      expect(uow.hasChanges()).toBe(true);
      await uow.commit();
      expect(uow.hasChanges()).toBe(false);
    });

    it('supports rollback', async () => {
      await uow.begin();
      uow.registerNew(agg);
      expect(uow.hasChanges()).toBe(true);
      await uow.rollback();
      expect(uow.hasChanges()).toBe(false);
    });

    it('throws when begin called twice', async () => {
      await uow.begin();
      await expect(uow.begin()).rejects.toThrow('Transaction already active');
    });

    it('throws when commit without active transaction', async () => {
      await expect(uow.commit()).rejects.toThrow('No active transaction');
    });
  });
});


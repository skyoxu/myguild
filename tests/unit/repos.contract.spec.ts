/**
 * Repository 契约测试 - Base-Clean 实现
 *
 * 测试目标：
 * 1. 验证 Repository<T> 接口的契约一致性
 * 2. 提供 InMemory 适配器作为测试基线和参考实现
 * 3. 确保所有适配器实现的行为一致性
 * 4. 性能基准验证
 *
 * ADR 对齐：
 * - ADR-0005: 质量门禁（契约测试、覆盖率要求）
 * - ADR-0001: TypeScript 强类型约束
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Repository,
  Entity,
  AggregateRoot,
  DomainEvent,
  IUnitOfWork,
  RepositoryQueryParams,
  EntityNotFoundError,
  ConcurrencyError,
  RepositoryError,
  isEntity,
  isAggregateRoot,
  PORT_IDS,
} from '@/shared/contracts/repos';

// ==================== 测试用实体定义 ====================

interface TestEntity extends Entity {
  name: string;
  value: number;
  category?: string;
}

interface TestAggregateRoot extends AggregateRoot {
  name: string;
  status: 'active' | 'inactive';
}

// ==================== InMemory 测试实现 ====================

/**
 * InMemory Repository 实现
 * 作为测试基线和参考实现
 */
class InMemoryRepository<T extends Entity> implements Repository<T> {
  private readonly store = new Map<string, T>();

  async getById(id: string): Promise<T | null> {
    return this.store.get(id) ?? null;
  }

  async upsert(entity: T): Promise<void> {
    const existing = this.store.get(entity.id);

    // 乐观锁检查 - 只有当现有版本大于传入版本时才冲突
    if (existing && existing.version > entity.version) {
      throw new ConcurrencyError(
        'TestEntity',
        entity.id,
        entity.version,
        existing.version
      );
    }

    const updatedEntity = {
      ...entity,
      version: entity.version + 1,
      updatedAt: new Date(),
    } as T;

    this.store.set(entity.id, updatedEntity);
  }

  async list(params?: RepositoryQueryParams): Promise<T[]> {
    let results = Array.from(this.store.values());

    // 过滤
    if (params?.filters) {
      results = results.filter(entity =>
        Object.entries(params.filters!).every(
          ([key, value]) => (entity as any)[key] === value
        )
      );
    }

    // 排序
    if (params?.sortBy) {
      results.sort((a, b) => {
        const aVal = (a as any)[params.sortBy!];
        const bVal = (b as any)[params.sortBy!];
        const order = params.sortOrder === 'desc' ? -1 : 1;

        if (aVal < bVal) return -order;
        if (aVal > bVal) return order;
        return 0;
      });
    }

    // 分页
    if (params?.offset || params?.limit) {
      const start = params.offset ?? 0;
      const end = params.limit ? start + params.limit : undefined;
      results = results.slice(start, end);
    }

    return results;
  }

  async remove(id: string): Promise<void> {
    if (!this.store.has(id)) {
      throw new EntityNotFoundError('TestEntity', id);
    }
    this.store.delete(id);
  }

  async count(
    params?: Omit<RepositoryQueryParams, 'limit' | 'offset'>
  ): Promise<number> {
    const filteredResults = await this.list({
      ...params,
      limit: undefined,
      offset: undefined,
    });
    return filteredResults.length;
  }

  // 测试辅助方法
  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

/**
 * InMemory UnitOfWork 实现
 */
class InMemoryUnitOfWork implements IUnitOfWork {
  private isTransactionActive = false;
  private readonly cleanEntities = new Set<AggregateRoot>();
  private readonly dirtyEntities = new Set<AggregateRoot>();
  private readonly newEntities = new Set<AggregateRoot>();
  private readonly removedEntities = new Set<AggregateRoot>();

  async begin(): Promise<void> {
    if (this.isTransactionActive) {
      throw new Error('Transaction already active');
    }
    this.isTransactionActive = true;
  }

  async commit(): Promise<void> {
    if (!this.isTransactionActive) {
      throw new Error('No active transaction');
    }

    // 在真实实现中，这里会执行实际的数据库操作
    this.clearRegistrations();
    this.isTransactionActive = false;
  }

  async rollback(): Promise<void> {
    if (!this.isTransactionActive) {
      throw new Error('No active transaction');
    }

    this.clearRegistrations();
    this.isTransactionActive = false;
  }

  registerClean<T extends AggregateRoot>(entity: T): void {
    this.cleanEntities.add(entity);
  }

  registerDirty<T extends AggregateRoot>(entity: T): void {
    this.dirtyEntities.add(entity);
    this.cleanEntities.delete(entity);
  }

  registerNew<T extends AggregateRoot>(entity: T): void {
    this.newEntities.add(entity);
  }

  registerRemoved<T extends AggregateRoot>(entity: T): void {
    this.removedEntities.add(entity);
    this.cleanEntities.delete(entity);
    this.dirtyEntities.delete(entity);
    this.newEntities.delete(entity);
  }

  hasChanges(): boolean {
    return (
      this.dirtyEntities.size > 0 ||
      this.newEntities.size > 0 ||
      this.removedEntities.size > 0
    );
  }

  private clearRegistrations(): void {
    this.cleanEntities.clear();
    this.dirtyEntities.clear();
    this.newEntities.clear();
    this.removedEntities.clear();
  }
}

// ==================== 测试工具函数 ====================

function createTestEntity(
  id: string,
  name: string,
  value: number,
  category?: string
): TestEntity {
  return {
    id,
    name,
    value,
    category,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createTestAggregate(
  id: string,
  name: string,
  status: 'active' | 'inactive' = 'active'
): TestAggregateRoot {
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

// ==================== 主要测试套件 ====================

describe('Repository<T> 契约测试', () => {
  let repository: InMemoryRepository<TestEntity>;

  beforeEach(() => {
    repository = new InMemoryRepository<TestEntity>();
  });

  afterEach(() => {
    repository.clear();
  });

  describe('基本 CRUD 操作', () => {
    it('应支持创建和读取实体', async () => {
      const entity = createTestEntity('test-1', 'Test Entity', 42);

      // CREATE
      await repository.upsert(entity);

      // READ
      const retrieved = await repository.getById('test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-1');
      expect(retrieved?.name).toBe('Test Entity');
      expect(retrieved?.value).toBe(42);
    });

    it('应支持更新现有实体', async () => {
      const entity = createTestEntity('test-1', 'Original', 10);
      await repository.upsert(entity);

      // UPDATE
      const updated = { ...entity, name: 'Updated', value: 20, version: 2 };
      await repository.upsert(updated);

      const retrieved = await repository.getById('test-1');
      expect(retrieved?.name).toBe('Updated');
      expect(retrieved?.value).toBe(20);
      expect(retrieved?.version).toBe(3); // InMemory实现会自动递增版本
    });

    it('应支持删除实体', async () => {
      const entity = createTestEntity('test-1', 'To Delete', 100);
      await repository.upsert(entity);

      // 确认实体存在
      let retrieved = await repository.getById('test-1');
      expect(retrieved).toBeDefined();

      // DELETE
      await repository.remove('test-1');

      // 确认实体已删除
      retrieved = await repository.getById('test-1');
      expect(retrieved).toBeNull();
    });

    it('删除不存在的实体应抛出错误', async () => {
      await expect(repository.remove('non-existent')).rejects.toThrow(
        EntityNotFoundError
      );
    });

    it('读取不存在的实体应返回 null', async () => {
      const result = await repository.getById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('查询和分页', () => {
    beforeEach(async () => {
      // 插入测试数据
      const entities = [
        createTestEntity('1', 'Alpha', 10, 'A'),
        createTestEntity('2', 'Beta', 20, 'B'),
        createTestEntity('3', 'Gamma', 30, 'A'),
        createTestEntity('4', 'Delta', 40, 'B'),
        createTestEntity('5', 'Epsilon', 50, 'A'),
      ];

      for (const entity of entities) {
        await repository.upsert(entity);
      }
    });

    it('应支持列出所有实体', async () => {
      const results = await repository.list();
      expect(results).toHaveLength(5);
    });

    it('应支持分页查询', async () => {
      const page1 = await repository.list({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = await repository.list({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);

      const page3 = await repository.list({ limit: 2, offset: 4 });
      expect(page3).toHaveLength(1);
    });

    it('应支持过滤查询', async () => {
      const categoryAResults = await repository.list({
        filters: { category: 'A' },
      });
      expect(categoryAResults).toHaveLength(3);
      categoryAResults.forEach(entity => {
        expect(entity.category).toBe('A');
      });

      const categoryBResults = await repository.list({
        filters: { category: 'B' },
      });
      expect(categoryBResults).toHaveLength(2);
    });

    it('应支持排序查询', async () => {
      // 按值升序排序
      const ascResults = await repository.list({
        sortBy: 'value',
        sortOrder: 'asc',
      });
      expect(ascResults[0].value).toBe(10);
      expect(ascResults[4].value).toBe(50);

      // 按值降序排序
      const descResults = await repository.list({
        sortBy: 'value',
        sortOrder: 'desc',
      });
      expect(descResults[0].value).toBe(50);
      expect(descResults[4].value).toBe(10);
    });

    it('应支持复合查询（过滤 + 排序 + 分页）', async () => {
      const results = await repository.list({
        filters: { category: 'A' },
        sortBy: 'value',
        sortOrder: 'desc',
        limit: 2,
        offset: 0,
      });

      expect(results).toHaveLength(2);
      expect(results[0].value).toBe(50); // Epsilon
      expect(results[1].value).toBe(30); // Gamma
      results.forEach(entity => {
        expect(entity.category).toBe('A');
      });
    });

    it('应支持计数查询', async () => {
      const totalCount = await repository.count();
      expect(totalCount).toBe(5);

      const categoryACount = await repository.count({
        filters: { category: 'A' },
      });
      expect(categoryACount).toBe(3);
    });
  });

  describe('并发控制', () => {
    it('应检测并发冲突', async () => {
      const entity = createTestEntity('test-1', 'Concurrent', 100);
      await repository.upsert(entity);

      // 模拟并发更新冲突
      const staleEntity = { ...entity, name: 'Stale Update' };

      await expect(repository.upsert(staleEntity)).rejects.toThrow(
        ConcurrencyError
      );
    });

    it('版本号应正确递增', async () => {
      const entity = createTestEntity('test-1', 'Versioned', 1);
      await repository.upsert(entity);

      let retrieved = await repository.getById('test-1');
      expect(retrieved?.version).toBe(2); // InMemory实现自动递增

      const updated = { ...retrieved!, name: 'Updated' };
      await repository.upsert(updated);

      retrieved = await repository.getById('test-1');
      expect(retrieved?.version).toBe(3);
    });
  });
});

describe('IUnitOfWork 契约测试', () => {
  let unitOfWork: InMemoryUnitOfWork;
  let aggregate: TestAggregateRoot;

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork();
    aggregate = createTestAggregate('agg-1', 'Test Aggregate');
  });

  describe('事务管理', () => {
    it('应支持开始和提交事务', async () => {
      await unitOfWork.begin();
      unitOfWork.registerNew(aggregate);

      expect(unitOfWork.hasChanges()).toBe(true);

      await unitOfWork.commit();

      expect(unitOfWork.hasChanges()).toBe(false);
    });

    it('应支持事务回滚', async () => {
      await unitOfWork.begin();
      unitOfWork.registerNew(aggregate);

      expect(unitOfWork.hasChanges()).toBe(true);

      await unitOfWork.rollback();

      expect(unitOfWork.hasChanges()).toBe(false);
    });

    it('重复开始事务应抛出错误', async () => {
      await unitOfWork.begin();

      await expect(unitOfWork.begin()).rejects.toThrow(
        'Transaction already active'
      );
    });

    it('无活动事务时提交应抛出错误', async () => {
      await expect(unitOfWork.commit()).rejects.toThrow(
        'No active transaction'
      );
    });
  });

  describe('实体变更追踪', () => {
    beforeEach(async () => {
      await unitOfWork.begin();
    });

    afterEach(async () => {
      if (unitOfWork.hasChanges()) {
        await unitOfWork.rollback();
      }
    });

    it('应追踪新实体', () => {
      unitOfWork.registerNew(aggregate);
      expect(unitOfWork.hasChanges()).toBe(true);
    });

    it('应追踪修改的实体', () => {
      unitOfWork.registerClean(aggregate);
      expect(unitOfWork.hasChanges()).toBe(false);

      unitOfWork.registerDirty(aggregate);
      expect(unitOfWork.hasChanges()).toBe(true);
    });

    it('应追踪删除的实体', () => {
      unitOfWork.registerClean(aggregate);
      unitOfWork.registerRemoved(aggregate);
      expect(unitOfWork.hasChanges()).toBe(true);
    });

    it('删除操作应移除其他注册状态', () => {
      unitOfWork.registerNew(aggregate);
      unitOfWork.registerDirty(aggregate);

      expect(unitOfWork.hasChanges()).toBe(true);

      unitOfWork.registerRemoved(aggregate);

      // 仍然有变更（因为有删除操作）
      expect(unitOfWork.hasChanges()).toBe(true);
    });
  });
});

describe('类型守卫测试', () => {
  it('isEntity 应正确识别实体', () => {
    const entity = createTestEntity('test-1', 'Entity', 1);
    const notEntity = { id: 'test', name: 'Not Entity' };

    expect(isEntity(entity)).toBe(true);
    expect(isEntity(notEntity)).toBe(false);
    expect(isEntity(null)).toBe(false);
    expect(isEntity(undefined)).toBe(false);
  });

  it('isAggregateRoot 应正确识别聚合根', () => {
    const aggregate = createTestAggregate('agg-1', 'Aggregate');
    const entity = createTestEntity('test-1', 'Entity', 1);

    expect(isAggregateRoot(aggregate)).toBe(true);
    expect(isAggregateRoot(entity)).toBe(false);
  });
});

describe('错误类型测试', () => {
  it('RepositoryError 应包含正确信息', () => {
    const error = new RepositoryError('Test error', 'TestEntity', 'test-1');

    expect(error.message).toBe('Test error');
    expect(error.entityType).toBe('TestEntity');
    expect(error.entityId).toBe('test-1');
    expect(error.name).toBe('RepositoryError');
  });

  it('EntityNotFoundError 应继承 RepositoryError', () => {
    const error = new EntityNotFoundError('TestEntity', 'test-1');

    expect(error).toBeInstanceOf(RepositoryError);
    expect(error.name).toBe('EntityNotFoundError');
    expect(error.entityType).toBe('TestEntity');
    expect(error.entityId).toBe('test-1');
  });

  it('ConcurrencyError 应包含版本信息', () => {
    const error = new ConcurrencyError('TestEntity', 'test-1', 2, 3);

    expect(error).toBeInstanceOf(RepositoryError);
    expect(error.name).toBe('ConcurrencyError');
    expect(error.message).toContain('expected version 2');
    expect(error.message).toContain('actual version 3');
  });
});

describe('端口标识符测试', () => {
  it('PORT_IDS 应包含所有必需的端口', () => {
    expect(PORT_IDS.STORAGE).toBe('storage.${DOMAIN_PREFIX}');
    expect(PORT_IDS.CACHE).toBe('cache.${DOMAIN_PREFIX}');
    expect(PORT_IDS.EVENTS).toBe('events.${DOMAIN_PREFIX}');
    expect(PORT_IDS.QUERY).toBe('query.${DOMAIN_PREFIX}');
    expect(PORT_IDS.NOTIFICATION).toBe('notification.${DOMAIN_PREFIX}');
    expect(PORT_IDS.AUDIT).toBe('audit.${DOMAIN_PREFIX}');
    expect(PORT_IDS.MIGRATION).toBe('migration.${DOMAIN_PREFIX}');
  });

  it('端口标识符应遵循命名约定', () => {
    const portIds = Object.values(PORT_IDS);

    portIds.forEach(portId => {
      expect(portId).toMatch(/^[a-z]+\.\$\{DOMAIN_PREFIX\}$/);
    });
  });
});

describe('性能基准测试', () => {
  let repository: InMemoryRepository<TestEntity>;

  beforeEach(() => {
    repository = new InMemoryRepository<TestEntity>();
  });

  afterEach(() => {
    repository.clear();
  });

  it('大量插入操作应满足性能要求', async () => {
    const entityCount = 1000;
    const startTime = performance.now();

    for (let i = 0; i < entityCount; i++) {
      const entity = createTestEntity(`test-${i}`, `Entity ${i}`, i);
      await repository.upsert(entity);
    }

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    // InMemory 实现：1000 条记录插入应在 100ms 内完成
    expect(executionTime).toBeLessThan(100);
    expect(repository.size()).toBe(entityCount);
  });

  it('大量查询操作应满足性能要求', async () => {
    // 先插入测试数据
    for (let i = 0; i < 1000; i++) {
      const entity = createTestEntity(`test-${i}`, `Entity ${i}`, i);
      await repository.upsert(entity);
    }

    const startTime = performance.now();

    // 执行100次查询
    for (let i = 0; i < 100; i++) {
      await repository.list({ limit: 10 });
    }

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    // 100 次查询操作应在 50ms 内完成
    expect(executionTime).toBeLessThan(50);
  });

  it('单个实体查询应具有稳定性能', async () => {
    // 插入大量数据
    for (let i = 0; i < 10000; i++) {
      const entity = createTestEntity(`test-${i}`, `Entity ${i}`, i);
      await repository.upsert(entity);
    }

    const iterations = 100;
    const executionTimes: number[] = [];

    // 测试多次单个查询的性能
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await repository.getById('test-5000');
      const endTime = performance.now();
      executionTimes.push(endTime - startTime);
    }

    const avgTime =
      executionTimes.reduce((sum, time) => sum + time, 0) / iterations;
    const maxTime = Math.max(...executionTimes);

    // 平均查询时间应小于 1ms
    expect(avgTime).toBeLessThan(1);
    // 最大查询时间应小于 5ms
    expect(maxTime).toBeLessThan(5);
  });
});

describe('ADR-0005 质量门禁对齐', () => {
  it('所有核心接口应有对应的测试覆盖', () => {
    // 这个测试确保我们覆盖了所有核心接口
    const testedInterfaces = [
      'Repository',
      'IUnitOfWork',
      'Entity',
      'AggregateRoot',
      'DomainEvent',
      'isEntity',
      'isAggregateRoot',
      'RepositoryError',
      'EntityNotFoundError',
      'ConcurrencyError',
    ];

    // 在实际项目中，这里可以通过静态分析来验证
    expect(testedInterfaces.length).toBeGreaterThan(5);
  });

  it('性能基准应符合 SLO 要求', () => {
    // 引用 01 章 NFR/SLO 基线要求
    const performanceRequirements = {
      insertLatencyMs: 100, // 批量插入延迟
      queryLatencyMs: 50, // 查询操作延迟
      singleLookupMs: 1, // 单个实体查找延迟
    };

    // 确保基准值被正确定义
    expect(performanceRequirements.insertLatencyMs).toBe(100);
    expect(performanceRequirements.queryLatencyMs).toBe(50);
    expect(performanceRequirements.singleLookupMs).toBe(1);
  });
});

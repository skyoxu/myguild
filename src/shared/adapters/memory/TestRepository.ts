/**
 * 测试专用仓库实现
 * 实现IRepository接口用于单元测试
 */

import type { IRepository } from '../../contracts/ports';
import type { Entity, Id } from '../../contracts/ports';

export class TestRepository<TEntity extends Entity, TId = Id>
  implements IRepository<TEntity, TId>
{
  private readonly store = new Map<string, TEntity>();
  private idCounter = 1;

  async findById(id: TId): Promise<TEntity | null> {
    return this.store.get(String(id)) ?? null;
  }

  async findAll(): Promise<TEntity[]> {
    return Array.from(this.store.values());
  }

  async save(
    entity: Omit<TEntity, 'id' | 'createdAt' | 'updatedAt'> | TEntity
  ): Promise<TEntity> {
    const now = new Date().toISOString();

    // 如果实体已经有ID，则直接使用，否则生成新ID
    const id =
      'id' in entity && entity.id
        ? (entity.id as TId)
        : (`test-${this.idCounter++}` as TId);

    const savedEntity = {
      ...entity,
      id,
      createdAt: ('createdAt' in entity && entity.createdAt) || now,
      updatedAt: now,
    } as TEntity;

    this.store.set(String(id), savedEntity);
    return savedEntity;
  }

  async update(id: TId, updates: Partial<TEntity>): Promise<TEntity> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Entity with id ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    } as TEntity;

    this.store.set(String(id), updated);
    return updated;
  }

  async delete(id: TId): Promise<boolean> {
    return this.store.delete(String(id));
  }

  async exists(id: TId): Promise<boolean> {
    return this.store.has(String(id));
  }

  // 测试辅助方法
  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  // 允许手动设置ID用于测试
  async saveWithId(entity: TEntity): Promise<TEntity> {
    const now = new Date().toISOString();
    const savedEntity = {
      ...entity,
      createdAt: entity.createdAt || now,
      updatedAt: now,
    } as TEntity;

    this.store.set(String(entity.id), savedEntity);
    return savedEntity;
  }
}

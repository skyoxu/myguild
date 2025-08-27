/**
 * 端口-适配器模式基础类型定义 - ADR-0007
 *
 * 提供清洁架构的端口接口和通用类型
 * 支持Repository模式和端口抽象
 */

/**
 * 通用ID类型
 */
export type Id = string | number;

/**
 * 基础实体接口
 */
export interface Entity<TId = Id> {
  readonly id: TId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * 通用端口接口
 */
export interface Port {
  readonly name: string;
  readonly version: string;
}

/**
 * 仓储模式基础接口
 */
export interface IRepository<TEntity extends Entity, TId = Id> {
  findById(id: TId): Promise<TEntity | null>;
  findAll(): Promise<TEntity[]>;
  save(
    entity: Omit<TEntity, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<TEntity>;
  update(id: TId, updates: Partial<TEntity>): Promise<TEntity>;
  delete(id: TId): Promise<boolean>;
  exists(id: TId): Promise<boolean>;
}

/**
 * 查询接口
 */
export interface Query<TResult = unknown> {
  readonly type: string;
  readonly params: Record<string, unknown>;
}

/**
 * 命令接口
 */
export interface Command<TResult = unknown> {
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

/**
 * 端口适配器接口
 */
export interface PortAdapter<TInput = unknown, TOutput = unknown> {
  readonly port: Port;
  transform(input: TInput): Promise<TOutput>;
}

/**
 * 领域服务接口
 */
export interface DomainService {
  readonly name: string;
}

/**
 * 应用服务接口
 */
export interface ApplicationService {
  readonly name: string;
}

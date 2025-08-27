/**
 * Repository Pattern Contracts - Base-Clean Implementation
 *
 * 提供通用的数据访问层接口，支持多种存储适配器。
 * 遵循六边形架构（端口适配器）模式。
 *
 * ADR 引用：
 * - ADR-0001: TypeScript 强类型约束
 * - ADR-0004: 事件总线与契约标准化
 * - ADR-0005: 质量门禁与测试策略
 */

// ==================== 基础实体接口 ====================

export interface Entity<TId = string> {
  readonly id: TId;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AggregateRoot<TId = string> extends Entity<TId> {
  readonly aggregateVersion: number;
  readonly domainEvents: DomainEvent[];

  clearEvents(): void;
  addEvent(event: DomainEvent): void;
}

// ==================== Repository 核心接口 ====================

/**
 * 通用 Repository 接口
 * 提供标准的 CRUD 操作和查询能力
 */
export interface Repository<T> {
  /**
   * 根据 ID 获取实体
   * @param id 实体唯一标识
   * @returns 实体或 null（如不存在）
   */
  getById(id: string): Promise<T | null>;

  /**
   * 插入或更新实体（幂等操作）
   * @param entity 要保存的实体
   */
  upsert(entity: T): Promise<void>;

  /**
   * 列表查询（支持分页和过滤）
   * @param params 查询参数
   */
  list(params?: RepositoryQueryParams): Promise<T[]>;

  /**
   * 删除实体
   * @param id 要删除的实体 ID
   */
  remove(id: string): Promise<void>;

  /**
   * 计数查询
   * @param params 查询参数
   */
  count(
    params?: Omit<RepositoryQueryParams, 'limit' | 'offset'>
  ): Promise<number>;
}

/**
 * Repository 查询参数
 */
export interface RepositoryQueryParams {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

// ==================== 工作单元模式 ====================

/**
 * 工作单元接口
 * 管理事务边界和变更追踪
 */
export interface IUnitOfWork {
  /**
   * 开始事务
   */
  begin(): Promise<void>;

  /**
   * 提交事务
   */
  commit(): Promise<void>;

  /**
   * 回滚事务
   */
  rollback(): Promise<void>;

  /**
   * 注册干净状态的聚合根
   */
  registerClean<T extends AggregateRoot>(entity: T): void;

  /**
   * 注册已修改的聚合根
   */
  registerDirty<T extends AggregateRoot>(entity: T): void;

  /**
   * 注册新创建的聚合根
   */
  registerNew<T extends AggregateRoot>(entity: T): void;

  /**
   * 注册待删除的聚合根
   */
  registerRemoved<T extends AggregateRoot>(entity: T): void;

  /**
   * 检查是否有待提交的变更
   */
  hasChanges(): boolean;
}

// ==================== 端口标识符 ====================

/**
 * 端口标识符常量
 * 用于依赖注入和适配器注册
 */
export const PORT_IDS = {
  // 存储端口
  STORAGE: 'storage.${DOMAIN_PREFIX}',
  CACHE: 'cache.${DOMAIN_PREFIX}',

  // 事件端口
  EVENTS: 'events.${DOMAIN_PREFIX}',

  // 查询端口
  QUERY: 'query.${DOMAIN_PREFIX}',

  // 通知端口
  NOTIFICATION: 'notification.${DOMAIN_PREFIX}',

  // 审计端口
  AUDIT: 'audit.${DOMAIN_PREFIX}',

  // 迁移端口
  MIGRATION: 'migration.${DOMAIN_PREFIX}',
} as const;

export type PortId = (typeof PORT_IDS)[keyof typeof PORT_IDS];

// ==================== 领域事件 ====================

/**
 * 领域事件接口
 * 兼容 CloudEvents 1.0 标准
 */
export interface DomainEvent {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly timestamp: Date;
  readonly data: unknown;
  readonly metadata?: DomainEventMetadata;
}

export interface DomainEventMetadata {
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly userId?: string;
  readonly source?: string;
  readonly traceId?: string;
}

// ==================== 存储适配器接口 ====================

/**
 * 存储适配器工厂接口
 */
export interface StorageAdapterFactory {
  createRepository<T extends Entity>(
    entityType: string,
    options?: StorageOptions
  ): Repository<T>;

  createUnitOfWork(): IUnitOfWork;

  /**
   * 健康检查
   */
  healthCheck(): Promise<StorageHealthStatus>;
}

export interface StorageOptions {
  readonly connectionString?: string;
  readonly timeout?: number;
  readonly retryPolicy?: RetryPolicy;
  readonly consistencyLevel?: ConsistencyLevel;
}

export interface StorageHealthStatus {
  readonly isHealthy: boolean;
  readonly latencyMs: number;
  readonly details?: Record<string, unknown>;
}

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly backoffMultiplier?: number;
}

export enum ConsistencyLevel {
  STRONG = 'strong',
  EVENTUAL = 'eventual',
  SESSION = 'session',
}

// ==================== 迁移接口 ====================

/**
 * 数据库迁移接口
 */
export interface Migration {
  readonly version: string;
  readonly description: string;
  readonly timestamp: Date;

  /**
   * 执行向前迁移
   */
  up(): Promise<void>;

  /**
   * 执行回滚迁移
   */
  down(): Promise<void>;

  /**
   * 验证迁移完整性
   */
  validate(): Promise<boolean>;
}

export interface MigrationRunner {
  /**
   * 运行所有待执行的迁移
   */
  runMigrations(migrations: Migration[]): Promise<void>;

  /**
   * 回滚到指定版本
   */
  rollbackTo(version: string): Promise<void>;

  /**
   * 获取当前数据库版本
   */
  getCurrentVersion(): Promise<string>;

  /**
   * 获取迁移历史
   */
  getMigrationHistory(): Promise<MigrationRecord[]>;
}

export interface MigrationRecord {
  readonly version: string;
  readonly description: string;
  readonly appliedAt: Date;
  readonly executionTimeMs: number;
  readonly checksum: string;
}

// ==================== 实体序列化 ====================

/**
 * 实体序列化器接口
 */
export interface EntitySerializer<T> {
  serialize(entity: T): Record<string, unknown>;
  deserialize(data: Record<string, unknown>): T;
  getSchemaVersion(): string;
}

// ==================== 审计日志 ====================

/**
 * 审计日志接口
 */
export interface AuditLogger {
  logEntry(entry: AuditEntry): Promise<void>;
  queryEntries(query: AuditQuery): Promise<AuditEntry[]>;
}

export interface AuditEntry {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly operation: 'CREATE' | 'UPDATE' | 'DELETE';
  readonly userId?: string;
  readonly timestamp: Date;
  readonly oldValues?: Record<string, unknown>;
  readonly newValues?: Record<string, unknown>;
  readonly metadata: AuditMetadata;
}

export interface AuditMetadata {
  readonly source: string;
  readonly traceId?: string;
  readonly sessionId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  userId?: string;
  operation?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

// ==================== 类型守卫 ====================

/**
 * 类型守卫函数
 */
export function isEntity(_value: unknown): value is Entity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'version' in value &&
    'createdAt' in value &&
    'updatedAt' in value
  );
}

export function isAggregateRoot(_value: unknown): value is AggregateRoot {
  return (
    isEntity(value) &&
    'aggregateVersion' in value &&
    'domainEvents' in value &&
    'clearEvents' in value &&
    'addEvent' in value
  );
}

// ==================== 错误类型 ====================

/**
 * Repository 相关错误
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly entityType?: string,
    public readonly entityId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class EntityNotFoundError extends RepositoryError {
  constructor(entityType: string, entityId: string) {
    super(`Entity not found: ${entityType}#${entityId}`, entityType, entityId);
    this.name = 'EntityNotFoundError';
  }
}

export class ConcurrencyError extends RepositoryError {
  constructor(
    entityType: string,
    entityId: string,
    expectedVersion: number,
    actualVersion: number
  ) {
    super(
      `Concurrency conflict: ${entityType}#${entityId}, expected version ${expectedVersion}, actual version ${actualVersion}`,
      entityType,
      entityId
    );
    this.name = 'ConcurrencyError';
  }
}

export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly version: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

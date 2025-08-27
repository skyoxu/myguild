/**
 * 存储端口定义 - 数据持久化抽象
 * 支持多种存储策略的统一接口
 */

/**
 * 存储操作结果
 */
export interface StorageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: StorageMetadata;
}

/**
 * 存储元数据
 */
export interface StorageMetadata {
  size: number;
  createdAt: Date;
  updatedAt: Date;
  version: string;
  checksum?: string;
}

/**
 * 存储查询选项
 */
export interface StorageQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

/**
 * 事务操作接口
 */
export interface StorageTransaction {
  readonly id: string;

  /**
   * 在事务中执行操作
   */
  execute<T>(operation: (tx: StorageTransaction) => Promise<T>): Promise<T>;

  /**
   * 提交事务
   */
  commit(): Promise<void>;

  /**
   * 回滚事务
   */
  rollback(): Promise<void>;

  /**
   * 在事务中存储数据
   */
  set(key: string, value: unknown): Promise<StorageResult<void>>;

  /**
   * 在事务中获取数据
   */
  get<T>(key: string): Promise<StorageResult<T>>;

  /**
   * 在事务中删除数据
   */
  delete(key: string): Promise<StorageResult<void>>;
}

/**
 * 主存储端口接口
 */
export interface StoragePort {
  /**
   * 存储数据
   */
  set(key: string, value: unknown): Promise<StorageResult<void>>;

  /**
   * 获取数据
   */
  get<T>(key: string): Promise<StorageResult<T>>;

  /**
   * 检查键是否存在
   */
  has(key: string): Promise<boolean>;

  /**
   * 删除数据
   */
  delete(key: string): Promise<StorageResult<void>>;

  /**
   * 清空所有数据
   */
  clear(): Promise<StorageResult<void>>;

  /**
   * 获取所有键
   */
  keys(pattern?: string): Promise<string[]>;

  /**
   * 获取存储使用统计
   */
  getStats(): Promise<StorageStats>;

  /**
   * 压缩存储空间
   */
  compact(): Promise<StorageResult<void>>;

  /**
   * 创建事务
   */
  transaction(): Promise<StorageTransaction>;

  /**
   * 批量操作
   */
  batch(operations: StorageOperation[]): Promise<StorageResult<unknown>[]>;
}

/**
 * 结构化查询端口
 */
export interface QueryableStoragePort extends StoragePort {
  /**
   * 查询数据
   */
  query<T>(
    collection: string,
    options?: StorageQueryOptions
  ): Promise<StorageResult<T[]>>;

  /**
   * 创建索引
   */
  createIndex(
    collection: string,
    field: string,
    options?: IndexOptions
  ): Promise<StorageResult<void>>;

  /**
   * 删除索引
   */
  dropIndex(
    collection: string,
    indexName: string
  ): Promise<StorageResult<void>>;

  /**
   * 插入文档
   */
  insert<T>(collection: string, document: T): Promise<StorageResult<string>>;

  /**
   * 更新文档
   */
  update<T>(
    collection: string,
    id: string,
    document: Partial<T>
  ): Promise<StorageResult<void>>;

  /**
   * 删除文档
   */
  remove(collection: string, id: string): Promise<StorageResult<void>>;

  /**
   * 查找单个文档
   */
  findById<T>(collection: string, id: string): Promise<StorageResult<T>>;

  /**
   * 查找多个文档
   */
  find<T>(
    collection: string,
    query: QueryFilter,
    options?: StorageQueryOptions
  ): Promise<StorageResult<T[]>>;

  /**
   * 计数文档
   */
  count(
    collection: string,
    query?: QueryFilter
  ): Promise<StorageResult<number>>;
}

/**
 * 缓存存储端口
 */
export interface CacheStoragePort {
  /**
   * 设置缓存（带TTL）
   */
  setCache(
    key: string,
    value: unknown,
    ttlSeconds?: number
  ): Promise<StorageResult<void>>;

  /**
   * 获取缓存
   */
  getCache<T>(key: string): Promise<StorageResult<T>>;

  /**
   * 删除缓存
   */
  deleteCache(key: string): Promise<StorageResult<void>>;

  /**
   * 刷新缓存TTL
   */
  refreshCache(key: string, ttlSeconds: number): Promise<StorageResult<void>>;

  /**
   * 清空所有缓存
   */
  clearCache(): Promise<StorageResult<void>>;

  /**
   * 获取缓存统计
   */
  getCacheStats(): Promise<CacheStats>;
}

/**
 * 备份恢复端口
 */
export interface BackupStoragePort {
  /**
   * 创建备份
   */
  createBackup(backupId: string): Promise<StorageResult<BackupInfo>>;

  /**
   * 恢复备份
   */
  restoreBackup(backupId: string): Promise<StorageResult<void>>;

  /**
   * 列出所有备份
   */
  listBackups(): Promise<StorageResult<BackupInfo[]>>;

  /**
   * 删除备份
   */
  deleteBackup(backupId: string): Promise<StorageResult<void>>;

  /**
   * 验证备份完整性
   */
  verifyBackup(backupId: string): Promise<StorageResult<boolean>>;
}

/**
 * 存储操作类型
 */
export type StorageOperation =
  | { type: 'set'; key: string; value: unknown }
  | { type: 'get'; key: string }
  | { type: 'delete'; key: string }
  | { type: 'clear' };

/**
 * 索引选项
 */
export interface IndexOptions {
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
}

/**
 * 查询过滤器
 */
export interface QueryFilter {
  [field: string]:
    | unknown
    | {
        $eq?: unknown;
        $ne?: unknown;
        $gt?: unknown;
        $gte?: unknown;
        $lt?: unknown;
        $lte?: unknown;
        $in?: unknown[];
        $nin?: unknown[];
      }
    | { $regex?: string; $options?: string }
    | { $exists?: boolean }
    | { $and?: QueryFilter[] }
    | { $or?: QueryFilter[] };
}

/**
 * 存储统计信息
 */
export interface StorageStats {
  totalSize: number;
  usedSize: number;
  freeSize: number;
  keyCount: number;
  collections?: CollectionStats[];
  lastCompacted?: Date;
  indexCount?: number;
}

/**
 * 集合统计信息
 */
export interface CollectionStats {
  name: string;
  documentCount: number;
  size: number;
  indexes: string[];
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRatio: number;
  evictionCount: number;
  size: number;
  maxSize: number;
}

/**
 * 备份信息
 */
export interface BackupInfo {
  id: string;
  createdAt: Date;
  size: number;
  checksum: string;
  metadata: Record<string, unknown>;
  compressed: boolean;
  version: string;
}

/**
 * 游戏存储专用接口
 */
export interface GameStoragePort
  extends QueryableStoragePort,
    CacheStoragePort,
    BackupStoragePort {
  /**
   * 保存游戏存档
   */
  saveGame(saveId: string, gameState: unknown): Promise<StorageResult<void>>;

  /**
   * 加载游戏存档
   */
  loadGame<T>(saveId: string): Promise<StorageResult<T>>;

  /**
   * 获取所有存档
   */
  getSaveList(): Promise<StorageResult<SaveInfo[]>>;

  /**
   * 删除游戏存档
   */
  deleteSave(saveId: string): Promise<StorageResult<void>>;

  /**
   * 保存用户设置
   */
  saveSettings(settings: unknown): Promise<StorageResult<void>>;

  /**
   * 加载用户设置
   */
  loadSettings<T>(): Promise<StorageResult<T>>;

  /**
   * 保存游戏配置
   */
  saveConfig(config: unknown): Promise<StorageResult<void>>;

  /**
   * 加载游戏配置
   */
  loadConfig<T>(): Promise<StorageResult<T>>;

  /**
   * 保存成就数据
   */
  saveAchievements(achievements: unknown): Promise<StorageResult<void>>;

  /**
   * 加载成就数据
   */
  loadAchievements<T>(): Promise<StorageResult<T>>;

  /**
   * 保存统计数据
   */
  saveStatistics(stats: unknown): Promise<StorageResult<void>>;

  /**
   * 加载统计数据
   */
  loadStatistics<T>(): Promise<StorageResult<T>>;
}

/**
 * 存档信息
 */
export interface SaveInfo {
  id: string;
  name: string;
  level: number;
  score: number;
  playTime: number;
  createdAt: Date;
  updatedAt: Date;
  thumbnail?: string;
  metadata: Record<string, unknown>;
}

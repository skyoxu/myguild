/**
 * SQLite配置管理抽象层
 * 基于 CH05 数据模型与存储端口架构
 *
 * 功能：
 * - 环境感知的SQLite配置管理
 * - WAL模式、同步级别、缓存大小的智能配置
 * - 配置验证和性能调优
 * - 故障排除和健康检查
 */

import type { Database } from 'better-sqlite3';

// ============================================================================
// 配置类型定义
// ============================================================================

export type Environment = 'development' | 'test' | 'staging' | 'production';

export interface SqliteConfig {
  /** 日志模式 */
  journal_mode: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
  /** 同步级别 */
  synchronous: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  /** 缓存大小（页数，负数表示KB） */
  cache_size: number;
  /** 外键约束 */
  foreign_keys: 'ON' | 'OFF';
  /** 忙碌超时（毫秒） */
  busy_timeout: number;
  /** WAL自动检查点（页数） */
  wal_autocheckpoint?: number;
  /** 内存映射大小（字节） */
  mmap_size?: number;
  /** 临时存储位置 */
  temp_store?: 'DEFAULT' | 'FILE' | 'MEMORY';
  /** 页面大小（字节） */
  page_size?: number;
}

export interface ConfigProfile {
  name: string;
  description: string;
  config: SqliteConfig;
  recommendedFor: Environment[];
  memoryUsageMB: number;
  performanceRating: 'low' | 'medium' | 'high' | 'ultra';
}

// ============================================================================
// 预定义配置档案
// ============================================================================

export const CONFIG_PROFILES: Record<string, ConfigProfile> = {
  development: {
    name: 'Development',
    description: '开发环境：平衡性能和调试便利性',
    config: {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: 10000, // ~40MB
      foreign_keys: 'ON',
      busy_timeout: 5000,
      wal_autocheckpoint: 1000,
      mmap_size: 134217728, // 128MB
      temp_store: 'MEMORY',
    },
    recommendedFor: ['development'],
    memoryUsageMB: 40,
    performanceRating: 'medium',
  },

  test: {
    name: 'Test',
    description: '测试环境：快速、隔离、可重现',
    config: {
      journal_mode: 'MEMORY',
      synchronous: 'OFF',
      cache_size: 5000, // ~20MB
      foreign_keys: 'ON',
      busy_timeout: 1000,
      mmap_size: 0, // 禁用内存映射，确保测试隔离
      temp_store: 'MEMORY',
    },
    recommendedFor: ['test'],
    memoryUsageMB: 20,
    performanceRating: 'high',
  },

  staging: {
    name: 'Staging',
    description: '预生产环境：接近生产配置，保持调试能力',
    config: {
      journal_mode: 'WAL',
      synchronous: 'FULL',
      cache_size: 25000, // ~100MB
      foreign_keys: 'ON',
      busy_timeout: 10000,
      wal_autocheckpoint: 1000,
      mmap_size: 268435456, // 256MB
      temp_store: 'DEFAULT',
    },
    recommendedFor: ['staging'],
    memoryUsageMB: 100,
    performanceRating: 'high',
  },

  production: {
    name: 'Production',
    description: '生产环境：最大数据安全性和性能',
    config: {
      journal_mode: 'WAL',
      synchronous: 'FULL',
      cache_size: 50000, // ~200MB
      foreign_keys: 'ON',
      busy_timeout: 30000,
      wal_autocheckpoint: 1000,
      mmap_size: 1073741824, // 1GB
      temp_store: 'DEFAULT',
      page_size: 4096,
    },
    recommendedFor: ['production'],
    memoryUsageMB: 200,
    performanceRating: 'ultra',
  },

  lowMemory: {
    name: 'Low Memory',
    description: '低内存环境：最小内存占用',
    config: {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: 2000, // ~8MB
      foreign_keys: 'ON',
      busy_timeout: 5000,
      wal_autocheckpoint: 500,
      mmap_size: 67108864, // 64MB
      temp_store: 'FILE',
    },
    recommendedFor: ['development', 'test'],
    memoryUsageMB: 8,
    performanceRating: 'low',
  },

  highPerformance: {
    name: 'High Performance',
    description: '高性能：最大化读写性能',
    config: {
      journal_mode: 'WAL',
      synchronous: 'NORMAL', // 牺牲部分安全性换取性能
      cache_size: 100000, // ~400MB
      foreign_keys: 'ON',
      busy_timeout: 15000,
      wal_autocheckpoint: 10000, // 减少检查点频率
      mmap_size: 2147483648, // 2GB
      temp_store: 'MEMORY',
    },
    recommendedFor: ['production'],
    memoryUsageMB: 400,
    performanceRating: 'ultra',
  },
};

// ============================================================================
// SQLite配置管理器
// ============================================================================

export class SqliteConfigManager {
  private currentConfig: SqliteConfig | null = null;
  private environment: Environment;
  private customOverrides: Partial<SqliteConfig> = {};

  constructor(environment: Environment = 'development') {
    this.environment = environment;

    // 从环境变量加载自定义覆盖
    this.loadEnvironmentOverrides();
  }

  /**
   * 获取推荐配置
   */
  getRecommendedConfig(): SqliteConfig {
    const profile = CONFIG_PROFILES[this.environment];
    if (!profile) {
      throw new Error(
        `No configuration profile found for environment: ${this.environment}`
      );
    }

    // 应用自定义覆盖
    return { ...profile.config, ...this.customOverrides };
  }

  /**
   * 根据系统资源智能选择配置
   */
  getAdaptiveConfig(): SqliteConfig {
    const availableMemoryMB = this.getAvailableMemoryMB();

    // 根据可用内存选择合适的配置档案
    let selectedProfile: ConfigProfile;

    if (availableMemoryMB < 100) {
      selectedProfile = CONFIG_PROFILES.lowMemory;
    } else if (availableMemoryMB > 1000) {
      selectedProfile = CONFIG_PROFILES.highPerformance;
    } else {
      selectedProfile =
        CONFIG_PROFILES[this.environment] || CONFIG_PROFILES.development;
    }

    console.log(
      `📊 Selected SQLite profile: ${selectedProfile.name} (Available Memory: ${availableMemoryMB}MB)`
    );

    return { ...selectedProfile.config, ...this.customOverrides };
  }

  /**
   * 应用配置到数据库
   */
  async applyConfig(db: Database, config?: SqliteConfig): Promise<void> {
    const targetConfig = config || this.getAdaptiveConfig();
    this.currentConfig = targetConfig;

    console.log('🔧 Applying SQLite configuration...');

    try {
      // 应用PRAGMA设置
      for (const [pragma, value] of Object.entries(targetConfig)) {
        if (value !== undefined) {
          const sql = `PRAGMA ${pragma} = ${value}`;
          db.exec(sql);
          console.log(`  ✅ ${pragma} = ${value}`);
        }
      }

      // 验证关键配置
      await this.validateConfiguration(db);

      console.log('✅ SQLite configuration applied successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to apply SQLite configuration: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取配置建议
   */
  getConfigurationAdvice(): string[] {
    const advice: string[] = [];

    if (this.environment === 'production') {
      advice.push('✅ 生产环境已启用完全同步模式，确保数据安全性');
      advice.push('📈 建议定期监控WAL文件大小和检查点频率');
      advice.push('💾 大缓存配置已启用，确保服务器有足够内存');
    }

    if (this.environment === 'development') {
      advice.push('🔧 开发环境已优化调试体验，外键约束已启用');
      advice.push('⚡ 使用普通同步模式平衡性能和安全性');
    }

    if (this.environment === 'test') {
      advice.push('🧪 测试环境使用内存日志模式，提供最快启动速度');
      advice.push('🔄 每次测试运行都会重置数据库状态');
    }

    return advice;
  }

  /**
   * 健康检查
   */
  async healthCheck(db: Database): Promise<{
    status: 'healthy' | 'warning' | 'error';
    issues: string[];
    metrics: Record<string, any>;
  }> {
    const issues: string[] = [];
    const metrics: Record<string, any> = {};

    try {
      // 检查WAL文件大小
      const walInfo = db.pragma('wal_checkpoint(PASSIVE)');
      if (Array.isArray(walInfo) && walInfo[0]) {
        metrics.walPages = walInfo[0][1];
        metrics.walCheckpointedPages = walInfo[0][2];

        if (walInfo[0][1] > 10000) {
          issues.push('WAL文件过大，建议手动执行CHECKPOINT');
        }
      }

      // 检查缓存命中率
      const cacheInfo = db.pragma('cache_spill(-1)');
      metrics.cacheSpill = cacheInfo;

      // 检查数据库完整性（采样检查）
      const integrityCheck = db.pragma('quick_check');
      if (integrityCheck[0] !== 'ok') {
        issues.push(`数据库完整性检查失败: ${integrityCheck[0]}`);
      }

      // 检查外键一致性
      const foreignKeyCheck = db.pragma('foreign_key_check');
      if (foreignKeyCheck.length > 0) {
        issues.push(`外键约束违规: ${foreignKeyCheck.length} 个问题`);
      }

      metrics.pageCount = db.pragma('page_count')[0];
      metrics.pageSize = db.pragma('page_size')[0];
      metrics.freePages = db.pragma('freelist_count')[0];

      const status =
        issues.length === 0
          ? 'healthy'
          : issues.some(i => i.includes('完整性') || i.includes('外键'))
            ? 'error'
            : 'warning';

      return { status, issues, metrics };
    } catch (error) {
      return {
        status: 'error',
        issues: [
          `健康检查失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        metrics: {},
      };
    }
  }

  /**
   * 设置自定义配置覆盖
   */
  setConfigOverride(overrides: Partial<SqliteConfig>): void {
    this.customOverrides = { ...this.customOverrides, ...overrides };
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig(): SqliteConfig | null {
    return this.currentConfig;
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private loadEnvironmentOverrides(): void {
    // 从环境变量加载配置覆盖
    const envOverrides: Partial<SqliteConfig> = {};

    if (process.env.SQLITE_CACHE_SIZE) {
      envOverrides.cache_size = Number(process.env.SQLITE_CACHE_SIZE);
    }

    if (process.env.SQLITE_BUSY_TIMEOUT) {
      envOverrides.busy_timeout = Number(process.env.SQLITE_BUSY_TIMEOUT);
    }

    if (process.env.SQLITE_SYNCHRONOUS) {
      envOverrides.synchronous = process.env.SQLITE_SYNCHRONOUS as any;
    }

    if (process.env.SQLITE_WAL_AUTOCHECKPOINT) {
      envOverrides.wal_autocheckpoint = Number(
        process.env.SQLITE_WAL_AUTOCHECKPOINT
      );
    }

    this.customOverrides = envOverrides;

    if (Object.keys(envOverrides).length > 0) {
      console.log(
        '🔧 Loaded SQLite config overrides from environment variables:',
        envOverrides
      );
    }
  }

  private getAvailableMemoryMB(): number {
    try {
      // Node.js环境
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        const totalMB = (memUsage.heapTotal + memUsage.external) / 1024 / 1024;
        return Math.max(100, 2048 - totalMB); // 假设系统有2GB可用内存
      }

      // 浏览器环境
      if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
        return ((navigator as any).deviceMemory || 4) * 1024; // GB转MB
      }

      // 默认假设有512MB可用内存
      return 512;
    } catch {
      return 512;
    }
  }

  private async validateConfiguration(db: Database): Promise<void> {
    // 验证WAL模式是否生效
    const journalMode = db.pragma('journal_mode')[0];
    if (this.currentConfig?.journal_mode === 'WAL' && journalMode !== 'wal') {
      throw new Error(
        `Failed to enable WAL mode, current mode: ${journalMode}`
      );
    }

    // 验证外键约束
    const foreignKeys = db.pragma('foreign_keys')[0];
    if (this.currentConfig?.foreign_keys === 'ON' && foreignKeys !== 1) {
      console.warn('⚠️  Foreign key constraints are not enabled');
    }

    // 验证缓存大小
    const cacheSize = db.pragma('cache_size')[0];
    if (Math.abs(cacheSize) !== Math.abs(this.currentConfig?.cache_size || 0)) {
      console.warn(
        `⚠️  Cache size mismatch: expected ${this.currentConfig?.cache_size}, got ${cacheSize}`
      );
    }
  }
}

// ============================================================================
// 导出工厂函数和实用工具
// ============================================================================

/**
 * 创建配置管理器
 */
export function createConfigManager(
  environment?: Environment
): SqliteConfigManager {
  const env =
    environment || (process.env.NODE_ENV as Environment) || 'development';
  return new SqliteConfigManager(env);
}

/**
 * 快速配置数据库（便捷函数）
 */
export async function quickSetupDatabase(
  db: Database,
  environment?: Environment,
  customConfig?: Partial<SqliteConfig>
): Promise<SqliteConfigManager> {
  const manager = createConfigManager(environment);

  if (customConfig) {
    manager.setConfigOverride(customConfig);
  }

  await manager.applyConfig(db);

  // 输出配置建议
  const advice = manager.getConfigurationAdvice();
  if (advice.length > 0) {
    console.log('\n💡 Configuration advice:');
    advice.forEach(tip => console.log(`  ${tip}`));
  }

  return manager;
}

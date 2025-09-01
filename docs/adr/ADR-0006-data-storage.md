---
ADR-ID: ADR-0006
title: SQLite数据存储策略 - WAL模式与性能优化
status: Accepted
decision-time: '2025-08-17'
deciders: [架构团队, 数据团队]
archRefs: [CH05, CH06, CH011]
verification:
  - path: src/shared/storage/sqlite/init.ts
    assert: journal_mode=WAL and wal_autocheckpoint configured
  - path: scripts/db/wal-checkpoint.mjs
    assert: Checkpoint runs when WAL exceeds N pages or on schedule
  - path: scripts/db/backup.mjs
    assert: Consistent backup via VACUUM INTO / Online Backup completes
  - path: tests/unit/db/migrations.spec.ts
    assert: Migrations apply and rollback successfully
impact-scope:
  - src/shared/db/
  - electron/db/
  - scripts/db-migration.mjs
tech-tags:
  - sqlite
  - wal
  - database
  - performance
  - storage
depends-on: []
depended-by: []
test-coverage: tests/unit/adr-0006.spec.ts
monitoring-metrics:
  - implementation_coverage
  - compliance_rate
executable-deliverables:
  - src/main/db/init.ts
  - scripts/db-checkpoint.mjs
  - tests/unit/db/sqlite-wal.spec.ts
supersedes: []
---

# ADR-0006: 数据存储与持久化策略

## Context and Problem Statement

Electron桌面游戏应用需要可靠的本地数据存储方案，支持游戏存档、用户配置、成就数据、游戏统计等多种数据类型。需要平衡性能、可靠性、便携性和开发复杂度，同时确保数据完整性和支持高并发读写操作。

## Decision Drivers

- 需要高性能的本地数据存储，支持频繁的读写操作
- 需要数据完整性保证，防止游戏数据丢失或损坏
- 需要支持事务操作，确保数据一致性
- 需要跨平台兼容性（Windows/macOS/Linux）
- 需要轻量级解决方案，不依赖外部数据库服务
- 需要支持数据备份和恢复机制
- 需要支持数据迁移和版本升级

## Considered Options

- **SQLite + WAL模式** (选择方案)
- **LevelDB + 自定义备份**
- **IndexedDB + 文件系统备份**
- **JSON文件 + 文件锁机制**
- **Dexie.js + 结构化存储**

## Decision Outcome

选择的方案：**SQLite + WAL（Write-Ahead Logging）模式**

### SQLite WAL模式核心配置

**数据库连接配置**：

```typescript
// src/shared/database/sqlite-manager.ts
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

export class SQLiteManager {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    // 数据库文件路径
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'game-data.db');

    // 初始化数据库连接
    this.db = new Database(this.dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    });

    // 启用WAL模式和性能优化
    this.enableWALMode();
    this.configureOptimizations();
  }

  private enableWALMode(): void {
    // 启用WAL（Write-Ahead Logging）模式
    this.db.pragma('journal_mode = WAL');

    // 同步模式配置
    this.db.pragma('synchronous = NORMAL'); // 平衡性能和安全性

    // WAL检查点配置
    this.db.pragma('wal_autocheckpoint = 1000'); // 1000页后自动检查点

    // 缓存大小配置（16MB）
    this.db.pragma('cache_size = -16000');

    // 内存映射大小（256MB）
    this.db.pragma('mmap_size = 268435456');

    // 临时存储在内存中
    this.db.pragma('temp_store = MEMORY');
  }

  private configureOptimizations(): void {
    // 启用外键约束
    this.db.pragma('foreign_keys = ON');

    // 启用递归触发器
    this.db.pragma('recursive_triggers = ON');

    // 设置忙等待超时（5秒）
    this.db.pragma('busy_timeout = 5000');
  }

  // WAL检查点管理
  public performWALCheckpoint(): void {
    try {
      const result = this.db.pragma('wal_checkpoint(TRUNCATE)');
      console.log('WAL checkpoint completed:', result);
    } catch (error) {
      console.error('WAL checkpoint failed:', error);
    }
  }

  // 定期维护任务
  public performMaintenance(): void {
    try {
      // 执行WAL检查点
      this.performWALCheckpoint();

      // 优化数据库（重建索引和统计信息）
      this.db.pragma('optimize');

      // 分析表统计信息
      this.db.pragma('analysis_limit = 1000');
      this.db.pragma('analyze');
    } catch (error) {
      console.error('Database maintenance failed:', error);
    }
  }
}
```

### 数据模型与Schema管理

**核心数据表设计**：

```sql
-- 游戏存档表
CREATE TABLE IF NOT EXISTS game_saves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_name TEXT NOT NULL UNIQUE,
  player_data JSON NOT NULL,
  game_state JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  checksum TEXT NOT NULL,
  version INTEGER DEFAULT 1
);

-- 用户配置表
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  data_type TEXT CHECK(data_type IN ('string', 'number', 'boolean', 'object')) DEFAULT 'string',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, key)
);

-- 游戏统计表
CREATE TABLE IF NOT EXISTS game_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_id TEXT,
  INDEX idx_player_metric (player_id, metric_name),
  INDEX idx_recorded_at (recorded_at)
);

-- 成就数据表
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  achievement_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_url TEXT,
  points INTEGER DEFAULT 0,
  unlocked_at DATETIME,
  progress REAL DEFAULT 0.0,
  metadata JSON
);

-- 数据迁移版本表
CREATE TABLE IF NOT EXISTS schema_versions (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  description TEXT NOT NULL
);
```

**Repository模式数据访问层**：

```typescript
// src/shared/database/repositories/game-save-repository.ts
import { SQLiteManager } from '../sqlite-manager';
import { createHash } from 'crypto';

export interface GameSave {
  id?: number;
  saveName: string;
  playerData: any;
  gameState: any;
  createdAt?: Date;
  updatedAt?: Date;
  checksum: string;
  version: number;
}

export class GameSaveRepository {
  constructor(private dbManager: SQLiteManager) {}

  async createSave(
    saveData: Omit<GameSave, 'id' | 'createdAt' | 'updatedAt' | 'checksum'>
  ): Promise<GameSave> {
    const db = this.dbManager.getDatabase();

    // 计算数据校验和
    const dataString = JSON.stringify({
      playerData: saveData.playerData,
      gameState: saveData.gameState,
    });
    const checksum = createHash('sha256').update(dataString).digest('hex');

    const stmt = db.prepare(`
      INSERT INTO game_saves (save_name, player_data, game_state, checksum, version)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      saveData.saveName,
      JSON.stringify(saveData.playerData),
      JSON.stringify(saveData.gameState),
      checksum,
      saveData.version
    );

    return this.findById(result.lastInsertRowid as number);
  }

  async updateSave(id: number, saveData: Partial<GameSave>): Promise<GameSave> {
    const db = this.dbManager.getDatabase();

    // 使用事务确保数据一致性
    const transaction = db.transaction(() => {
      const existing = this.findById(id);
      if (!existing) {
        throw new Error(`Game save with id ${id} not found`);
      }

      const mergedData = { ...existing, ...saveData };
      const dataString = JSON.stringify({
        playerData: mergedData.playerData,
        gameState: mergedData.gameState,
      });
      const checksum = createHash('sha256').update(dataString).digest('hex');

      const stmt = db.prepare(`
        UPDATE game_saves 
        SET player_data = ?, game_state = ?, checksum = ?, version = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        JSON.stringify(mergedData.playerData),
        JSON.stringify(mergedData.gameState),
        checksum,
        mergedData.version,
        id
      );
    });

    transaction();
    return this.findById(id);
  }

  findById(id: number): GameSave | null {
    const db = this.dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM game_saves WHERE id = ?');
    const row = stmt.get(id);

    if (!row) return null;

    return {
      id: row.id,
      saveName: row.save_name,
      playerData: JSON.parse(row.player_data),
      gameState: JSON.parse(row.game_state),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      checksum: row.checksum,
      version: row.version,
    };
  }

  // 数据完整性验证
  async validateSaveIntegrity(id: number): Promise<boolean> {
    const save = this.findById(id);
    if (!save) return false;

    const dataString = JSON.stringify({
      playerData: save.playerData,
      gameState: save.gameState,
    });
    const computedChecksum = createHash('sha256')
      .update(dataString)
      .digest('hex');

    return computedChecksum === save.checksum;
  }
}
```

### 数据备份与恢复策略

**自动备份机制**：

```typescript
// src/shared/database/backup-manager.ts
import fs from 'fs-extra';
import path from 'path';
import { app } from 'electron';
import { createHash } from 'crypto';

export class DatabaseBackupManager {
  private backupDir: string;
  private maxBackups: number = 10;

  constructor() {
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    fs.ensureDirSync(this.backupDir);
  }

  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `game-data-${timestamp}.db`;
    const backupPath = path.join(this.backupDir, backupFileName);

    const dbPath = path.join(app.getPath('userData'), 'game-data.db');

    try {
      // 执行WAL检查点确保数据完整性
      await this.performWALCheckpoint();

      // 复制数据库文件
      await fs.copy(dbPath, backupPath);

      // 验证备份完整性
      const isValid = await this.validateBackup(backupPath);
      if (!isValid) {
        await fs.remove(backupPath);
        throw new Error('Backup validation failed');
      }

      // 清理旧备份
      await this.cleanupOldBackups();

      console.log(`Database backup created: ${backupFileName}`);
      return backupPath;
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    const dbPath = path.join(app.getPath('userData'), 'game-data.db');

    try {
      // 验证备份文件
      const isValid = await this.validateBackup(backupPath);
      if (!isValid) {
        throw new Error('Backup file is corrupted');
      }

      // 创建当前数据库的紧急备份
      const emergencyBackup = path.join(this.backupDir, 'emergency-backup.db');
      if (await fs.pathExists(dbPath)) {
        await fs.copy(dbPath, emergencyBackup);
      }

      // 恢复数据库
      await fs.copy(backupPath, dbPath);

      console.log('Database restored from backup successfully');
    } catch (error) {
      console.error('Database restore failed:', error);
      throw error;
    }
  }

  private async validateBackup(backupPath: string): Promise<boolean> {
    try {
      const Database = require('better-sqlite3');
      const db = new Database(backupPath, { readonly: true });

      // 检查数据库完整性
      const result = db.pragma('integrity_check');
      db.close();

      return result[0].integrity_check === 'ok';
    } catch (error) {
      return false;
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    const files = await fs.readdir(this.backupDir);
    const backupFiles = files
      .filter(file => file.startsWith('game-data-') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(this.backupDir, file),
        mtime: fs.statSync(path.join(this.backupDir, file)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // 保留最新的备份，删除多余的
    if (backupFiles.length > this.maxBackups) {
      const filesToDelete = backupFiles.slice(this.maxBackups);
      for (const file of filesToDelete) {
        await fs.remove(file.path);
      }
    }
  }
}
```

### 数据迁移和版本管理

**Schema迁移系统**：

```typescript
// src/shared/database/migration-manager.ts
export interface Migration {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

export class MigrationManager {
  private migrations: Migration[] = [
    {
      version: 1,
      description: 'Initial schema creation',
      up: db => {
        // 创建初始表结构
        db.exec(`
          CREATE TABLE game_saves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            save_name TEXT NOT NULL UNIQUE,
            player_data JSON NOT NULL,
            game_state JSON NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            checksum TEXT NOT NULL,
            version INTEGER DEFAULT 1
          );
        `);
      },
    },
    {
      version: 2,
      description: 'Add achievements table',
      up: db => {
        db.exec(`
          CREATE TABLE achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            achievement_id TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            icon_url TEXT,
            points INTEGER DEFAULT 0,
            unlocked_at DATETIME,
            progress REAL DEFAULT 0.0,
            metadata JSON
          );
        `);
      },
    },
  ];

  constructor(private db: Database.Database) {
    this.initializeVersionTable();
  }

  private initializeVersionTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_versions (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT NOT NULL
      );
    `);
  }

  public migrate(): void {
    const currentVersion = this.getCurrentVersion();
    const pendingMigrations = this.migrations.filter(
      m => m.version > currentVersion
    );

    if (pendingMigrations.length === 0) {
      console.log('Database is up to date');
      return;
    }

    console.log(`Applying ${pendingMigrations.length} migrations...`);

    const transaction = this.db.transaction(() => {
      for (const migration of pendingMigrations) {
        console.log(
          `Applying migration ${migration.version}: ${migration.description}`
        );

        try {
          migration.up(this.db);

          // 记录迁移版本
          const stmt = this.db.prepare(`
            INSERT INTO schema_versions (version, description) VALUES (?, ?)
          `);
          stmt.run(migration.version, migration.description);
        } catch (error) {
          console.error(`Migration ${migration.version} failed:`, error);
          throw error;
        }
      }
    });

    transaction();
    console.log('All migrations applied successfully');
  }

  private getCurrentVersion(): number {
    try {
      const stmt = this.db.prepare(
        'SELECT MAX(version) as version FROM schema_versions'
      );
      const result = stmt.get();
      return result?.version || 0;
    } catch {
      return 0;
    }
  }
}
```

### Positive Consequences

- SQLite提供了优秀的ACID事务支持和数据完整性
- WAL模式支持高并发读取操作，显著提升性能
- 无需外部依赖，简化部署和分发
- 跨平台兼容性好，支持所有Electron目标平台
- 内置的全文搜索和JSON操作支持
- 自动备份和恢复机制保障数据安全
- 灵活的Schema迁移系统支持版本升级

### Negative Consequences

- SQLite不支持网络访问，仅限本地存储
- 单文件数据库在大数据量时可能出现性能瓶颈
- WAL模式会创建额外的日志文件，占用更多磁盘空间
- 复杂查询的性能可能不如专业数据库
- 备份和同步需要额外的实现工作
- JSON列查询性能相对较低

## Verification

- **测试验证**: tests/unit/database/sqlite-manager.spec.ts, tests/integration/data-persistence.spec.ts
- **门禁脚本**: scripts/verify_database_integrity.mjs, scripts/test_backup_restore.mjs
- **监控指标**: db.query_performance, db.wal_size, backup.success_rate, migration.execution_time
- **数据完整性**: 定期校验和验证、自动备份验证、事务回滚测试

### 数据存储验证清单

- [ ] SQLite WAL模式启用和配置验证
- [ ] 数据完整性校验和机制工作正常
- [ ] 自动备份定期执行并验证完整性
- [ ] Schema迁移系统能够正确处理版本升级
- [ ] 事务操作确保数据一致性
- [ ] 数据库性能满足游戏运行要求
- [ ] 跨平台数据文件兼容性验证

## Operational Playbook

### 升级步骤

1. **数据库配置**: 配置SQLite连接和WAL模式参数
2. **Schema部署**: 执行初始Schema创建和索引优化
3. **备份配置**: 设置自动备份计划和存储策略
4. **迁移系统**: 部署数据库版本管理和迁移系统
5. **监控集成**: 集成数据库性能监控和告警
6. **数据验证**: 建立数据完整性检查和修复机制

### 回滚步骤

1. **数据恢复**: 从最近的有效备份恢复数据库
2. **版本回退**: 如需要，回滚到稳定的Schema版本
3. **WAL清理**: 清理损坏的WAL文件并重建
4. **完整性检查**: 执行全面的数据完整性验证
5. **性能验证**: 确认数据库操作性能正常
6. **问题分析**: 分析故障原因并制定预防措施

### 迁移指南

- **数据迁移**: 现有数据需要迁移到新的表结构中
- **配置更新**: 更新数据库连接配置和优化参数
- **备份策略**: 建立定期备份和灾难恢复计划
- **性能调优**: 根据实际使用情况调整SQLite参数
- **监控部署**: 部署数据库监控和性能追踪

## References

- **CH章节关联**: CH05, CH06
- **相关ADR**: ADR-0005-quality-gates, ADR-0007-ports-adapters
- **外部文档**:
  - [SQLite WAL Mode](https://www.sqlite.org/wal.html)
  - [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
  - [Database Design Best Practices](https://www.sqlitetutorial.net/sqlite-database-design/)
  - [Electron Data Storage](https://www.electronjs.org/docs/tutorial/data-storage)
- **性能基准**: SQLite Performance Tuning, Database Optimization Guide
- **相关PRD-ID**: 适用于所有需要数据持久化的PRD模块

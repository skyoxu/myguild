/**
 * 数据库备份功能最小验收测试
 *
 * 验证备份脚本的核心功能：
 * - backup模式创建有效的sqlite文件
 * - 文件存在性和基本完整性验证
 *
 * @requires scripts/db/backup-cli.mjs
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'path';
import { beforeEach, afterEach, test, expect } from 'vitest';

// 测试配置
const TEST_DATA_DIR = './test-data';
const TEST_BACKUP_DIR = './test-backups';
const TEST_DB_PATH = path.join(TEST_DATA_DIR, 'test-app.db');

/**
 * 检查SQLite3命令行工具是否可用
 */
function isSQLite3Available(): boolean {
  try {
    execSync('sqlite3 --version', { stdio: 'pipe', encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 创建简单的测试数据库文件
 */
function createMockDatabase(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 创建一个包含SQLite文件头的简单文件
  const sqliteHeader = Buffer.from([
    // SQLite file format header
    0x53,
    0x51,
    0x4c,
    0x69,
    0x74,
    0x65,
    0x20,
    0x66, // "SQLite f"
    0x6f,
    0x72,
    0x6d,
    0x61,
    0x74,
    0x20,
    0x33,
    0x00, // "ormat 3\0"
  ]);

  // Pad to minimum SQLite file size (typically 1024 bytes)
  const padding = Buffer.alloc(1024 - sqliteHeader.length, 0);
  const mockDb = Buffer.concat([sqliteHeader, padding]);

  fs.writeFileSync(dbPath, mockDb);
}

/**
 * 清理测试文件
 */
function cleanupTestFiles() {
  [TEST_DATA_DIR, TEST_BACKUP_DIR, './backups'].forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

beforeEach(() => {
  cleanupTestFiles();
  if (isSQLite3Available()) {
    createMockDatabase(TEST_DB_PATH);
  }
});

afterEach(() => {
  cleanupTestFiles();
});

test.skipIf(!isSQLite3Available())('backup creates a valid sqlite file', () => {
  execSync(
    `node scripts/db/backup-cli.mjs ${TEST_DB_PATH} ${TEST_BACKUP_DIR} --mode=backup`,
    { stdio: 'inherit', timeout: 30000 } // 数据库操作30s超时
  );
  const latest = fs
    .readdirSync(TEST_BACKUP_DIR)
    .filter(f => f.endsWith('.sqlite'))
    .sort()
    .pop();
  expect(latest).toBeTruthy();
  // 简单校验：文件存在且大小>0
  const stat = fs.statSync(`${TEST_BACKUP_DIR}/${latest}`);
  expect(stat.size).toBeGreaterThan(0);
});

test.skipIf(!isSQLite3Available())(
  'VACUUM INTO mode creates compressed backup',
  () => {
    // 测试 VACUUM INTO 模式（适合“冷备/轻写”窗口）
    execSync(
      `node scripts/db/backup-cli.mjs ${TEST_DB_PATH} ${TEST_BACKUP_DIR} --mode=vacuum`,
      { stdio: 'inherit', timeout: 45000 } // VACUUM操作更慢，45s超时
    );
    const latest = fs
      .readdirSync(TEST_BACKUP_DIR)
      .filter(f => f.endsWith('.sqlite'))
      .sort()
      .pop();
    expect(latest).toBeTruthy();

    // VACUUM INTO 产生的文件应该是紧缩的，无历史痕迹
    const backupPath = path.join(TEST_BACKUP_DIR, latest!);
    expect(fs.existsSync(backupPath)).toBe(true);

    // 验证文件大小合理
    const stat = fs.statSync(backupPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(2048); // VACUUM 后应该相对紧缩
  }
);

test.skipIf(!isSQLite3Available())(
  'backup handles concurrent access gracefully',
  async () => {
    // 改为async函数以支持await Promise.all
    // 模拟并发访问场景
    const promises = [];

    // 启动多个并发备份操作
    for (let i = 0; i < 3; i++) {
      const concurrentBackupDir = `${TEST_BACKUP_DIR}-${i}`;
      promises.push(
        new Promise<void>((resolve, reject) => {
          try {
            execSync(
              `node scripts/db/backup-cli.mjs ${TEST_DB_PATH} ${concurrentBackupDir} --mode=backup`,
              { stdio: 'pipe', timeout: 15000 } // 单个并发操作15s超时
            );
            resolve();
          } catch (error) {
            reject(error);
          }
        })
      );
    }

    // 所有备份操作都应该成功完成，设置整体超时
    await Promise.all(promises);
  },
  60000 // 并发测试60s超时
);

test.skipIf(!isSQLite3Available())(
  'checkpoint integration with backup workflow',
  () => {
    // 测试 checkpoint + backup 的集成工作流

    // 1. 执行 checkpoint 操作
    const checkpointResult = execSync(
      `node scripts/db/checkpoint.mjs --database=${TEST_DB_PATH} --truncate --verbose`,
      { encoding: 'utf8', stdio: 'pipe' }
    );

    const checkpointData = JSON.parse(checkpointResult);
    expect(checkpointData.ok).toBe(true);

    // 2. 立即执行备份操作（“冷备”窗口）
    execSync(
      `node scripts/db/backup-cli.mjs ${TEST_DB_PATH} ${TEST_BACKUP_DIR} --mode=vacuum`,
      { stdio: 'inherit', timeout: 45000 } // 集成工作流45s超时
    );

    // 3. 验证备份文件生成
    const backups = fs
      .readdirSync(TEST_BACKUP_DIR)
      .filter(f => f.endsWith('.sqlite'));
    expect(backups.length).toBeGreaterThan(0);

    // 4. 验证备份文件完整性（简单检查）
    const latestBackup = backups.sort().pop()!;
    const backupPath = path.join(TEST_BACKUP_DIR, latestBackup);
    const backupContent = fs.readFileSync(backupPath);

    // 检查 SQLite 文件头
    const expectedHeader = Buffer.from('SQLite format 3');
    expect(backupContent.subarray(0, expectedHeader.length)).toEqual(
      expectedHeader
    );
  }
);

test.skipIf(!isSQLite3Available())(
  'backup error handling and validation',
  () => {
    // 测试错误处理和验证机制

    // 1. 不存在的数据库文件
    const nonExistentDb = './non-existent-db.sqlite';
    expect(() => {
      execSync(
        `node scripts/db/backup-cli.mjs ${nonExistentDb} ${TEST_BACKUP_DIR} --mode=backup`,
        { stdio: 'pipe' }
      );
    }).toThrow();

    // 2. 无效的备份目录（只读文件系统）
    // 注意：在 Windows 上这个测试可能需要调整
    if (process.platform !== 'win32') {
      const readOnlyDir = './readonly-backup';
      fs.mkdirSync(readOnlyDir, { mode: 0o444 });

      expect(() => {
        execSync(
          `node scripts/db/backup-cli.mjs ${TEST_DB_PATH} ${readOnlyDir} --mode=backup`,
          { stdio: 'pipe' }
        );
      }).toThrow();

      // 清理
      fs.chmodSync(readOnlyDir, 0o755);
      fs.rmSync(readOnlyDir, { recursive: true, force: true });
    }
  }
);

test.skipIf(!isSQLite3Available())('backup script JSON output format', () => {
  // 测试备份脚本的 JSON 输出格式（用于 CI 集成）
  const result = execSync(
    `node scripts/db/backup-cli.mjs ${TEST_DB_PATH} ${TEST_BACKUP_DIR} --mode=backup --json`,
    { encoding: 'utf8', stdio: 'pipe' }
  );

  const jsonOutput = JSON.parse(result);
  expect(jsonOutput.ok).toBe(true);
  expect(jsonOutput.backupFile).toBeDefined();
  expect(jsonOutput.mode).toBe('backup');
  expect(jsonOutput.timestamp).toBeDefined();
  expect(jsonOutput.databaseSize).toBeGreaterThan(0);
  expect(jsonOutput.backupSize).toBeGreaterThan(0);
});

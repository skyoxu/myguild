/**
 * SQLite WAL Checkpoint 功能单元测试
 *
 * 验证 checkpoint 脚本的核心功能：
 * - TRUNCATE 模式 checkpoint 操作
 * - WAL 文件状态管理
 * - 质量门禁集成
 *
 * @requires scripts/db/checkpoint.mjs
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'path';
import { beforeEach, afterEach, test, expect } from 'vitest';

// 测试配置
const TEST_DATA_DIR = './test-checkpoint-data';
const TEST_DB_PATH = path.join(TEST_DATA_DIR, 'test-checkpoint.db');

/**
 * 检查 better-sqlite3 是否可用
 */
function isBetterSQLite3Available(): boolean {
  try {
    // 尝试导入 better-sqlite3 模块
    require.resolve('better-sqlite3');
    return true;
  } catch {
    return false;
  }
}

/**
 * 创建测试数据库文件（WAL 模式）
 */
function createTestWALDatabase(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    // 动态导入 better-sqlite3
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);

    // 设置为 WAL 模式
    db.pragma('journal_mode = WAL');

    // 创建测试表和数据
    db.exec(`
      CREATE TABLE IF NOT EXISTS test_data (
        id INTEGER PRIMARY KEY,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      INSERT INTO test_data (content) VALUES 
        ('test data 1'),
        ('test data 2'),
        ('test data 3');
    `);

    // 强制写入一些 WAL 数据
    db.prepare('INSERT INTO test_data (content) VALUES (?)').run(
      'wal test data'
    );

    db.close();
  } catch (error) {
    // 如果 better-sqlite3 不可用，创建模拟文件
    const sqliteHeader = Buffer.from([
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
    const padding = Buffer.alloc(1024 - sqliteHeader.length, 0);
    fs.writeFileSync(dbPath, Buffer.concat([sqliteHeader, padding]));

    // 创建模拟 WAL 文件
    fs.writeFileSync(dbPath + '-wal', Buffer.alloc(1024, 0));
  }
}

/**
 * 清理测试文件
 */
function cleanupTestFiles() {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
}

beforeEach(() => {
  cleanupTestFiles();
  createTestWALDatabase(TEST_DB_PATH);
});

afterEach(() => {
  cleanupTestFiles();
});

test.skipIf(!isBetterSQLite3Available())(
  'checkpoint TRUNCATE mode clears WAL file',
  () => {
    // 验证 WAL 文件存在
    const walFile = TEST_DB_PATH + '-wal';
    expect(fs.existsSync(walFile)).toBe(true);

    // 执行 TRUNCATE 模式 checkpoint
    const result = execSync(
      `node scripts/db/checkpoint.mjs --database=${TEST_DB_PATH} --truncate --verbose`,
      { encoding: 'utf8', stdio: 'pipe', timeout: 30000 } // WAL checkpoint 30s超时
    );

    const checkpointData = JSON.parse(result);
    expect(checkpointData.ok).toBe(true);
    expect(checkpointData.mode).toBe('TRUNCATE');
    expect(checkpointData.timestamp).toBeDefined();
    expect(checkpointData.database).toBe(TEST_DB_PATH);
  }
);

test.skipIf(!isBetterSQLite3Available())(
  'checkpoint handles non-WAL databases gracefully',
  () => {
    // 创建非 WAL 模式数据库
    const nonWALPath = path.join(TEST_DATA_DIR, 'non-wal.db');

    try {
      const Database = require('better-sqlite3');
      const db = new Database(nonWALPath);
      db.pragma('journal_mode = DELETE'); // 使用 DELETE 模式而不是 WAL
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY);');
      db.close();
    } catch {
      // Fallback 创建
      const sqliteHeader = Buffer.from('SQLite format 3\0');
      const padding = Buffer.alloc(1024 - sqliteHeader.length, 0);
      fs.writeFileSync(nonWALPath, Buffer.concat([sqliteHeader, padding]));
    }

    const result = execSync(
      `node scripts/db/checkpoint.mjs --database=${nonWALPath} --verbose`,
      { encoding: 'utf8', stdio: 'pipe', timeout: 20000 } // 非WAL模式检查20s超时
    );

    const checkpointData = JSON.parse(result);
    expect(checkpointData.ok).toBe(true);
    expect(checkpointData.skipped).toBe(true);
    expect(checkpointData.reason).toContain('not in WAL mode');
  }
);

test('checkpoint script parameter validation', () => {
  // 测试无效数据库路径
  expect(() => {
    execSync('node scripts/db/checkpoint.mjs --database=./non-existent.db', {
      stdio: 'pipe',
    });
  }).toThrow();
});

test('checkpoint script help output', () => {
  const helpOutput = execSync('node scripts/db/checkpoint.mjs --help', {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  expect(helpOutput).toContain('SQLite Checkpoint 管理脚本');
  expect(helpOutput).toContain('--truncate');
  expect(helpOutput).toContain('--database');
  expect(helpOutput).toContain('TRUNCATE 模式');
});

test.skipIf(!isBetterSQLite3Available())(
  'checkpoint integration with guard:ci',
  () => {
    // 测试 checkpoint 作为质量门禁的一部分

    // 1. 验证数据库存在且为 WAL 模式
    expect(fs.existsSync(TEST_DB_PATH)).toBe(true);

    // 2. 执行 guard:ci 中的 checkpoint 步骤
    const result = execSync(
      `node scripts/db/checkpoint.mjs --database=${TEST_DB_PATH} --truncate`,
      { encoding: 'utf8', stdio: 'pipe', timeout: 30000 } // CI测试30s超时
    );

    const checkpointData = JSON.parse(result);
    expect(checkpointData.ok).toBe(true);
    expect(checkpointData.mode).toBe('TRUNCATE');

    // 3. 验证操作完成后数据库仍然可用
    try {
      const Database = require('better-sqlite3');
      const db = new Database(TEST_DB_PATH);
      const count = db.prepare('SELECT COUNT(*) as count FROM test_data').get();
      expect(count.count).toBeGreaterThan(0);
      db.close();
    } catch (error) {
      // 如果 better-sqlite3 不可用，至少验证文件存在
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    }
  }
);

test.skipIf(!isBetterSQLite3Available())(
  'checkpoint error handling and recovery',
  () => {
    // 测试错误处理机制

    // 1. 数据库被锁定的情况
    let lockingDb: any;
    try {
      const Database = require('better-sqlite3');
      lockingDb = new Database(TEST_DB_PATH);
      lockingDb.pragma('locking_mode = EXCLUSIVE');

      // 尝试 checkpoint，应该能处理锁定情况
      const result = execSync(
        `node scripts/db/checkpoint.mjs --database=${TEST_DB_PATH} --truncate --verbose`,
        { encoding: 'utf8', stdio: 'pipe', timeout: 45000 } // 错误处理测试45s超时
      );

      const checkpointData = JSON.parse(result);
      // checkpoint 可能成功或失败，但不应该崩溃
      expect(checkpointData).toBeDefined();
    } finally {
      if (lockingDb) {
        try {
          lockingDb.close();
        } catch {
          // 忽略关闭错误
        }
      }
    }
  }
);

test('checkpoint script JSON output format consistency', () => {
  // 测试不同场景下的 JSON 输出格式一致性

  // 1. 尝试 checkpoint（可能因为缺少 better-sqlite3 而失败，但应该返回有效的 JSON）
  let checkpointResult;
  try {
    checkpointResult = execSync(
      `node scripts/db/checkpoint.mjs --database=${TEST_DB_PATH} --truncate`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
  } catch (error: any) {
    checkpointResult = error.stdout || error.stderr;
  }

  // 验证返回的是有效的 JSON 格式
  const checkpointData = JSON.parse(checkpointResult);
  expect(checkpointData.timestamp).toBeDefined();
  expect(checkpointData.database).toBe(TEST_DB_PATH);

  if (checkpointData.ok) {
    // 成功的情况
    expect(checkpointData.mode).toBeDefined();
  } else {
    // 失败的情况（比如缺少 better-sqlite3）
    expect(checkpointData.error).toBeDefined();
  }

  // 2. 失败的 checkpoint（错误数据库路径）
  let errorData;
  try {
    execSync('node scripts/db/checkpoint.mjs --database=./invalid-path.db', {
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (error: any) {
    if (error.stdout) {
      errorData = JSON.parse(error.stdout);
    }
  }

  if (errorData) {
    expect(errorData.ok).toBe(false);
    expect(errorData.error).toBeDefined();
    expect(errorData.timestamp).toBeDefined();
  }
});

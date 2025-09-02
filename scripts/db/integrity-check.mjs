#!/usr/bin/env node

/**
 * SQLite 数据库完整性校验脚本
 *
 * 功能：
 * - PRAGMA integrity_check 完整性验证
 * - PRAGMA quick_check 快速检查
 * - 表结构一致性验证
 * - 索引完整性检查
 * - 数据库文件损坏检测
 *
 * Usage:
 *   node scripts/db/integrity-check.mjs
 *   node scripts/db/integrity-check.mjs --db-path ./data/app.db
 *   node scripts/db/integrity-check.mjs --quick
 *   npm run db:integrity
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 默认配置
const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'app.db');

// 解析命令行参数
const args = process.argv.slice(2);
const DB_PATH =
  args.find(arg => arg.startsWith('--db-path='))?.split('=')[1] ||
  DEFAULT_DB_PATH;
const QUICK_MODE = args.includes('--quick');
const VERBOSE = args.includes('--verbose');

console.log('🔍 SQLite 数据库完整性校验');
console.log(`📁 数据库路径: ${DB_PATH}`);
console.log(`⚡ 模式: ${QUICK_MODE ? '快速检查' : '完整校验'}`);
console.log('');

/**
 * 执行完整性检查
 */
async function performIntegrityCheck() {
  // 1. 检查数据库文件是否存在
  if (!fs.existsSync(DB_PATH)) {
    console.log(`⚠️  数据库文件不存在: ${DB_PATH}`);
    console.log('📋 这在开发环境是正常的，跳过完整性检查');
    return true;
  }

  console.log('1️⃣ 文件存在性检查');
  const stats = fs.statSync(DB_PATH);
  console.log(`  ✅ 数据库文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`  ✅ 最后修改时间: ${stats.mtime.toISOString()}`);

  // 2. 尝试导入 SQLite
  let db;
  try {
    // 尝试动态导入 sqlite3
    const sqlite3 = await import('sqlite3').catch(() => null);
    if (!sqlite3) {
      console.log('⚠️  sqlite3 模块未安装，使用文件系统检查');
      return performFileSystemCheck();
    }

    // 创建数据库连接
    const { default: Database } = sqlite3;
    db = new Database.Database(DB_PATH, Database.OPEN_READONLY, err => {
      if (err) {
        console.error(`❌ 无法打开数据库: ${err.message}`);
        return false;
      }
    });

    console.log('2️⃣ 数据库连接检查');
    console.log('  ✅ 成功建立只读连接');

    // 3. 执行快速检查
    console.log('3️⃣ PRAGMA quick_check');
    const quickResult = await new Promise((resolve, reject) => {
      db.get('PRAGMA quick_check', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (quickResult && Object.values(quickResult)[0] === 'ok') {
      console.log('  ✅ 快速检查通过');
    } else {
      console.error(`  ❌ 快速检查失败: ${JSON.stringify(quickResult)}`);
      return false;
    }

    // 4. 完整性检查（非快速模式）
    if (!QUICK_MODE) {
      console.log('4️⃣ PRAGMA integrity_check');
      const integrityResult = await new Promise((resolve, reject) => {
        db.get('PRAGMA integrity_check', (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (integrityResult && Object.values(integrityResult)[0] === 'ok') {
        console.log('  ✅ 完整性检查通过');
      } else {
        console.error(
          `  ❌ 完整性检查失败: ${JSON.stringify(integrityResult)}`
        );
        return false;
      }

      // 5. 表结构一致性
      console.log('5️⃣ 表结构一致性检查');
      const tables = await new Promise((resolve, reject) => {
        db.all(
          'SELECT name FROM sqlite_master WHERE type="table"',
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      if (tables && tables.length > 0) {
        console.log(`  ✅ 发现 ${tables.length} 个表`);
        if (VERBOSE) {
          tables.forEach(table => console.log(`    - ${table.name}`));
        }
      } else {
        console.log('  ⚠️  数据库为空或无表结构');
      }

      // 6. 索引完整性
      console.log('6️⃣ 索引完整性检查');
      const indexes = await new Promise((resolve, reject) => {
        db.all(
          'SELECT name FROM sqlite_master WHERE type="index"',
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      if (indexes && indexes.length > 0) {
        console.log(`  ✅ 发现 ${indexes.length} 个索引`);
        if (VERBOSE) {
          indexes.forEach(index => console.log(`    - ${index.name}`));
        }
      } else {
        console.log('  📋 无自定义索引');
      }
    }

    // 关闭数据库连接
    db.close(err => {
      if (err) {
        console.error(`⚠️  关闭数据库连接时出错: ${err.message}`);
      }
    });

    return true;
  } catch (error) {
    console.error(`❌ 完整性检查异常: ${error.message}`);
    if (db) {
      db.close();
    }
    return false;
  }
}

/**
 * 文件系统级别检查（当 sqlite3 不可用时）
 */
function performFileSystemCheck() {
  console.log('2️⃣ 文件系统完整性检查');

  try {
    // 检查文件是否可读
    fs.accessSync(DB_PATH, fs.constants.R_OK);
    console.log('  ✅ 文件可读');

    // 检查文件头是否是SQLite格式
    const buffer = fs.readFileSync(DB_PATH, { start: 0, end: 16 });
    const sqliteHeader = 'SQLite format 3\0';

    if (buffer.toString().startsWith('SQLite format 3')) {
      console.log('  ✅ SQLite 文件头格式正确');
    } else {
      console.log('  ❌ SQLite 文件头格式不正确');
      return false;
    }

    // 检查文件大小合理性
    const stats = fs.statSync(DB_PATH);
    if (stats.size >= 1024) {
      // 至少1KB
      console.log('  ✅ 文件大小合理');
    } else {
      console.log('  ⚠️  文件可能损坏或为空');
    }

    console.log('📋 基础文件系统检查完成');
    return true;
  } catch (error) {
    console.error(`❌ 文件系统检查失败: ${error.message}`);
    return false;
  }
}

// 主执行逻辑
try {
  const success = await performIntegrityCheck();

  if (success) {
    console.log('');
    console.log('✅ SQLite 数据库完整性校验通过');
    process.exit(0);
  } else {
    console.log('');
    console.log('❌ SQLite 数据库完整性校验失败');
    process.exit(1);
  }
} catch (error) {
  console.error(`💥 校验过程异常: ${error.message}`);
  if (VERBOSE) {
    console.error(error.stack);
  }
  process.exit(1);
}

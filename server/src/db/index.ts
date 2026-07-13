import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../config';
import { initSchema } from './schema';

const dataDir = path.dirname(config.dbPath);

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建/打开数据库连接
const db: Database.Database = new Database(config.dbPath);

// 启用 WAL 模式和外键约束
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 初始化表结构
initSchema(db);

// 自动播种：首次启动时插入演示数据
const materialCount = db.prepare('SELECT COUNT(*) as count FROM materials').get() as { count: number };
if (materialCount.count === 0) {
  console.log('[数据库] 首次启动，正在插入种子数据...');
  const { seed } = require('./seed');
  seed(db);
  console.log('[数据库] 种子数据插入完成');
}

export default db;
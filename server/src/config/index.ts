import path from 'path';
import fs from 'fs';

interface AppConfig {
  port: number;
  ai: {
    apiBaseUrl: string;
    apiKey: string;
    model: string;
    chatModel: string;
  };
  dbPath: string;
  uploadsDir: string;
  clientDist: string;
  isDev: boolean;
}

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = Number(val);
  return isNaN(parsed) ? defaultValue : parsed;
}

const defaultDbPath = path.resolve(process.cwd(), 'data/moyuan.db');
const defaultUploadsDir = path.resolve(process.cwd(), 'uploads');
const defaultClientDist = path.resolve(process.cwd(), 'client/dist');

// 确保目录存在
const dbPath = getEnvString('DB_PATH', defaultDbPath);
const uploadsDir = getEnvString('UPLOADS_DIR', defaultUploadsDir);
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const config: AppConfig = {
  port: getEnvNumber('PORT', 3001),
  ai: {
    apiBaseUrl: getEnvString('AI_API_BASE_URL', 'http://localhost:11434/v1'),
    apiKey: getEnvString('AI_API_KEY', ''),
    model: getEnvString('AI_MODEL', 'qwen2.5:14b'),
    chatModel: getEnvString('AI_CHAT_MODEL', 'qwen2.5:14b'),
  },
  dbPath,
  uploadsDir,
  clientDist: getEnvString('CLIENT_DIST', defaultClientDist),
  isDev: getEnvString('NODE_ENV', 'development') !== 'production',
};

export default config;
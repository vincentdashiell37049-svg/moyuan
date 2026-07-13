import path from 'path';

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

const config: AppConfig = {
  port: getEnvNumber('PORT', 3001),
  ai: {
    apiBaseUrl: getEnvString('AI_API_BASE_URL', 'http://localhost:11434/v1'),
    apiKey: getEnvString('AI_API_KEY', ''),
    model: getEnvString('AI_MODEL', 'qwen2.5:14b'),
    chatModel: getEnvString('AI_CHAT_MODEL', 'qwen2.5:14b'),
  },
  dbPath: path.resolve(__dirname, '../../data/moyuan.db'),
  uploadsDir: path.resolve(__dirname, '../../uploads'),
  isDev: getEnvString('NODE_ENV', 'development') !== 'production',
};

export default config;
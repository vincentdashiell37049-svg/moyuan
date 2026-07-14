import 'dotenv/config';
import app from './app';
import config from './config';
import db from './db';

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`[墨苑] 后端服务已启动`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  环境: ${config.isDev ? 'development' : 'production'}`);
  console.log(`  数据库: ${config.dbPath}`);
  console.log(`  AI 服务: ${config.ai.apiKey ? '已配置 (' + config.ai.apiBaseUrl + ')' : '未配置'}`);
});

// 优雅关闭
function shutdown(signal: string) {
  console.log(`\n收到 ${signal} 信号，正在关闭服务...`);
  server.close(() => {
    console.log('HTTP 服务器已关闭');
    db.close();
    console.log('数据库连接已关闭');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default server;
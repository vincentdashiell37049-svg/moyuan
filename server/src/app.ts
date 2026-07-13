import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import config from './config';
import materialRoutes from './routes/materials';
import tagRoutes from './routes/tags';
import graphRoutes from './routes/graph';
import diffRoutes from './routes/diff';
import documentRoutes from './routes/documents';
import ocrRoutes from './routes/ocr';
import aiRoutes from './routes/ai';

const app = express();

// ========================================
// 中间件
// ========================================

// CORS 跨域
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// JSON 解析
app.use(express.json({ limit: '10mb' }));

// URL 编码解析
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务 - uploads 目录
app.use('/uploads', express.static(config.uploadsDir));

// ========================================
// 路由挂载
// ========================================

// 健康检查
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API 路由
app.use('/api/materials', materialRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/diff', diffRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/ai', aiRoutes);

// ========================================
// 404 处理
// ========================================
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    code: 404,
    message: 'Not Found',
  });
});

// ========================================
// 全局错误处理
// ========================================
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err);

  const statusCode = 'statusCode' in err ? (err as any).statusCode : 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    code: statusCode,
    message,
    ...(config.isDev && { stack: err.stack }),
  });
});

export default app;
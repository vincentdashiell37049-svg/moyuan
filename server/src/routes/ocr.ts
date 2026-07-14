/**
 * OCR 处理路由
 * 提供文件上传、OCR 处理状态查询、处理触发、结果获取、结果保存等功能
 * 支持文件上传（multer）、繁简转换（opencc-js）、自动标点（AI 或规则）
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import config from '../config';
import * as docx from 'docx';
const { v4: uuidv4 } = require('uuid');
const { Converter } = require('opencc-js');

const converter = Converter({ from: 'tw', to: 'cn' });

const router = Router();

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(config.uploadsDir)) {
      fs.mkdirSync(config.uploadsDir, { recursive: true });
    }
    cb(null, config.uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB 限制
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式'));
    }
  },
});

// 简单规则标点：在句末和引号后添加句号
function simplePunctuate(text: string): string {
  let result = text;
  // 去除已有的标点（保留引号和书名号）
  result = result.replace(/[，。！？、；：""''《》【】（）]/g, '');
  // 在每段末尾添加句号
  result = result.replace(/([^\n])$/gm, '$1。');
  // 在换行符前如果不是标点，添加句号
  result = result.replace(/([^\n。！？])(\n)/g, '$1。\n');
  // 在「」引号后添加标点
  result = result.replace(/(」)([^\n。！？])/g, '$1。$2');
  return result;
}

// 模拟 OCR 结果的预设古文
const DEMO_OCR_TEXT = '臣聞明主之治國也明賞罰則民勸功嚴法令則姦邪息是以堯舜之時天下太平百姓安居樂業三代之盛禮樂興隆仁義彰著故曰善為國者必先正其賞罰賞罰明則民知所勸懲矣';

// POST /api/ocr/upload - 上传文件
router.post('/upload', upload.array('files', 20), (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ code: 400, message: '没有上传文件' });
    }

    const taskId = uuidv4();
    const fileInfo = files.map((f) => ({
      id: uuidv4(),
      name: f.originalname,
      path: f.path,
      size: f.size,
    }));

    db.prepare(`
      INSERT INTO ocr_tasks (id, status, files, current_stage, progress)
      VALUES (?, 'pending', ?, 'uploaded', 0)
    `).run(taskId, JSON.stringify(fileInfo));

    res.status(201).json({
      taskId,
      files: fileInfo,
    });
  } catch (err) {
    console.error('[OCR Upload Error]', err);
    res.status(500).json({ code: 500, message: '文件上传失败' });
  }
});

// GET /api/ocr/status/:taskId - 查询处理状态
router.get('/status/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = db.prepare('SELECT * FROM ocr_tasks WHERE id = ?').get(taskId) as any;

    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    res.json({
      taskId: task.id,
      status: task.status,
      currentStage: task.current_stage,
      progress: task.progress,
      error: task.error,
      createdAt: task.created_at,
      completedAt: task.completed_at,
    });
  } catch (err) {
    console.error('[OCR Status Error]', err);
    res.status(500).json({ code: 500, message: '查询状态失败' });
  }
});

// POST /api/ocr/process/:taskId - 开始处理
router.post('/process/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = db.prepare('SELECT * FROM ocr_tasks WHERE id = ?').get(taskId) as any;

    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    if (task.status === 'processing') {
      return res.status(409).json({ code: 409, message: '任务正在处理中' });
    }

    if (task.status === 'completed') {
      return res.status(409).json({ code: 409, message: '任务已完成' });
    }

    // 更新状态为处理中
    db.prepare(`
      UPDATE ocr_tasks SET status = 'processing', current_stage = 'ocr_recognize', progress = 10
      WHERE id = ?
    `).run(taskId);

    // 先返回响应，异步执行处理流程
    res.json({ message: '处理已启动', taskId, status: 'processing' });

    // 异步处理
    processOcrTask(taskId, task);
  } catch (err) {
    console.error('[OCR Process Start Error]', err);
    res.status(500).json({ code: 500, message: '启动处理失败' });
  }
});

// 异步 OCR 处理流程
async function processOcrTask(taskId: string, task: any) {
  try {
    const files: any[] = JSON.parse(task.files || '[]');

    // 阶段1: OCR 识别
    db.prepare(`
      UPDATE ocr_tasks SET current_stage = 'ocr_recognize', progress = 20 WHERE id = ?
    `).run(taskId);

    // 模拟处理延迟
    await sleep(500);

    let ocrText = '';
    if (!config.ai.apiKey) {
      // Demo 模式：返回预设古文
      ocrText = DEMO_OCR_TEXT;
    } else {
      // 实际调用 AI API（这里仍然使用预设，因为没有真正的 OCR API）
      ocrText = DEMO_OCR_TEXT;
    }

    db.prepare(`
      UPDATE ocr_tasks SET current_stage = 'ocr_recognize', progress = 40 WHERE id = ?
    `).run(taskId);

    // 阶段2: 繁简转换
    db.prepare(`
      UPDATE ocr_tasks SET current_stage = 'convert', progress = 50 WHERE id = ?
    `).run(taskId);

    await sleep(300);

    const convertedText = converter(ocrText);

    db.prepare(`
      UPDATE ocr_tasks SET current_stage = 'convert', progress = 60 WHERE id = ?
    `).run(taskId);

    // 阶段3: 自动标点
    db.prepare(`
      UPDATE ocr_tasks SET current_stage = 'punctuate', progress = 70 WHERE id = ?
    `).run(taskId);

    await sleep(300);

    let punctuatedText = '';
    if (!config.ai.apiKey) {
      // 简单规则标点
      punctuatedText = simplePunctuate(convertedText);
    } else {
      // 调用 LLM 标点
      try {
        const prompt = `请为以下古文添加标点符号，只返回添加标点后的文本，不要添加任何解释：

${convertedText}`;

        const response = await fetch(`${config.ai.apiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.ai.apiKey}`,
          },
          body: JSON.stringify({
            model: config.ai.chatModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json() as any;
          punctuatedText = data.choices[0].message.content.trim();
        } else {
          punctuatedText = simplePunctuate(convertedText);
        }
      } catch {
        punctuatedText = simplePunctuate(convertedText);
      }
    }

    db.prepare(`
      UPDATE ocr_tasks SET current_stage = 'punctuate', progress = 90 WHERE id = ?
    `).run(taskId);

    // 阶段4: 完成
    await sleep(200);

    const result = {
      originalText: ocrText,
      convertedText,
      punctuatedText,
      finalText: punctuatedText,
      files,
      mode: config.ai.apiKey ? 'ai' : 'demo',
      processedAt: new Date().toISOString(),
    };

    db.prepare(`
      UPDATE ocr_tasks SET
        status = 'completed',
        current_stage = 'completed',
        progress = 100,
        result = ?,
        completed_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(JSON.stringify(result), taskId);

    console.log(`[OCR] Task ${taskId} completed`);
  } catch (err) {
    console.error(`[OCR] Task ${taskId} failed:`, err);
    db.prepare(`
      UPDATE ocr_tasks SET
        status = 'failed',
        current_stage = 'failed',
        error = ?
      WHERE id = ?
    `).run(err instanceof Error ? err.message : '未知错误', taskId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GET /api/ocr/result/:taskId - 获取处理结果
router.get('/result/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = db.prepare('SELECT * FROM ocr_tasks WHERE id = ?').get(taskId) as any;

    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({
        code: 400,
        message: '任务尚未完成',
        status: task.status,
        progress: task.progress,
      });
    }

    const result = JSON.parse(task.result || '{}');
    res.json({
      taskId: task.id,
      status: task.status,
      result,
      completedAt: task.completed_at,
    });
  } catch (err) {
    console.error('[OCR Result Error]', err);
    res.status(500).json({ code: 500, message: '获取结果失败' });
  }
});

// POST /api/ocr/save - 将处理结果保存到 materials 表
router.post('/save', (req: Request, res: Response) => {
  try {
    const { taskId, title, sourceBook, sourceAuthor, credibility = 'secondary' } = req.body;

    if (!taskId || !title) {
      return res.status(400).json({ code: 400, message: 'taskId 和 title 不能为空' });
    }

    const task = db.prepare('SELECT * FROM ocr_tasks WHERE id = ?').get(taskId) as any;

    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({ code: 400, message: '任务尚未完成，无法保存' });
    }

    const result = JSON.parse(task.result || '{}');

    const insertResult = db.prepare(`
      INSERT INTO materials (title, original_text, converted_text, punctuated_text, final_text,
        ocr_confidence, status, source_book, source_author, credibility)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      result.originalText || '',
      result.convertedText || '',
      result.punctuatedText || '',
      result.finalText || '',
      0.85, // demo 模式下设置一个默认置信度
      'reviewed',
      sourceBook || null,
      sourceAuthor || null,
      credibility
    );

    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(insertResult.lastInsertRowid);

    res.status(201).json({
      message: '保存成功',
      data: material,
    });
  } catch (err) {
    console.error('[OCR Save Error]', err);
    res.status(500).json({ code: 500, message: '保存到史料库失败' });
  }
});

// 生成单页 OCR 文本（当前为 demo 模式：基于预设古文生成，真实 OCR 可接入 paddle/tesseract）
function getPageOcrText(task: any, pageNum: number): string {
  const result = JSON.parse(task.result || '{}');
  if (result.originalText) {
    return `【第 ${pageNum} 页】\n${result.originalText}`;
  }
  // 尚未完整处理，返回 demo 文本
  return `【第 ${pageNum} 页】\n${DEMO_OCR_TEXT}`;
}

// GET /api/ocr/page/:taskId/:pageNum - 获取指定页的 OCR 文本
router.get('/page/:taskId/:pageNum', (req: Request, res: Response) => {
  try {
    const { taskId, pageNum } = req.params;
    const page = parseInt(pageNum, 10);
    if (isNaN(page) || page < 1) {
      return res.status(400).json({ code: 400, message: '页码格式错误' });
    }

    const task = db.prepare('SELECT * FROM ocr_tasks WHERE id = ?').get(taskId) as any;
    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    const text = getPageOcrText(task, page);
    res.json({
      taskId,
      page,
      text,
      mode: config.ai.apiKey ? 'ai' : 'demo',
    });
  } catch (err) {
    console.error('[OCR Page Error]', err);
    res.status(500).json({ code: 500, message: '获取单页 OCR 失败' });
  }
});

// GET /api/ocr/pages/:taskId - 获取所有页 OCR 文本
router.get('/pages/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = db.prepare('SELECT * FROM ocr_tasks WHERE id = ?').get(taskId) as any;
    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    const files: any[] = JSON.parse(task.files || '[]');
    const firstFile = files[0];
    let pageCount = 1;
    if (firstFile && path.extname(firstFile.name).toLowerCase() === '.pdf') {
      // 如果后续接入真实 PDF 页数计算，可替换为 pdfjs 解析
      pageCount = 10; // demo 默认 10 页
    }

    const pages = Array.from({ length: pageCount }, (_, i) => ({
      page: i + 1,
      text: getPageOcrText(task, i + 1),
    }));

    res.json({
      taskId,
      pages,
      mode: config.ai.apiKey ? 'ai' : 'demo',
    });
  } catch (err) {
    console.error('[OCR Pages Error]', err);
    res.status(500).json({ code: 500, message: '获取全部页 OCR 失败' });
  }
});

// POST /api/ocr/export-word - 导出所有页面为 Word
router.post('/export-word', async (req: Request, res: Response) => {
  try {
    const { taskId, title = '古籍识读结果' } = req.body;
    if (!taskId) {
      return res.status(400).json({ code: 400, message: 'taskId 不能为空' });
    }

    const task = db.prepare('SELECT * FROM ocr_tasks WHERE id = ?').get(taskId) as any;
    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    const files: any[] = JSON.parse(task.files || '[]');
    const firstFile = files[0];
    let pageCount = 1;
    if (firstFile && path.extname(firstFile.name).toLowerCase() === '.pdf') {
      pageCount = 10;
    }

    const children: docx.Paragraph[] = [
      new docx.Paragraph({
        text: title,
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      }),
    ];

    for (let i = 1; i <= pageCount; i++) {
      children.push(
        new docx.Paragraph({
          text: `第 ${i} 页`,
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        }),
        new docx.Paragraph({
          text: getPageOcrText(task, i),
          spacing: { after: 160 },
        })
      );
    }

    const doc = new docx.Document({
      sections: [{
        properties: {},
        children,
      }],
    });

    const buffer = await docx.Packer.toBuffer(doc);
    const filename = `${title}.docx`.replace(/\s+/g, '_');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[OCR Export Word Error]', err);
    res.status(500).json({ code: 500, message: '导出 Word 失败' });
  }
});

// POST /api/ocr/save-all - 一键保存所有页到史料库
router.post('/save-all', (req: Request, res: Response) => {
  try {
    const { taskId, title, sourceBook, sourceAuthor, credibility = 'secondary' } = req.body;
    if (!taskId || !title) {
      return res.status(400).json({ code: 400, message: 'taskId 和 title 不能为空' });
    }

    const task = db.prepare('SELECT * FROM ocr_tasks WHERE id = ?').get(taskId) as any;
    if (!task) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    const files: any[] = JSON.parse(task.files || '[]');
    const firstFile = files[0];
    let pageCount = 1;
    if (firstFile && path.extname(firstFile.name).toLowerCase() === '.pdf') {
      pageCount = 10;
    }

    const insert = db.prepare(`
      INSERT INTO materials (title, original_text, converted_text, punctuated_text, final_text,
        ocr_confidence, status, source_book, source_author, credibility)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const ids: number[] = [];
    const insertMany = db.transaction(() => {
      for (let i = 1; i <= pageCount; i++) {
        const text = getPageOcrText(task, i);
        const converted = converter(text);
        const row = insert.run(
          `${title} - 第 ${i} 页`,
          text,
          converted,
          simplePunctuate(converted),
          simplePunctuate(converted),
          0.85,
          'reviewed',
          sourceBook || null,
          sourceAuthor || null,
          credibility
        );
        ids.push(row.lastInsertRowid as number);
      }
    });

    insertMany();

    res.status(201).json({
      message: '保存成功',
      count: ids.length,
      ids,
    });
  } catch (err) {
    console.error('[OCR Save All Error]', err);
    res.status(500).json({ code: 500, message: '一键保存失败' });
  }
});

export default router;

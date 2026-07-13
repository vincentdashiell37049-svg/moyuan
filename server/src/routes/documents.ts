/**
 * 写作文档路由
 * 提供文档的增删改查和引用管理功能
 */
import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

// GET /api/documents - 获取文档列表
router.get('/', (_req: Request, res: Response) => {
  try {
    const documents = db.prepare(`
      SELECT d.*,
        (SELECT COUNT(*) FROM document_citations dc WHERE dc.document_id = d.id) as citation_count
      FROM documents d
      ORDER BY d.updated_at DESC
    `).all();

    res.json(documents);
  } catch (err) {
    console.error('[Documents List Error]', err);
    res.status(500).json({ code: 500, message: '获取文档列表失败' });
  }
});

// POST /api/documents - 创建文档
router.post('/', (req: Request, res: Response) => {
  try {
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ code: 400, message: '文档标题不能为空' });
    }

    const result = db.prepare(
      'INSERT INTO documents (title, content) VALUES (?, ?)'
    ).run(title.trim(), '');

    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: '创建成功', data: document });
  } catch (err) {
    console.error('[Document Create Error]', err);
    res.status(500).json({ code: 500, message: '创建文档失败' });
  }
});

// GET /api/documents/:id - 获取文档详情（含引用）
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(id)) as any;

    if (!document) {
      return res.status(404).json({ code: 404, message: '文档不存在' });
    }

    // 获取引用列表
    const citations = db.prepare(`
      SELECT dc.*, m.title as material_title
      FROM document_citations dc
      INNER JOIN materials m ON dc.material_id = m.id
      WHERE dc.document_id = ?
      ORDER BY dc.created_at DESC
    `).all(document.id);

    res.json({
      ...document,
      citations,
    });
  } catch (err) {
    console.error('[Document Detail Error]', err);
    res.status(500).json({ code: 500, message: '获取文档详情失败' });
  }
});

// PUT /api/documents/:id - 保存文档
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(id)) as any;

    if (!document) {
      return res.status(404).json({ code: 404, message: '文档不存在' });
    }

    const { title, content } = req.body;

    db.prepare(`
      UPDATE documents SET
        title = ?,
        content = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      title !== undefined ? title : document.title,
      content !== undefined ? content : document.content,
      Number(id)
    );

    const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(id));
    res.json({ message: '保存成功', data: updated });
  } catch (err) {
    console.error('[Document Update Error]', err);
    res.status(500).json({ code: 500, message: '保存文档失败' });
  }
});

// DELETE /api/documents/:id - 删除文档
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(id));

    if (!document) {
      return res.status(404).json({ code: 404, message: '文档不存在' });
    }

    // 外键级联删除关联的 document_citations
    db.prepare('DELETE FROM documents WHERE id = ?').run(Number(id));
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('[Document Delete Error]', err);
    res.status(500).json({ code: 500, message: '删除文档失败' });
  }
});

// POST /api/documents/:id/citations - 添加引用
router.post('/:id/citations', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { materialId, citationMark } = req.body;

    if (!materialId) {
      return res.status(400).json({ code: 400, message: 'materialId 不能为空' });
    }

    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(id));
    if (!document) {
      return res.status(404).json({ code: 404, message: '文档不存在' });
    }

    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(materialId));
    if (!material) {
      return res.status(404).json({ code: 404, message: '史料不存在' });
    }

    const result = db.prepare(`
      INSERT INTO document_citations (document_id, material_id, citation_mark)
      VALUES (?, ?, ?)
    `).run(Number(id), Number(materialId), citationMark || null);

    const citation = db.prepare('SELECT * FROM document_citations WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: '引用添加成功', data: citation });
  } catch (err) {
    console.error('[Document Citation Add Error]', err);
    res.status(500).json({ code: 500, message: '添加引用失败' });
  }
});

// GET /api/documents/:id/citations - 获取文档引用列表
router.get('/:id/citations', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(id));
    if (!document) {
      return res.status(404).json({ code: 404, message: '文档不存在' });
    }

    const citations = db.prepare(`
      SELECT dc.*, m.title as material_title, m.source_book, m.source_author
      FROM document_citations dc
      INNER JOIN materials m ON dc.material_id = m.id
      WHERE dc.document_id = ?
      ORDER BY dc.created_at DESC
    `).all(Number(id));

    res.json(citations);
  } catch (err) {
    console.error('[Document Citations List Error]', err);
    res.status(500).json({ code: 500, message: '获取引用列表失败' });
  }
});

// DELETE /api/documents/:id/citations/:citationId - 删除引用
router.delete('/:id/citations/:citationId', (req: Request, res: Response) => {
  try {
    const { citationId } = req.params;

    const result = db.prepare('DELETE FROM document_citations WHERE id = ?').run(Number(citationId));

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '引用不存在' });
    }

    res.json({ message: '引用删除成功' });
  } catch (err) {
    console.error('[Document Citation Delete Error]', err);
    res.status(500).json({ code: 500, message: '删除引用失败' });
  }
});

export default router;
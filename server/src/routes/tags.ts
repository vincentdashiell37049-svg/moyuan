/**
 * 标签管理路由
 * 提供标签的增删查功能
 */
import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

// GET /api/tags - 获取所有标签
router.get('/', (_req: Request, res: Response) => {
  try {
    const tags = db.prepare(`
      SELECT t.*, COUNT(mt.material_id) as material_count
      FROM tags t
      LEFT JOIN material_tags mt ON t.id = mt.tag_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `).all();

    res.json(tags);
  } catch (err) {
    console.error('[Tags List Error]', err);
    res.status(500).json({ code: 500, message: '获取标签列表失败' });
  }
});

// POST /api/tags - 创建标签
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, color = '#78716c' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ code: 400, message: '标签名称不能为空' });
    }

    // 检查是否已存在同名标签
    const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name.trim());
    if (existing) {
      return res.status(409).json({ code: 409, message: '标签名称已存在' });
    }

    const result = db.prepare(
      'INSERT INTO tags (name, color) VALUES (?, ?)'
    ).run(name.trim(), color);

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ message: '创建成功', data: tag });
  } catch (err) {
    console.error('[Tag Create Error]', err);
    res.status(500).json({ code: 500, message: '创建标签失败' });
  }
});

// DELETE /api/tags/:id - 删除标签
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(Number(id));

    if (!tag) {
      return res.status(404).json({ code: 404, message: '标签不存在' });
    }

    // 由于外键约束 ON DELETE CASCADE，关联的 material_tags 记录会自动删除
    db.prepare('DELETE FROM tags WHERE id = ?').run(Number(id));
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('[Tag Delete Error]', err);
    res.status(500).json({ code: 500, message: '删除标签失败' });
  }
});

export default router;
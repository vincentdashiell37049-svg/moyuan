/**
 * 史料 CRUD 路由
 * 提供史料的增删改查、标签关联、引用格式生成等功能
 * 支持分页、FTS5 全文检索、按标签/可信度筛选
 */
import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

/* ---------- 将数据库 snake_case 字段映射为前端 camelCase ---------- */
function mapMaterial(row: any): any {
  if (!row) return row;
  return {
    ...row,
    sourceDb: row.source_db,
    sourceBook: row.source_book,
    sourceAuthor: row.source_author,
    sourceVersion: row.source_version,
    sourceVolume: row.source_volume,
    bookName: row.source_book,
    version: row.source_version,
    volumePage: row.source_volume,
    reliability: row.credibility,
    ocrText: row.original_text,
    simplifiedText: row.converted_text,
    punctuatedText: row.punctuated_text,
    finalText: row.final_text,
    content: row.original_text || row.final_text || '',
    ocrConfidence: row.ocr_confidence,
    filePath: row.file_path,
    fileType: row.file_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/materials - 获取史料列表，支持搜索、筛选、分页
router.get('/', (req: Request, res: Response) => {
  try {
    const {
      search,
      tagId,
      credibility,
      sort = 'created_at',
      order = 'desc',
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // 校验排序字段，防止SQL注入
    const allowedSortColumns = ['created_at', 'updated_at', 'title', 'credibility', 'status'];
    const sortCol = allowedSortColumns.includes(sort as string) ? (sort as string) : 'created_at';
    const sortOrder = (order as string) === 'asc' ? 'ASC' : 'DESC';

    let countSql = 'SELECT COUNT(DISTINCT m.id) as total FROM materials m';
    let dataSql = `
      SELECT m.* FROM materials m
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    // FTS5 全文检索
    if (search && typeof search === 'string' && search.trim()) {
      conditions.push(
        `m.id IN (SELECT rowid FROM materials_fts WHERE materials_fts MATCH ?)`
      );
      params.push(search.trim().replace(/['"]/g, ''));
    }

    // 按标签筛选
    if (tagId) {
      conditions.push(
        `m.id IN (SELECT material_id FROM material_tags WHERE tag_id = ?)`
      );
      params.push(parseInt(tagId as string, 10));
    }

    // 按可信度筛选
    if (credibility && typeof credibility === 'string') {
      const validCredibilities = ['primary', 'secondary', 'tertiary', 'reference'];
      if (validCredibilities.includes(credibility)) {
        conditions.push('m.credibility = ?');
        params.push(credibility);
      }
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      countSql += whereClause;
      dataSql += whereClause;
    }

    // 查询总数
    const countResult = db.prepare(countSql).get(...params) as { total: number };
    const total = countResult.total;

    // 查询数据（带排序和分页）
    dataSql += ` ORDER BY m.${sortCol} ${sortOrder} LIMIT ? OFFSET ?`;
    const items = db.prepare(dataSql).all(...params, limitNum, offset) as any[];

    // 为每个史料查询关联的标签
    const tagStmt = db.prepare(`
      SELECT t.id, t.name, t.color FROM tags t
      INNER JOIN material_tags mt ON t.id = mt.tag_id
      WHERE mt.material_id = ?
    `);
    const itemsWithTags = items.map((item) => ({
      ...mapMaterial(item),
      tags: tagStmt.all(item.id),
    }));

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        list: itemsWithTags,
        total,
        page: pageNum,
        pageSize: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[Materials List Error]', err);
    res.status(500).json({ code: 500, message: '获取史料列表失败' });
  }
});

// GET /api/materials/:id - 获取史料详情，包含关联标签和实体
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(id)) as any;

    if (!material) {
      return res.status(404).json({ code: 404, message: '史料不存在' });
    }

    // 查询关联标签
    const tags = db.prepare(`
      SELECT t.id, t.name, t.color FROM tags t
      INNER JOIN material_tags mt ON t.id = mt.tag_id
      WHERE mt.material_id = ?
    `).all(material.id);

    // 查询关联实体
    const entities = db.prepare(`
      SELECT e.*, me.mention_text FROM entities e
      INNER JOIN material_entities me ON e.id = me.entity_id
      WHERE me.material_id = ?
    `).all(material.id);

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        ...mapMaterial(material),
        tags,
        entities,
      },
    });
  } catch (err) {
    console.error('[Material Detail Error]', err);
    res.status(500).json({ code: 500, message: '获取史料详情失败' });
  }
});

// POST /api/materials - 创建史料
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      title,
      original_text,
      converted_text,
      punctuated_text,
      final_text,
      ocr_confidence,
      status = 'draft',
      source_db,
      source_book,
      source_author,
      source_version,
      source_volume,
      credibility = 'secondary',
      file_path,
      file_type,
    } = req.body;

    if (!title) {
      return res.status(400).json({ code: 400, message: '标题不能为空' });
    }

    const result = db.prepare(`
      INSERT INTO materials (title, original_text, converted_text, punctuated_text, final_text,
        ocr_confidence, status, source_db, source_book, source_author, source_version,
        source_volume, credibility, file_path, file_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      original_text || null,
      converted_text || null,
      punctuated_text || null,
      final_text || null,
      ocr_confidence || 0,
      status,
      source_db || null,
      source_book || null,
      source_author || null,
      source_version || null,
      source_volume || null,
      credibility,
      file_path || null,
      file_type || null
    );

    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ message: '创建成功', data: material });
  } catch (err) {
    console.error('[Material Create Error]', err);
    res.status(500).json({ code: 500, message: '创建史料失败' });
  }
});

// PUT /api/materials/:id - 更新史料
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(id)) as any;

    if (!material) {
      return res.status(404).json({ code: 404, message: '史料不存在' });
    }

    const {
      title,
      original_text,
      converted_text,
      punctuated_text,
      final_text,
      ocr_confidence,
      status,
      source_db,
      source_book,
      source_author,
      source_version,
      source_volume,
      credibility,
      file_path,
      file_type,
    } = req.body;

    db.prepare(`
      UPDATE materials SET
        title = ?,
        original_text = ?,
        converted_text = ?,
        punctuated_text = ?,
        final_text = ?,
        ocr_confidence = ?,
        status = ?,
        source_db = ?,
        source_book = ?,
        source_author = ?,
        source_version = ?,
        source_volume = ?,
        credibility = ?,
        file_path = ?,
        file_type = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      title !== undefined ? title : material.title,
      original_text !== undefined ? original_text : material.original_text,
      converted_text !== undefined ? converted_text : material.converted_text,
      punctuated_text !== undefined ? punctuated_text : material.punctuated_text,
      final_text !== undefined ? final_text : material.final_text,
      ocr_confidence !== undefined ? ocr_confidence : material.ocr_confidence,
      status !== undefined ? status : material.status,
      source_db !== undefined ? source_db : material.source_db,
      source_book !== undefined ? source_book : material.source_book,
      source_author !== undefined ? source_author : material.source_author,
      source_version !== undefined ? source_version : material.source_version,
      source_volume !== undefined ? source_volume : material.source_volume,
      credibility !== undefined ? credibility : material.credibility,
      file_path !== undefined ? file_path : material.file_path,
      file_type !== undefined ? file_type : material.file_type,
      Number(id)
    );

    const updated = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(id));
    res.json({ message: '更新成功', data: updated });
  } catch (err) {
    console.error('[Material Update Error]', err);
    res.status(500).json({ code: 500, message: '更新史料失败' });
  }
});

// DELETE /api/materials/:id - 删除史料
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(id));

    if (!material) {
      return res.status(404).json({ code: 404, message: '史料不存在' });
    }

    db.prepare('DELETE FROM materials WHERE id = ?').run(Number(id));
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('[Material Delete Error]', err);
    res.status(500).json({ code: 500, message: '删除史料失败' });
  }
});

// POST /api/materials/:id/tags - 添加标签
router.post('/:id/tags', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tagId } = req.body;

    if (!tagId) {
      return res.status(400).json({ code: 400, message: 'tagId 不能为空' });
    }

    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(id));
    if (!material) {
      return res.status(404).json({ code: 404, message: '史料不存在' });
    }

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(Number(tagId));
    if (!tag) {
      return res.status(404).json({ code: 404, message: '标签不存在' });
    }

    // 检查是否已关联
    const existing = db.prepare(
      'SELECT * FROM material_tags WHERE material_id = ? AND tag_id = ?'
    ).get(Number(id), Number(tagId));

    if (existing) {
      return res.status(409).json({ code: 409, message: '该标签已关联' });
    }

    db.prepare('INSERT INTO material_tags (material_id, tag_id) VALUES (?, ?)').run(
      Number(id),
      Number(tagId)
    );

    res.json({ message: '标签添加成功' });
  } catch (err) {
    console.error('[Material Add Tag Error]', err);
    res.status(500).json({ code: 500, message: '添加标签失败' });
  }
});

// DELETE /api/materials/:id/tags/:tagId - 移除标签
router.delete('/:id/tags/:tagId', (req: Request, res: Response) => {
  try {
    const { id, tagId } = req.params;

    const result = db.prepare(
      'DELETE FROM material_tags WHERE material_id = ? AND tag_id = ?'
    ).run(Number(id), Number(tagId));

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '关联不存在' });
    }

    res.json({ message: '标签移除成功' });
  } catch (err) {
    console.error('[Material Remove Tag Error]', err);
    res.status(500).json({ code: 500, message: '移除标签失败' });
  }
});

// GET /api/materials/:id/citation?format=gbt7714|chicago - 生成引用格式
router.get('/:id/citation', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { format = 'gbt7714' } = req.query;

    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(id)) as any;

    if (!material) {
      return res.status(404).json({ code: 404, message: '史料不存在' });
    }

    let citation = '';
    const author = material.source_author || '佚名';
    const book = material.source_book || material.title;
    const version = material.source_version ? `（${material.source_version}）` : '';
    const volume = material.source_volume ? `，第${material.source_volume}册` : '';
    const dbSource = material.source_db ? `，${material.source_db}` : '';

    if (format === 'chicago') {
      // 芝加哥格式: Author. Title. Edition, Volume. Database.
      citation = `${author}. ${book}${version}${volume}${dbSource}.`;
    } else {
      // GB/T 7714 格式: 作者. 题名[文献类型]. 版本, 卷. 数据库.
      citation = `${author}. ${book}${version}${volume}${dbSource}.`;
    }

    res.json({
      format,
      citation,
      materialId: Number(id),
    });
  } catch (err) {
    console.error('[Material Citation Error]', err);
    res.status(500).json({ code: 500, message: '生成引用格式失败' });
  }
});

export default router;
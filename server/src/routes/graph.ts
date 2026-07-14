/**
 * 知识图谱路由
 * 提供实体和关系的增删查、ECharts graph 可视化数据、统计等功能
 */
import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

// 实体类型中文映射
const TYPE_LABELS: Record<string, string> = {
  person: '人物',
  place: '地点',
  official_title: '官职',
  event: '事件',
  time: '时间',
  institution: '机构',
};

// GET /api/graph/entities?type=&search= - 获取实体列表
router.get('/entities', (req: Request, res: Response) => {
  try {
    const { type, search } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (type && typeof type === 'string') {
      const validTypes = ['person', 'place', 'official_title', 'event', 'time', 'institution'];
      if (validTypes.includes(type)) {
        conditions.push('e.type = ?');
        params.push(type);
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      conditions.push('(e.name LIKE ? OR e.aliases LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern);
    }

    let sql = 'SELECT e.* FROM entities e';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY e.updated_at DESC';

    const entities = db.prepare(sql).all(...params);
    res.json({ code: 0, message: '获取成功', data: entities });
  } catch (err) {
    console.error('[Graph Entities List Error]', err);
    res.status(500).json({ code: 500, message: '获取实体列表失败' });
  }
});

// GET /api/graph/relations?entityId= - 获取关系列表
router.get('/relations', (req: Request, res: Response) => {
  try {
    const { entityId } = req.query;

    let sql = `
      SELECT r.*,
        se.name as source_name, se.type as source_type,
        te.name as target_name, te.type as target_type
      FROM relations r
      INNER JOIN entities se ON r.source_id = se.id
      INNER JOIN entities te ON r.target_id = te.id
    `;
    const params: any[] = [];

    if (entityId) {
      sql += ' WHERE r.source_id = ? OR r.target_id = ?';
      params.push(Number(entityId), Number(entityId));
    }

    sql += ' ORDER BY r.created_at DESC';
    const relations = db.prepare(sql).all(...params);
    res.json({ code: 0, message: '获取成功', data: relations });
  } catch (err) {
    console.error('[Graph Relations List Error]', err);
    res.status(500).json({ code: 500, message: '获取关系列表失败' });
  }
});

// GET /api/graph/visualize?types=&centerEntityId= - 获取 ECharts graph 格式数据
router.get('/visualize', (req: Request, res: Response) => {
  try {
    const { types, centerEntityId } = req.query;

    // 构建 categories — 按前端 ALL_TYPES 顺序排列
    const categoriesOrder = ['person', 'place', 'event', 'time', 'official_title', 'institution'];
    const categories = categoriesOrder.map((type) => ({ name: TYPE_LABELS[type] || type }));

    // 获取所有实体
    let entitySql = 'SELECT e.*, COUNT(r.id) as relation_count FROM entities e';
    entitySql += ' LEFT JOIN relations r ON (r.source_id = e.id OR r.target_id = e.id)';

    const conditions: string[] = [];
    const params: any[] = [];

    if (types && typeof types === 'string') {
      const typeList = (types as string).split(',').filter((t) => t in TYPE_LABELS);
      if (typeList.length > 0) {
        const placeholders = typeList.map(() => '?').join(',');
        conditions.push(`e.type IN (${placeholders})`);
        params.push(...typeList);
      }
    }

    if (centerEntityId) {
      // 获取中心实体直接关联的所有实体ID
      conditions.push(`(
        e.id IN (
          SELECT DISTINCT CASE WHEN r.source_id = ? THEN r.target_id ELSE r.source_id END
          FROM relations r WHERE r.source_id = ? OR r.target_id = ?
        ) OR e.id = ?
      )`);
      params.push(Number(centerEntityId), Number(centerEntityId), Number(centerEntityId), Number(centerEntityId));
    }

    if (conditions.length > 0) {
      entitySql += ' WHERE ' + conditions.join(' AND ');
    }

    entitySql += ' GROUP BY e.id';

    const entities = db.prepare(entitySql).all(...params) as any[];

    // 构建 nodes，symbolSize 根据关系数量动态计算（最少30，最多80）
    // 前端 ALL_TYPES 顺序: person, place, event, time, official_title, institution
    const typeIndexMap: Record<string, number> = {
      person: 0,
      place: 1,
      event: 2,
      time: 3,
      official_title: 4,
      institution: 5,
    };

    const nodes = entities.map((e: any) => {
      const count = e.relation_count || 0;
      const symbolSize = Math.min(80, Math.max(30, 30 + count * 5));
      return {
        id: String(e.id),
        name: e.name,
        type: e.type,
        symbolSize,
        category: typeIndexMap[e.type] !== undefined ? typeIndexMap[e.type] : 0,
        description: e.description,
      };
    });

    // 获取相关关系
    const entityIds = entities.map((e: any) => e.id);
    let edges: any[] = [];

    if (entityIds.length > 0) {
      const placeholders = entityIds.map(() => '?').join(',');
      const edgeSql = `
        SELECT r.source_id, r.target_id, r.type, r.description
        FROM relations r
        WHERE r.source_id IN (${placeholders}) AND r.target_id IN (${placeholders})
      `;
      const relations = db.prepare(edgeSql).all(...entityIds, ...entityIds) as any[];

      edges = relations.map((r) => ({
        source: String(r.source_id),
        target: String(r.target_id),
        value: r.type,
        label: { show: true, formatter: r.type },
      }));
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        nodes,
        edges,
        categories,
      },
    });
  } catch (err) {
    console.error('[Graph Visualize Error]', err);
    res.status(500).json({ code: 500, message: '获取可视化数据失败' });
  }
});

// POST /api/graph/entities - 添加实体
router.post('/entities', (req: Request, res: Response) => {
  try {
    const { name, type, description, aliases, metadata, confidence = 0.8 } = req.body;

    if (!name || !type) {
      return res.status(400).json({ code: 400, message: '名称和类型不能为空' });
    }

    const validTypes = ['person', 'place', 'official_title', 'event', 'time', 'institution'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        code: 400,
        message: `类型无效，可选值: ${validTypes.join(', ')}`,
      });
    }

    const result = db.prepare(`
      INSERT INTO entities (name, type, description, aliases, metadata, confidence)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      name,
      type,
      description || null,
      aliases ? JSON.stringify(aliases) : null,
      metadata ? JSON.stringify(metadata) : null,
      confidence
    );

    const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: '创建成功', data: entity });
  } catch (err) {
    console.error('[Graph Entity Create Error]', err);
    res.status(500).json({ code: 500, message: '添加实体失败' });
  }
});

// DELETE /api/graph/entities/:id - 删除实体
router.delete('/entities/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(Number(id));

    if (!entity) {
      return res.status(404).json({ code: 404, message: '实体不存在' });
    }

    // 外键级联删除关联的 relations 和 material_entities
    db.prepare('DELETE FROM entities WHERE id = ?').run(Number(id));
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('[Graph Entity Delete Error]', err);
    res.status(500).json({ code: 500, message: '删除实体失败' });
  }
});

// POST /api/graph/relations - 添加关系
router.post('/relations', (req: Request, res: Response) => {
  try {
    const { source_id, target_id, type, description, confidence = 0.8, source_material_id } = req.body;

    if (!source_id || !target_id || !type) {
      return res.status(400).json({ code: 400, message: 'source_id, target_id, type 不能为空' });
    }

    // 验证两端实体存在
    const source = db.prepare('SELECT * FROM entities WHERE id = ?').get(Number(source_id));
    const target = db.prepare('SELECT * FROM entities WHERE id = ?').get(Number(target_id));

    if (!source) {
      return res.status(404).json({ code: 404, message: '源实体不存在' });
    }
    if (!target) {
      return res.status(404).json({ code: 404, message: '目标实体不存在' });
    }

    const result = db.prepare(`
      INSERT INTO relations (source_id, target_id, type, description, confidence, source_material_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      Number(source_id),
      Number(target_id),
      type,
      description || null,
      confidence,
      source_material_id || null
    );

    const relation = db.prepare('SELECT * FROM relations WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: '创建成功', data: relation });
  } catch (err) {
    console.error('[Graph Relation Create Error]', err);
    res.status(500).json({ code: 500, message: '添加关系失败' });
  }
});

// DELETE /api/graph/relations/:id - 删除关系
router.delete('/relations/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const relation = db.prepare('SELECT * FROM relations WHERE id = ?').get(Number(id));

    if (!relation) {
      return res.status(404).json({ code: 404, message: '关系不存在' });
    }

    db.prepare('DELETE FROM relations WHERE id = ?').run(Number(id));
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('[Graph Relation Delete Error]', err);
    res.status(500).json({ code: 500, message: '删除关系失败' });
  }
});

// GET /api/graph/stats - 统计各类型实体和关系数量
router.get('/stats', (_req: Request, res: Response) => {
  try {
    // 统计各类型实体数量
    const entityStats = db.prepare(`
      SELECT type, COUNT(*) as count FROM entities GROUP BY type
    `).all() as { type: string; count: number }[];

    // 统计各类型关系数量
    const relationStats = db.prepare(`
      SELECT type, COUNT(*) as count FROM relations GROUP BY type
    `).all() as { type: string; count: number }[];

    const totalEntities = entityStats.reduce((sum, s) => sum + s.count, 0);
    const totalRelations = relationStats.reduce((sum, s) => sum + s.count, 0);

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        entityCount: totalEntities,
        edgeCount: totalRelations,
        entitiesByType: entityStats.map((s) => ({
          type: s.type,
          label: TYPE_LABELS[s.type] || s.type,
          count: s.count,
        })),
        relationsByType: relationStats.map((s) => ({
          type: s.type,
          count: s.count,
        })),
      },
    });
  } catch (err) {
    console.error('[Graph Stats Error]', err);
    res.status(500).json({ code: 500, message: '获取统计数据失败' });
  }
});

export default router;
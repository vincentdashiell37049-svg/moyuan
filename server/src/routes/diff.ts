/**
 * 差异比对路由
 * 提供史料文本差异比对、纯文本比对、AI 差异分析等功能
 * 使用 diff-match-patch 库计算文本差异
 */
import { Router, Request, Response } from 'express';
import db from '../db';
import config from '../config';
const DiffMatchPatch = require('diff-match-patch');
const dmp = new DiffMatchPatch();

const router = Router();

// 内部函数：计算差异并格式化返回
function computeDiff(textA: string, textB: string) {
  const diffs = dmp.diff_main(textA, textB);
  dmp.diff_cleanupSemantic(diffs);

  let addCount = 0;
  let deleteCount = 0;
  let equalCount = 0;

  for (const [op, text] of diffs) {
    if (op === 1) {
      addCount += text.length;
    } else if (op === -1) {
      deleteCount += text.length;
    } else {
      equalCount += text.length;
    }
  }

  const formattedDiffs = diffs.map(([op, text]: [number, string]) => {
    let type: 'equal' | 'insert' | 'delete';
    if (op === 1) type = 'insert';
    else if (op === -1) type = 'delete';
    else type = 'equal';
    return { type, text };
  });

  return {
    textA,
    textB,
    diffs: formattedDiffs,
    stats: { addCount, deleteCount, equalCount },
  };
}

// POST /api/diff/compare - 比对两条史料的文本差异
router.post('/compare', (req: Request, res: Response) => {
  try {
    const { materialAId, materialBId } = req.body;

    if (!materialAId || !materialBId) {
      return res.status(400).json({ code: 400, message: 'materialAId 和 materialBId 不能为空' });
    }

    const materialA = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(materialAId)) as any;
    const materialB = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(materialBId)) as any;

    if (!materialA) {
      return res.status(404).json({ code: 404, message: `史料 ${materialAId} 不存在` });
    }
    if (!materialB) {
      return res.status(404).json({ code: 404, message: `史料 ${materialBId} 不存在` });
    }

    // 优先使用 final_text，其次 punctuated_text
    const textA = materialA.final_text || materialA.punctuated_text || '';
    const textB = materialB.final_text || materialB.punctuated_text || '';

    const result: any = computeDiff(textA, textB);
    result.materialAId = Number(materialAId);
    result.materialBId = Number(materialBId);

    res.json(result);
  } catch (err) {
    console.error('[Diff Compare Error]', err);
    res.status(500).json({ code: 500, message: '比对失败' });
  }
});

// POST /api/diff/compare-text - 比对两段纯文本
router.post('/compare-text', (req: Request, res: Response) => {
  try {
    const { textA, textB } = req.body;

    if (textA === undefined || textB === undefined) {
      return res.status(400).json({ code: 400, message: 'textA 和 textB 不能为空' });
    }

    const result = computeDiff(String(textA), String(textB));
    res.json(result);
  } catch (err) {
    console.error('[Diff Compare Text Error]', err);
    res.status(500).json({ code: 500, message: '文本比对失败' });
  }
});

// POST /api/diff/analyze - AI 分析差异原因
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { diffs, materialAId, materialBId } = req.body;

    if (!diffs || !Array.isArray(diffs)) {
      return res.status(400).json({ code: 400, message: 'diffs 不能为空且必须是数组' });
    }

    // 如果没有配置 AI_API_KEY，返回模拟分析结果
    if (!config.ai.apiKey) {
      // 统计差异信息
      const insertions = diffs.filter((d: any) => d.type === 'insert');
      const deletions = diffs.filter((d: any) => d.type === 'delete');

      const analysis = {
        summary: `共发现 ${insertions.length} 处新增内容和 ${deletions.length} 处删除内容。`,
        details: [] as string[],
        suggestions: [
          '差异可能来自不同版本的史料记载',
          '建议对比原始文献版本以确认差异来源',
          '可结合史料可信度等级进行综合判断',
        ],
      };

      // 为每处显著差异生成描述
      if (insertions.length > 0) {
        analysis.details.push(
          `新增内容共 ${insertions.reduce((s: number, d: any) => s + d.text.length, 0)} 个字符`
        );
      }
      if (deletions.length > 0) {
        analysis.details.push(
          `删除内容共 ${deletions.reduce((s: number, d: any) => s + d.text.length, 0)} 个字符`
        );
      }

      return res.json({
        ...analysis,
        mode: 'demo',
        materialAId: materialAId ? Number(materialAId) : null,
        materialBId: materialBId ? Number(materialBId) : null,
      });
    }

    // 有 API key 时调用 LLM 分析
    const diffText = diffs
      .map((d: any) => {
        const prefix = d.type === 'insert' ? '[+]' : d.type === 'delete' ? '[-]' : '[=]';
        return `${prefix} ${d.text}`;
      })
      .join('\n');

    const prompt = `你是一位专业的中国古代史文献学研究者。请分析以下两段史料的差异，指出可能的差异原因（如版本差异、传抄错误、史料来源不同等），并给出学术建议。

差异内容：
${diffText}

请用 JSON 格式返回分析结果，包含以下字段：
- summary: 一句话总结
- details: 数组，每项为一条差异分析
- suggestions: 数组，学术建议`;

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

    if (!response.ok) {
      throw new Error(`AI API 返回错误: ${response.status}`);
    }

    const data = await response.json() as any;
    let analysis;
    try {
      const content = data.choices[0].message.content;
      // 尝试解析 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = {
          summary: content,
          details: [],
          suggestions: [],
        };
      }
    } catch {
      analysis = {
        summary: data.choices[0].message.content,
        details: [],
        suggestions: [],
      };
    }

    res.json({
      ...analysis,
      mode: 'ai',
      materialAId: materialAId ? Number(materialAId) : null,
      materialBId: materialBId ? Number(materialBId) : null,
    });
  } catch (err) {
    console.error('[Diff Analyze Error]', err);
    res.status(500).json({ code: 500, message: '差异分析失败' });
  }
});

export default router;
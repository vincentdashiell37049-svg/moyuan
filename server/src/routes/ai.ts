/**
 * AI 能力路由
 * 提供繁简转换和自动标点功能
 * 繁简转换使用 opencc-js，自动标点支持 AI 和规则两种模式
 */
import { Router, Request, Response } from 'express';
import config from '../config';
const { Converter } = require('opencc-js');

const converter = Converter({ from: 'tw', to: 'cn' });

const router = Router();

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 60000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// POST /api/ai/convert - 繁简转换
router.post('/convert', (req: Request, res: Response) => {
  try {
    const { text, direction = 't2s' } = req.body;

    if (!text && text !== '') {
      return res.status(400).json({ code: 400, message: 'text 不能为空' });
    }

    let result: string;

    if (direction === 's2t') {
      // 简体转繁体
      const s2tConverter = Converter({ from: 'cn', to: 'tw' });
      result = s2tConverter(String(text));
    } else {
      // 繁体转简体（默认）
      result = converter(String(text));
    }

    res.json({
      original: String(text),
      converted: result,
      direction,
    });
  } catch (err) {
    console.error('[AI Convert Error]', err);
    res.status(500).json({ code: 500, message: '转换失败' });
  }
});

// POST /api/ai/punctuate - 自动标点
router.post('/punctuate', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ code: 400, message: 'text 不能为空' });
    }

    let punctuated: string;

    if (!config.ai.apiKey) {
      // 无 API key 时使用简单规则标点
      punctuated = simplePunctuate(String(text));
      return res.json({
        original: String(text),
        punctuated,
        mode: 'rule',
      });
    }

    // 有 API key 时调用 LLM
    const prompt = `请为以下古文添加适当的标点符号。只返回添加标点后的完整文本，不要添加任何解释、注释或额外内容。

${String(text)}`;

    const response = await fetchWithTimeout(`${config.ai.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.chatModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        thinking: { type: 'disabled' },
      }),
    });

    if (!response.ok) {
      console.error('[AI Punctuate] API error, falling back to rules:', response.status);
      punctuated = simplePunctuate(String(text));
      return res.json({
        original: String(text),
        punctuated,
        mode: 'rule',
        fallback: true,
      });
    }

    const data = await response.json() as any;
    punctuated = data.choices[0].message.content.trim();

    res.json({
      original: String(text),
      punctuated,
      mode: 'ai',
    });
  } catch (err) {
    console.error('[AI Punctuate Error]', err);
    // 出错时回退到规则标点
    const punctuated = simplePunctuate(String(req.body.text || ''));
    res.json({
      original: String(req.body.text || ''),
      punctuated,
      mode: 'rule',
      fallback: true,
      error: 'AI 标点失败，已回退到规则标点',
    });
  }
});

// POST /api/ai/punctuate-explain - 自动标点 + 白话翻译 + 断句理由
router.post('/punctuate-explain', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ code: 400, message: 'text 不能为空' });
    }

    const original = String(text).trim();

    // 未配置 AI 时回退到规则
    if (!config.ai.apiKey) {
      const punctuated = simplePunctuate(original);
      return res.json({
        original,
        punctuated,
        translation: simpleTranslate(original),
        reasoning: simpleReasoning(original, punctuated),
        mode: 'rule',
      });
    }

    const prompt = `你是一位古文标点与注释专家。请为以下古文完成三项任务，并严格按照指定格式输出：

1. 为古文添加适当的标点符号；
2. 给出白话文翻译；
3. 简要说明断句和标点的理由。

请按以下格式输出，不要添加额外内容：

【标点文本】
（添加标点后的古文）

【白话翻译】
（现代汉语翻译）

【断句理由】
（简要说明断句依据，如虚词、句式、语义层次等）

古文：
${original}`;

    const response = await fetchWithTimeout(`${config.ai.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.chatModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        thinking: { type: 'disabled' },
      }),
    });

    if (!response.ok) {
      console.error('[AI Punctuate Explain] API error, falling back to rules:', response.status);
      const punctuated = simplePunctuate(original);
      return res.json({
        original,
        punctuated,
        translation: simpleTranslate(original),
        reasoning: simpleReasoning(original, punctuated),
        mode: 'rule',
        fallback: true,
      });
    }

    const data = await response.json() as any;
    const content = data.choices[0].message.content.trim();

    // 解析 AI 返回的格式
    const punctuated = extractSection(content, '【标点文本】', '【白话翻译】') || simplePunctuate(original);
    const translation = extractSection(content, '【白话翻译】', '【断句理由】') || simpleTranslate(original);
    const reasoning = extractSection(content, '【断句理由】', '') || simpleReasoning(original, punctuated);

    res.json({
      original,
      punctuated,
      translation,
      reasoning,
      mode: 'ai',
    });
  } catch (err) {
    console.error('[AI Punctuate Explain Error]', err);
    const original = String(req.body.text || '');
    const punctuated = simplePunctuate(original);
    res.json({
      original,
      punctuated,
      translation: simpleTranslate(original),
      reasoning: simpleReasoning(original, punctuated),
      mode: 'rule',
      fallback: true,
      error: 'AI 处理失败，已回退到规则模式',
    });
  }
});

// 简单规则标点函数
function simplePunctuate(text: string): string {
  let result = text;

  // 去除已有的现代标点（保留引号和书名号等特殊符号）
  result = result.replace(/[，。！？、；：]/g, '');

  // 在「」或""引号闭合后添加句号
  result = result.replace(/(」|")([^\n。！？])/g, '$1。$2');

  // 在段尾添加句号（如果末尾不是标点）
  result = result.replace(/([^\n。！？\s」"])(\n|$)/g, '$1。$2');

  // 如果全文末尾没有标点，添加句号
  if (result.length > 0 && !/[。！？]$/.test(result)) {
    result += '。';
  }

  // 在每句中间适当添加逗号（简单的启发式规则：每8-12个字符添加逗号）
  const sentences = result.split(/。|！|？/);
  const punctuatedSentences = sentences.map((sentence) => {
    if (sentence.length <= 4) return sentence;
    let s = sentence;
    let charCount = 0;
    const resultChars: string[] = [];
    for (let i = 0; i < s.length; i++) {
      resultChars.push(s[i]);
      charCount++;
      if (charCount >= 10 && i < s.length - 1) {
        const nextChar = s[i + 1];
        if (!['」', '"', '>', '》'].includes(nextChar)) {
          resultChars.push('，');
          charCount = 0;
        }
      }
    }
    return resultChars.join('');
  });

  result = punctuatedSentences.join('。');
  if (result.length > 0 && !/[。！？]$/.test(result)) {
    result += '。';
  }

  return result;
}

function simpleTranslate(_text: string): string {
  return '（当前未配置 AI 服务，无法提供白话文翻译。请在 .env 中设置 AI_API_KEY 后重试。）';
}

function simpleReasoning(_text: string, _punctuated: string): string {
  return '（当前未配置 AI 服务，仅使用基础规则断句。规则依据：根据常见古汉语句读格式，在语义完整处添加句号，在长句适当位置添加逗号。）';
}

function extractSection(text: string, startMarker: string, endMarker: string): string | null {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return null;
  const contentStart = startIdx + startMarker.length;
  const endIdx = endMarker ? text.indexOf(endMarker, contentStart) : -1;
  const contentEnd = endIdx === -1 ? text.length : endIdx;
  const section = text.slice(contentStart, contentEnd).trim();
  // 去除可能的自身标记前缀（如 AI 重复了标签）
  return section || null;
}

export default router;

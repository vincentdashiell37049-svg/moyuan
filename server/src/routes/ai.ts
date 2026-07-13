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
  // 这个规则比较粗糙，仅作为 demo 模式的备用
  const sentences = result.split(/。|！|？/);
  const punctuatedSentences = sentences.map((sentence) => {
    if (sentence.length <= 4) return sentence;
    // 在较长的句子中间插入逗号
    let s = sentence;
    let charCount = 0;
    const resultChars: string[] = [];
    for (let i = 0; i < s.length; i++) {
      resultChars.push(s[i]);
      charCount++;
      // 大约每8-12个字添加逗号，但避免在引号、书名号处添加
      if (charCount >= 10 && i < s.length - 1) {
        const nextChar = s[i + 1];
        if (nextChar !== '」' && nextChar !== '"' && nextChar !== '>' && nextChar !== '》') {
          resultChars.push('，');
          charCount = 0;
        }
      }
    }
    return resultChars.join('');
  });

  // 重新组合
  result = punctuatedSentences.join('。');
  // 确保末尾有句号
  if (result.length > 0 && !/[。！？]$/.test(result)) {
    result += '。';
  }

  return result;
}

export default router;
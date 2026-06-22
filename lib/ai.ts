import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const MODEL = 'claude-haiku-4-5-20251001';

function getClient(apiKey?: string) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('未配置 ANTHROPIC_API_KEY');
  return new Anthropic({ apiKey: key });
}

export interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  reminders: { content: string; remind_date?: string }[];
}

export async function analyzeText(text: string, filename: string, apiKey?: string): Promise<AnalysisResult> {
  const message = await getClient(apiKey).messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `你是一个CRM客户跟进记录分析助手。请分析以下文档，提取关键信息。

文件名：${filename}
内容：
${text.substring(0, 8000)}

请以JSON格式返回（只返回JSON，不要其他内容）：
{
  "summary": "内容摘要（150字以内）",
  "keyPoints": ["重点1", "重点2", ...],
  "reminders": [{"content": "跟进事项", "remind_date": "YYYY-MM-DD或null"}]
}`,
    }],
  });
  const raw = message.content[0];
  if (raw.type !== 'text') throw new Error('AI返回格式错误');
  return JSON.parse(raw.text.replace(/```json\n?|\n?```/g, '').trim());
}

export async function analyzeImageFromBuffer(buffer: Buffer, filename: string, apiKey?: string): Promise<AnalysisResult> {
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpeg';
  const mediaMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp',
  };
  const mediaType = (mediaMap[ext] || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  const message = await getClient(apiKey).messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
        { type: 'text', text: `这是一份客户拜访相关的图片文件（${filename}）。请识别图中的文字内容并提取关键信息。\n\n以JSON格式返回（只返回JSON）：\n{"summary":"图片内容摘要","keyPoints":["重点1"],"reminders":[{"content":"跟进事项","remind_date":null}]}` },
      ],
    }],
  });
  const raw = message.content[0];
  if (raw.type !== 'text') throw new Error('AI返回格式错误');
  return JSON.parse(raw.text.replace(/```json\n?|\n?```/g, '').trim());
}

export async function analyzeImage(filePath: string, filename: string, apiKey?: string): Promise<AnalysisResult> {
  return analyzeImageFromBuffer(fs.readFileSync(filePath), filename, apiKey);
}

export async function testApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    await new Anthropic({ apiKey }).messages.create({
      model: MODEL, max_tokens: 10,
      messages: [{ role: 'user', content: 'hi' }],
    });
    return { valid: true };
  } catch (err) {
    const msg = String(err);
    if (msg.includes('401')) return { valid: false, error: 'API Key 无效（401 认证失败）' };
    if (msg.includes('403')) return { valid: false, error: 'API Key 无权限（403）' };
    if (msg.includes('429')) return { valid: true }; // rate limit means key is valid
    return { valid: false, error: msg.substring(0, 100) };
  }
}

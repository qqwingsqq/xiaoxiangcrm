import { callAI, parseAIResponse } from '@/lib/openrouter';
import fs from 'fs';

export interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  reminders: { content: string; remind_date?: string }[];
}

export async function analyzeText(text: string, filename: string): Promise<AnalysisResult> {
  const raw = await callAI([{
    role: 'user',
    content: `你是一个CRM客户跟进记录分析助手。请分析以下文档，提取关键信息。

文件名：${filename}
内容：
${text.substring(0, 8000)}

请以JSON格式返回（只返回JSON，不要其他内容）：
{
  "summary": "内容摘要（150字以内）",
  "keyPoints": ["重点1", "重点2"],
  "reminders": [{"content": "跟进事项", "remind_date": "YYYY-MM-DD或null"}]
}`,
  }], 2000);
  return parseAIResponse(raw);
}

export async function analyzeImageFromBuffer(buffer: Buffer, filename: string): Promise<AnalysisResult> {
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpeg';
  const mediaMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp',
  };
  const mediaType = mediaMap[ext] || 'image/jpeg';
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mediaType};base64,${base64}`;

  const raw = await callAI([{
    role: 'user',
    content: [
      { type: 'text', text: `这是一份客户拜访相关的图片文件（${filename}）。请识别图中的文字内容并提取关键信息。

以JSON格式返回（只返回JSON）：
{"summary":"图片内容摘要","keyPoints":["重点1"],"reminders":[{"content":"跟进事项","remind_date":null}]}` },
      { type: 'image_url', image_url: { url: dataUrl } },
    ],
  }], 2000);
  return parseAIResponse(raw);
}

export async function analyzeImage(filePath: string, filename: string): Promise<AnalysisResult> {
  return analyzeImageFromBuffer(fs.readFileSync(filePath), filename);
}

export async function testApiKey(key?: string): Promise<{ valid: boolean; error?: string }> {
  try {
    if (key) {
      // Use callAI with the provided key to test
      await callAI([{ role: 'user', content: 'hi' }], 10, key);
      return { valid: true };
    }
    await callAI([{ role: 'user', content: 'hi' }], 10);
    return { valid: true };
  } catch (err) {
    const msg = String(err);
    if (msg.includes('401')) return { valid: false, error: 'API Key 无效（401 认证失败）' };
    if (msg.includes('403')) return { valid: false, error: 'API Key 无权限（403）' };
    if (msg.includes('429')) return { valid: true };
    return { valid: false, error: msg.substring(0, 100) };
  }
}
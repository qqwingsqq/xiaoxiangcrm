import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  reminders: { content: string; remind_date?: string }[];
}

export async function analyzeText(text: string, filename: string): Promise<AnalysisResult> {
  const message = await client.messages.create({
    model: 'claude-3-haiku-20240307',
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
  const json = raw.text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(json);
}

export async function analyzeImageFromBuffer(buffer: Buffer, filename: string): Promise<AnalysisResult> {
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpeg';
  const mediaMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp',
  };
  const mediaType = (mediaMap[ext] || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  const imageData = buffer.toString('base64');
  const message = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } },
        { type: 'text', text: `这是一份客户拜访相关的图片文件（${filename}）。请识别图中的文字内容，并分析提取关键信息。\n\n以JSON格式返回（只返回JSON，不要其他内容）：\n{\n  "summary": "图片内容摘要（150字以内）",\n  "keyPoints": ["重点1", "重点2", ...],\n  "reminders": [{"content": "跟进事项", "remind_date": "YYYY-MM-DD或null"}]\n}` },
      ],
    }],
  });
  const raw = message.content[0];
  if (raw.type !== 'text') throw new Error('AI返回格式错误');
  const json = raw.text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(json);
}

export async function analyzeImage(filePath: string, filename: string): Promise<AnalysisResult> {
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpeg';
  const mediaMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp',
  };
  const mediaType = (mediaMap[ext] || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  const imageData = fs.readFileSync(filePath).toString('base64');

  const message = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } },
        {
          type: 'text',
          text: `这是一份客户拜访相关的图片文件（${filename}）。请识别图中的文字内容，并分析提取关键信息。

以JSON格式返回（只返回JSON，不要其他内容）：
{
  "summary": "图片内容摘要（150字以内）",
  "keyPoints": ["重点1", "重点2", ...],
  "reminders": [{"content": "跟进事项", "remind_date": "YYYY-MM-DD或null"}]
}`,
        },
      ],
    }],
  });

  const raw = message.content[0];
  if (raw.type !== 'text') throw new Error('AI返回格式错误');
  const json = raw.text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(json);
}

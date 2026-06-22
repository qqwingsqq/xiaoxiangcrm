import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';
type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows: [rec] } = await db.execute({ sql: 'SELECT * FROM voice_records WHERE id = ?', args: [id] });

  if (!rec) return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  if (!rec.transcript || !String(rec.transcript).trim()) return NextResponse.json({ error: '没有转写内容可以总结' }, { status: 400 });

  const { rows: keyRow } = await db.execute({ sql: `SELECT value FROM user_settings WHERE key='anthropic_key'`, args: [] });
  const apiKey = (keyRow[0]?.value as string) || process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) return NextResponse.json({ error: '未配置 Anthropic API Key，请在设置中添加' }, { status: 500 });

  const client = new Anthropic({ apiKey });

  let message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `你是一个CRM客户跟进助手。以下是一段语音记录的转写内容，请分析并提取关键信息。

转写内容：
${rec.transcript}

请以JSON格式返回（只返回JSON）：
{
  "title": "为这段记录起一个简短标题（10字以内）",
  "summary": "内容摘要（100字以内，清晰描述发生了什么）",
  "keyPoints": ["要点1", "要点2", "要点3"],
  "followUpActions": ["需要跟进的事项1", "需要跟进的事项2"]
}`,
      }],
    });
  } catch (err) {
    const msg = String(err);
    let friendly = 'AI 请求失败：' + msg;
    if (msg.includes('401')) friendly = 'API Key 无效（401），请在设置中检查 Anthropic API Key';
    else if (msg.includes('403')) friendly = 'API Key 无权限（403），请到 console.anthropic.com 重新生成';
    return NextResponse.json({ error: friendly }, { status: 500 });
  }

  const raw = message.content[0];
  if (raw.type !== 'text') return NextResponse.json({ error: 'AI 返回异常' }, { status: 500 });

  let result: { title: string; summary: string; keyPoints: string[]; followUpActions: string[] };
  try {
    result = JSON.parse(raw.text.replace(/```json\n?|\n?```/g, '').trim());
  } catch {
    return NextResponse.json({ error: 'AI 返回解析失败' }, { status: 500 });
  }

  await db.execute({
    sql: `UPDATE voice_records SET title=?, summary=?, key_points=?, status='summarized' WHERE id=?`,
    args: [result.title, result.summary, JSON.stringify(result.keyPoints), id],
  });

  const { rows: [updated] } = await db.execute({ sql: 'SELECT * FROM voice_records WHERE id = ?', args: [id] });
  return NextResponse.json(updated);
}

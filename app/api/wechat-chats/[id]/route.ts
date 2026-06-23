import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await ensureDb();
  await db.execute({ sql: 'DELETE FROM wechat_chats WHERE id = ?', args: [id] });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action } = await req.json();
  if (action !== 'analyze') return NextResponse.json({ error: 'unknown action' }, { status: 400 });

  const db = await ensureDb();
  const { rows: [chat] } = await db.execute({ sql: 'SELECT * FROM wechat_chats WHERE id = ?', args: [id] });
  if (!chat) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { rows: [settingsRow] } = await db.execute({ sql: "SELECT value FROM user_settings WHERE key = 'ai_api_key'", args: [] });
  const apiKey = settingsRow ? (settingsRow.value as string) : process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: '未配置 ANTHROPIC_API_KEY' }, { status: 400 });

  const client = new Anthropic({ apiKey });
  const raw_content = chat.raw_content as string;
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `你是一个专业CRM销售助手。请分析以下微信聊天记录，提取销售跟进的关键信息。

聊天记录：
${raw_content.substring(0, 6000)}

请以JSON格式返回（只返回JSON，不要其他内容）：
{
  "summary": "聊天内容摘要（100字以内，重点是客户需求和讨论内容）",
  "next_meeting": "下次见面/沟通计划（如：后天上午10点线下碰面，或null）",
  "discussed_features": ["功能需求1", "功能需求2"],
  "next_steps": ["下一步行动1", "下一步行动2"],
  "intent_level": "hot/warm/cold（hot=明确意向，warm=有兴趣，cold=暂无意向）",
  "key_points": ["其他重点1", "其他重点2"]
}`,
    }],
  });
  const rawText = msg.content[0];
  if (rawText.type !== 'text') return NextResponse.json({ error: 'AI返回格式错误' }, { status: 500 });
  const result = JSON.parse(rawText.text.replace(/```json\n?|\n?```/g, '').trim());

  await db.execute({
    sql: `UPDATE wechat_chats SET
      summary = ?, next_meeting = ?,
      discussed_features = ?, next_steps = ?,
      intent_level = ?, key_points = ?,
      analysis_status = 'done'
      WHERE id = ?`,
    args: [
      result.summary || '',
      result.next_meeting || null,
      JSON.stringify(result.discussed_features || []),
      JSON.stringify(result.next_steps || []),
      result.intent_level || 'unknown',
      JSON.stringify(result.key_points || []),
      id,
    ],
  });
  const { rows: [updated] } = await db.execute({ sql: 'SELECT * FROM wechat_chats WHERE id = ?', args: [id] });
  return NextResponse.json(updated);
}

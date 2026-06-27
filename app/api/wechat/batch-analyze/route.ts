import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

async function analyzeChat(content: string, apiKey: string) {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `你是一个专业CRM销售助手。请分析以下微信聊天记录，提取销售跟进的关键信息。

聊天记录：
${content.substring(0, 4000)}

请以JSON格式返回（只返回JSON，不要其他内容）：
{
  "summary": "聊天内容摘要（50字以内）",
  "next_meeting": "下次见面/沟通计划（如：后天上午10点线下碰面，或null）",
  "discussed_features": ["功能需求1"],
  "next_steps": ["下一步行动1"],
  "intent_level": "hot/warm/cold",
  "key_points": ["重点1"]
}`,
    }],
  });
  const raw = msg.content[0];
  if (raw.type !== 'text') throw new Error('AI返回格式错误');
  return JSON.parse(raw.text.replace(/```json\n?|\n?```/g, '').trim());
}

// GET: 查询待分析数量
export async function GET() {
  const db = await ensureDb();
  const { rows } = await db.execute(
    `SELECT COUNT(*) as cnt FROM wechat_chats WHERE analysis_status = 'pending'`
  );
  const total = await db.execute(`SELECT COUNT(*) as cnt FROM wechat_chats`);
  return NextResponse.json({
    pending: rows[0].cnt,
    total: total.rows[0].cnt,
  });
}

// POST: 批量分析一批（每次处理 batch_size 条）
export async function POST(req: NextRequest) {
  const { batch_size = 10 } = await req.json().catch(() => ({}));

  const db = await ensureDb();
  const { rows: [settingsRow] } = await db.execute(
    `SELECT value FROM user_settings WHERE key = 'ai_api_key'`
  );
  const apiKey = (settingsRow?.value as string) || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: '未配置 API Key' }, { status: 500 });

  const { rows: pending } = await db.execute({
    sql: `SELECT id, raw_content FROM wechat_chats WHERE analysis_status = 'pending' LIMIT ?`,
    args: [batch_size],
  });

  if (pending.length === 0) {
    return NextResponse.json({ done: true, processed: 0 });
  }

  let processed = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      const result = await analyzeChat(row.raw_content as string, apiKey);
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
          row.id,
        ],
      });
      processed++;
    } catch {
      await db.execute({
        sql: `UPDATE wechat_chats SET analysis_status = 'error' WHERE id = ?`,
        args: [row.id],
      });
      failed++;
    }
  }

  const { rows: [remaining] } = await db.execute(
    `SELECT COUNT(*) as cnt FROM wechat_chats WHERE analysis_status = 'pending'`
  );

  return NextResponse.json({
    done: (remaining.cnt as number) === 0,
    processed,
    failed,
    remaining: remaining.cnt,
  });
}

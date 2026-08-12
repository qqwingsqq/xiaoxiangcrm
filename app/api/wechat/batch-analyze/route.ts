import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { callAI, parseAIResponse, getApiKeyFromSettings } from '@/lib/openrouter';

async function analyzeChat(content: string, apiKey: string) {
  const text = await callAI([{
    role: 'user',
    content: `你是一个专业CRM销售助手。请分析以下微信聊天记录，提取销售跟进的关键信息。

聊天记录：
${content.substring(0, 4000)}

请以JSON格式返回（只返回JSON，不要其他内容）：
{
  "summary": "摘要必须包含两部分：①我方提供的信息/内容（我方说了什么、发送了什么资料）；②对方表达的态度或回应（如对方全程未回复则写"对方未回复"）。100字以内。",
  "next_meeting": "下次见面/沟通计划（如：后天上午10点线下碰面，或null）",
  "discussed_features": ["功能需求1"],
  "next_steps": ["下一步行动1"],
  "intent_level": "hot/warm/cold",
  "key_points": ["重点1"]
}`,
  }], 1000, apiKey);
  return parseAIResponse(text);
}

export async function GET(req: NextRequest) {
  let session;
  try { session = requireSession(req); } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = await ensureDb();
  const { rows } = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM wechat_chats wc
          JOIN customers c ON c.id = wc.customer_id
          WHERE (wc.analysis_status = 'pending' OR wc.analysis_status = 'error') AND (c.user_id = ? OR c.user_id IS NULL)`,
    args: [session.id],
  });
  const total = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM wechat_chats wc
          JOIN customers c ON c.id = wc.customer_id
          WHERE (c.user_id = ? OR c.user_id IS NULL)`,
    args: [session.id],
  });
  return NextResponse.json({
    pending: rows[0].cnt,
    total: total.rows[0].cnt,
  });
}

export async function POST(req: NextRequest) {
  let session;
  try { session = requireSession(req); } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { batch_size = 10 } = await req.json().catch(() => ({}));

  const db = await ensureDb();
  const { rows: [settingsRow] } = await db.execute(
    `SELECT value FROM user_settings WHERE key = 'anthropic_key'`
  );
  const apiKey = getApiKeyFromSettings(settingsRow?.value as string);

  const { rows: pending } = await db.execute({
    sql: `SELECT wc.id, wc.raw_content FROM wechat_chats wc
          JOIN customers c ON c.id = wc.customer_id
          WHERE (wc.analysis_status = 'pending' OR wc.analysis_status = 'error') AND (c.user_id = ? OR c.user_id IS NULL)
          LIMIT ?`,
    args: [session.id, batch_size],
  });

  if (pending.length === 0) {
    return NextResponse.json({ done: true, processed: 0 });
  }

  let processed = 0;
  let failed = 0;
  let lastError = '';
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
    } catch (e) {
      console.error(`[batch-analyze] Chat #${row.id} failed:`, String(e).substring(0, 300));
      lastError = String(e).substring(0, 200);
      await db.execute({
        sql: `UPDATE wechat_chats SET analysis_status = 'error' WHERE id = ?`,
        args: [row.id],
      });
      failed++;
    }
  }

  const { rows: [remaining] } = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM wechat_chats wc
          JOIN customers c ON c.id = wc.customer_id
          WHERE (wc.analysis_status = 'pending' OR wc.analysis_status = 'error') AND (c.user_id = ? OR c.user_id IS NULL)`,
    args: [session.id],
  });

  return NextResponse.json({
    done: (remaining.cnt as number) === 0,
    processed,
    failed,
    remaining: remaining.cnt,
    lastError: lastError || undefined,
  });
}
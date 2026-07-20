import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

async function analyzeWechatChat(content: string, apiKey?: string) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('未配置 ANTHROPIC_API_KEY');
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `你是一个专业CRM销售助手。请分析以下微信聊天记录，提取销售跟进的关键信息。

聊天记录：
${content.substring(0, 6000)}

请以JSON格式返回（只返回JSON，不要其他内容）：
{
  "summary": "摘要必须包含两部分：①我方提供的信息/内容（我方说了什么、发送了什么资料）；②对方表达的态度或回应（如对方全程未回复则写"对方未回复"）。100字以内。",
  "next_meeting": "下次见面/沟通计划（如：后天上午10点线下碰面，或null）",
  "discussed_features": ["功能需求1", "功能需求2"],
  "next_steps": ["下一步行动1", "下一步行动2"],
  "intent_level": "hot/warm/cold（hot=明确意向，warm=有兴趣，cold=暂无意向）",
  "key_points": ["其他重点1", "其他重点2"]
}`,
    }],
  });
  const raw = msg.content[0];
  if (raw.type !== 'text') throw new Error('AI返回格式错误');
  return JSON.parse(raw.text.replace(/```json\n?|\n?```/g, '').trim());
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = requireSession(req); } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const since     = req.nextUrl.searchParams.get('since');
  const contactId = req.nextUrl.searchParams.get('contact_id');
  const db        = await ensureDb();

  const { rows: owns } = await db.execute({
    sql: 'SELECT id FROM customers WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
    args: [id, session.id],
  });
  if (!owns.length) return NextResponse.json({ error: '客户不存在' }, { status: 404 });

  let sql = `SELECT wc.*, cc.name as contact_name, cc.id as contact_id
             FROM wechat_chats wc
             LEFT JOIN customer_contacts cc ON cc.id = wc.wechat_contact_id
             WHERE wc.customer_id = ?`;
  let args: any[] = [id];

  if (contactId) {
    if (contactId === 'none') {
      sql += ' AND wc.wechat_contact_id IS NULL';
    } else {
      sql += ' AND wc.wechat_contact_id = ?';
      args.push(contactId);
    }
  }

  if (since) {
    sql += ' AND wc.created_at > ?';
    args.push(since);
  }

  sql += ' ORDER BY wc.created_at DESC';

  const { rows } = await db.execute({ sql, args });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = requireSession(req); } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const { raw_content, chat_date, auto_analyze, wechat_contact_id } = await req.json();
  if (!raw_content?.trim()) return NextResponse.json({ error: '聊天内容不能为空' }, { status: 400 });

  const db = await ensureDb();

  const { rows: owns } = await db.execute({
    sql: 'SELECT id FROM customers WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
    args: [id, session.id],
  });
  if (!owns.length) return NextResponse.json({ error: '客户不存在' }, { status: 404 });

  if (wechat_contact_id) {
    const { rows: contactOwns } = await db.execute({
      sql: 'SELECT id FROM wechat_contacts WHERE id = ? AND customer_id = ?',
      args: [wechat_contact_id, id],
    });
    if (!contactOwns.length) return NextResponse.json({ error: '联系人不存在' }, { status: 404 });
  }

  const { rows: [{ last_id }] } = await db.execute({
    sql: `INSERT INTO wechat_chats (customer_id, wechat_contact_id, raw_content, chat_date, analysis_status)
          VALUES (?, ?, ?, ?, 'pending') RETURNING id as last_id`,
    args: [id, wechat_contact_id || null, raw_content, chat_date || null],
  });
  const chatId = last_id as number;

  if (auto_analyze) {
    try {
      const db2 = await ensureDb();
      const { rows: [settingsRow] } = await db2.execute({
        sql: "SELECT value FROM user_settings WHERE key = 'ai_api_key'",
        args: [],
      });
      const apiKey = settingsRow ? (settingsRow.value as string) : undefined;
      const result = await analyzeWechatChat(raw_content, apiKey);
      await db2.execute({
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
          chatId,
        ],
      });
      const { rows: [updated] } = await db2.execute({ sql: 'SELECT * FROM wechat_chats WHERE id = ?', args: [chatId] });
      return NextResponse.json(updated);
    } catch (err) {
      await db.execute({ sql: "UPDATE wechat_chats SET analysis_status = 'error' WHERE id = ?", args: [chatId] });
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  const { rows: [created] } = await db.execute({ sql: 'SELECT * FROM wechat_chats WHERE id = ?', args: [chatId] });
  return NextResponse.json(created);
}

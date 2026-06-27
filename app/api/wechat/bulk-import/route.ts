import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

interface MessageItem {
  date: string;       // YYYY-MM-DD
  content: string;    // formatted chat log for this day
  msg_count: number;
}

interface SessionImport {
  wxid: string;
  name: string;
  messages: MessageItem[];
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-import-secret');
  if (secret !== process.env.IMPORT_SECRET && process.env.IMPORT_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { sessions } = await req.json() as { sessions: SessionImport[] };
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return NextResponse.json({ error: 'sessions is required' }, { status: 400 });
  }

  const db = await ensureDb();
  const results = { created_customers: 0, skipped_customers: 0, inserted_chats: 0, skipped_chats: 0 };

  for (const session of sessions) {
    if (!session.wxid || !session.messages?.length) continue;

    // Find customer by wxid (stored in contact_info) or by name
    let { rows } = await db.execute({
      sql: `SELECT id FROM customers WHERE contact_info = ? OR (contact_info LIKE ? AND name = ?) LIMIT 1`,
      args: [session.wxid, `%${session.wxid}%`, session.name],
    });

    let customerId: number;
    if (rows.length > 0) {
      customerId = rows[0].id as number;
      results.skipped_customers++;
    } else {
      const insert = await db.execute({
        sql: `INSERT INTO customers (name, type, contact_info, tags) VALUES (?, '个人客户', ?, '["微信导入"]') RETURNING id`,
        args: [session.name || session.wxid, session.wxid],
      });
      customerId = insert.rows[0].id as number;
      results.created_customers++;
    }

    // Insert chat records per day
    for (const msg of session.messages) {
      const exists = await db.execute({
        sql: `SELECT id FROM wechat_chats WHERE customer_id = ? AND chat_date = ?`,
        args: [customerId, msg.date],
      });
      if (exists.rows.length > 0) {
        results.skipped_chats++;
        continue;
      }
      await db.execute({
        sql: `INSERT INTO wechat_chats (customer_id, raw_content, chat_date, analysis_status) VALUES (?, ?, ?, 'pending')`,
        args: [customerId, msg.content, msg.date],
      });
      results.inserted_chats++;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}

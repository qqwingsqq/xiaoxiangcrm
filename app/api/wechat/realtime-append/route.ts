import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { getSessionUser, getMonitorUserId } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const userId = getMonitorUserId(req) ?? getSessionUser(req)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { wxid, name, date, content } = await req.json();
  if (!wxid || !content) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

  const db = await ensureDb();

  let { rows } = await db.execute({
    sql: `SELECT id FROM customers WHERE contact_info = ? AND (user_id = ? OR user_id IS NULL) LIMIT 1`,
    args: [wxid, userId],
  });

  let customerId: number;
  let wechatContactId: number | null = null;
  if (rows.length > 0) {
    customerId = rows[0].id as number;

    // Find or create wechat contact
    const { rows: contactRows } = await db.execute({
      sql: `SELECT id FROM wechat_contacts WHERE customer_id = ? AND wxid = ? LIMIT 1`,
      args: [customerId, wxid],
    });
    if (contactRows.length > 0) {
      wechatContactId = contactRows[0].id as number;
    } else {
      const insContact = await db.execute({
        sql: `INSERT INTO wechat_contacts (customer_id, name, wxid) VALUES (?, ?, ?) RETURNING id`,
        args: [customerId, name || wxid, wxid],
      });
      wechatContactId = insContact.rows[0].id as number;
    }
  } else {
    const ins = await db.execute({
      sql: `INSERT INTO customers (name, type, contact_info, tags, user_id) VALUES (?, '个人客户', ?, '["微信导入"]', ?) RETURNING id`,
      args: [name || wxid, wxid, userId],
    });
    customerId = ins.rows[0].id as number;

    // Create default wechat contact for new customer
    const insContact = await db.execute({
      sql: `INSERT INTO wechat_contacts (customer_id, name, wxid) VALUES (?, ?, ?) RETURNING id`,
      args: [customerId, name || wxid, wxid],
    });
    wechatContactId = insContact.rows[0].id as number;
  }

  const { rows: existing } = await db.execute({
    sql: `SELECT id, raw_content FROM wechat_chats WHERE customer_id = ? AND chat_date = ? AND wechat_contact_id IS ?`,
    args: [customerId, date, wechatContactId],
  });

  if (existing.length > 0) {
    const newContent = (existing[0].raw_content as string) + '\n' + content;
    await db.execute({
      sql: `UPDATE wechat_chats SET raw_content = ?, analysis_status = 'pending' WHERE id = ?`,
      args: [newContent, existing[0].id],
    });
    return NextResponse.json({ action: 'appended', chat_id: existing[0].id });
  } else {
    const ins = await db.execute({
      sql: `INSERT INTO wechat_chats (customer_id, wechat_contact_id, raw_content, chat_date, analysis_status) VALUES (?, ?, ?, ?, 'pending') RETURNING id`,
      args: [customerId, wechatContactId, content, date],
    });
    return NextResponse.json({ action: 'created', chat_id: ins.rows[0].id });
  }
}

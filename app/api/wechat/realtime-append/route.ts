import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { wxid, name, date, content } = await req.json();
  if (!wxid || !content) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

  const db = await ensureDb();

  // 找到或新建客户
  let { rows } = await db.execute({
    sql: `SELECT id FROM customers WHERE contact_info = ? LIMIT 1`,
    args: [wxid],
  });

  let customerId: number;
  if (rows.length > 0) {
    customerId = rows[0].id as number;
  } else {
    const ins = await db.execute({
      sql: `INSERT INTO customers (name, type, contact_info, tags) VALUES (?, '个人客户', ?, '["微信导入"]') RETURNING id`,
      args: [name || wxid, wxid],
    });
    customerId = ins.rows[0].id as number;
  }

  // 查当天是否已有记录
  const { rows: existing } = await db.execute({
    sql: `SELECT id, raw_content FROM wechat_chats WHERE customer_id = ? AND chat_date = ?`,
    args: [customerId, date],
  });

  if (existing.length > 0) {
    // 追加到已有记录
    const newContent = (existing[0].raw_content as string) + '\n' + content;
    await db.execute({
      sql: `UPDATE wechat_chats SET raw_content = ?, analysis_status = 'pending' WHERE id = ?`,
      args: [newContent, existing[0].id],
    });
    return NextResponse.json({ action: 'appended', chat_id: existing[0].id });
  } else {
    // 新建当天记录
    const ins = await db.execute({
      sql: `INSERT INTO wechat_chats (customer_id, raw_content, chat_date, analysis_status) VALUES (?, ?, ?, 'pending') RETURNING id`,
      args: [customerId, content, date],
    });
    return NextResponse.json({ action: 'created', chat_id: ins.rows[0].id });
  }
}

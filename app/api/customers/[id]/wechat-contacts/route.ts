import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = requireSession(req); } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const db = await ensureDb();

  const { rows: owns } = await db.execute({
    sql: 'SELECT id FROM customers WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
    args: [id, session.id],
  });
  if (!owns.length) return NextResponse.json({ error: '客户不存在' }, { status: 404 });

  const { rows } = await db.execute({
    sql: `
      SELECT wc.*,
        (SELECT COUNT(*) FROM wechat_chats wc2 WHERE wc2.wechat_contact_id = wc.id) AS chat_count
      FROM wechat_contacts wc
      WHERE wc.customer_id = ?
      ORDER BY wc.sort_order ASC, wc.id ASC
    `,
    args: [id],
  });

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = requireSession(req); } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const { name, wxid, role, sort_order } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: '联系人姓名不能为空' }, { status: 400 });

  const db = await ensureDb();

  const { rows: owns } = await db.execute({
    sql: 'SELECT id FROM customers WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
    args: [id, session.id],
  });
  if (!owns.length) return NextResponse.json({ error: '客户不存在' }, { status: 404 });

  const { rows: [{ last_id }] } = await db.execute({
    sql: `INSERT INTO wechat_contacts (customer_id, name, wxid, role, sort_order)
          VALUES (?, ?, ?, ?, ?) RETURNING id as last_id`,
    args: [id, name.trim(), wxid || null, role || null, sort_order || 0],
  });

  const { rows: [created] } = await db.execute({
    sql: `
      SELECT wc.*,
        (SELECT COUNT(*) FROM wechat_chats wc2 WHERE wc2.wechat_contact_id = wc.id) AS chat_count
      FROM wechat_contacts wc
      WHERE wc.id = ?
    `,
    args: [last_id],
  });

  return NextResponse.json(created);
}

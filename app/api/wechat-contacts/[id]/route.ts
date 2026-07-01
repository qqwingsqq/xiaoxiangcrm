import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = requireSession(req); } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const db = await ensureDb();

  const { rows: owns } = await db.execute({
    sql: `SELECT wc.id FROM wechat_contacts wc
          JOIN customers c ON c.id = wc.customer_id
          WHERE wc.id = ? AND (c.user_id = ? OR c.user_id IS NULL)`,
    args: [id, session.id],
  });
  if (!owns.length) return NextResponse.json({ error: '联系人不存在' }, { status: 404 });

  await db.execute({
    sql: 'DELETE FROM wechat_contacts WHERE id = ?',
    args: [id],
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = requireSession(req); } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const db = await ensureDb();

  const { rows: owns } = await db.execute({
    sql: `SELECT wc.id FROM wechat_contacts wc
          JOIN customers c ON c.id = wc.customer_id
          WHERE wc.id = ? AND (c.user_id = ? OR c.user_id IS NULL)`,
    args: [id, session.id],
  });
  if (!owns.length) return NextResponse.json({ error: '联系人不存在' }, { status: 404 });

  const fields: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) {
    fields.push('name = ?');
    values.push(body.name.trim());
  }
  if (body.wxid !== undefined) {
    fields.push('wxid = ?');
    values.push(body.wxid || null);
  }
  if (body.role !== undefined) {
    fields.push('role = ?');
    values.push(body.role || null);
  }
  if (body.sort_order !== undefined) {
    fields.push('sort_order = ?');
    values.push(body.sort_order);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
  }

  values.push(id);

  await db.execute({
    sql: `UPDATE wechat_contacts SET ${fields.join(', ')} WHERE id = ?`,
    args: values,
  });

  const { rows: [updated] } = await db.execute({
    sql: `
      SELECT wc.*,
        (SELECT COUNT(*) FROM wechat_chats wc2 WHERE wc2.wechat_contact_id = wc.id) AS chat_count
      FROM wechat_contacts wc
      WHERE wc.id = ?
    `,
    args: [id],
  });

  return NextResponse.json(updated);
}

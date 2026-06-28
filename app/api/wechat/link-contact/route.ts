import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  let session;
  try { session = requireSession(req); } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const db   = await ensureDb();

  if (body.action === 'link') {
    const { source_customer_id, target_customer_id } = body;
    if (!source_customer_id || !target_customer_id)
      return NextResponse.json({ error: 'source_customer_id and target_customer_id required' }, { status: 400 });

    const { rows: srcRows } = await db.execute({
      sql:  'SELECT contact_info FROM customers WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
      args: [source_customer_id, session.id],
    });
    if (!srcRows.length)
      return NextResponse.json({ error: 'source customer not found' }, { status: 404 });

    const wxid = srcRows[0].contact_info as string;

    await db.execute({
      sql:  'UPDATE wechat_chats SET customer_id = ? WHERE customer_id = ?',
      args: [target_customer_id, source_customer_id],
    });

    await db.execute({
      sql:  'UPDATE customers SET contact_info = ? WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
      args: [wxid, target_customer_id, session.id],
    });

    await db.execute({
      sql:  'DELETE FROM customers WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
      args: [source_customer_id, session.id],
    });

    return NextResponse.json({ ok: true, action: 'linked', wxid, target_customer_id });
  }

  if (body.action === 'rename') {
    const { customer_id, name } = body;
    if (!customer_id || !name)
      return NextResponse.json({ error: 'customer_id and name required' }, { status: 400 });

    const result = await db.execute({
      sql:  'UPDATE customers SET name = ? WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
      args: [name, Number(customer_id), session.id],
    });
    if ((result.rowsAffected ?? 0) === 0)
      return NextResponse.json({ error: `未找到客户 id=${customer_id}` }, { status: 404 });
    return NextResponse.json({ ok: true, action: 'renamed' });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

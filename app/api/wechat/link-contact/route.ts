import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

/**
 * POST /api/wechat/link-contact
 *
 * 将微信联系人（by wxid）关联到目标客户，或重命名为新客户。
 *
 * Body variants:
 *   { action: 'link',   source_customer_id: number, target_customer_id: number }
 *     → 把 source 的 wechat_chats 迁移到 target，并设 target.contact_info = source.contact_info，删 source
 *
 *   { action: 'rename', customer_id: number, name: string }
 *     → 仅更新名字，保留为独立客户
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const db   = await ensureDb();

  if (body.action === 'link') {
    const { source_customer_id, target_customer_id } = body;
    if (!source_customer_id || !target_customer_id)
      return NextResponse.json({ error: 'source_customer_id and target_customer_id required' }, { status: 400 });

    // Get source contact_info
    const { rows: srcRows } = await db.execute({
      sql:  'SELECT contact_info FROM customers WHERE id = ?',
      args: [source_customer_id],
    });
    if (!srcRows.length)
      return NextResponse.json({ error: 'source customer not found' }, { status: 404 });

    const wxid = srcRows[0].contact_info as string;

    // Move wechat_chats to target
    await db.execute({
      sql:  'UPDATE wechat_chats SET customer_id = ? WHERE customer_id = ?',
      args: [target_customer_id, source_customer_id],
    });

    // Set target's contact_info
    await db.execute({
      sql:  'UPDATE customers SET contact_info = ? WHERE id = ?',
      args: [wxid, target_customer_id],
    });

    // Delete source customer
    await db.execute({
      sql:  'DELETE FROM customers WHERE id = ?',
      args: [source_customer_id],
    });

    return NextResponse.json({ ok: true, action: 'linked', wxid, target_customer_id });
  }

  if (body.action === 'rename') {
    const { customer_id, name } = body;
    if (!customer_id || !name)
      return NextResponse.json({ error: 'customer_id and name required' }, { status: 400 });

    await db.execute({
      sql:  "UPDATE customers SET name = ?, tags = json_set(COALESCE(tags,'[]'), '$[#]', '微信联系人') WHERE id = ?",
      args: [name, customer_id],
    });
    return NextResponse.json({ ok: true, action: 'renamed' });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { label, color } = await req.json() as { label?: string; color?: string };
  const db = await ensureDb();

  const updates: string[] = [];
  const args: (string | number)[] = [];
  if (label !== undefined) { updates.push('label=?'); args.push(label.trim()); }
  if (color !== undefined) { updates.push('color=?'); args.push(color); }
  if (updates.length === 0) return NextResponse.json({ error: '无可更新字段' }, { status: 400 });

  args.push(Number(id));
  await db.execute({ sql: `UPDATE customer_types SET ${updates.join(',')} WHERE id=?`, args });
  const { rows: [row] } = await db.execute({ sql: 'SELECT * FROM customer_types WHERE id=?', args: [id] });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  // Prevent deleting if customers use this type
  const { rows: [typeRow] } = await db.execute({ sql: 'SELECT key FROM customer_types WHERE id=?', args: [id] });
  if (!typeRow) return NextResponse.json({ error: '类型不存在' }, { status: 404 });

  const { rows: [countRow] } = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM customers WHERE type=?', args: [typeRow.key] });
  if ((countRow?.cnt as number) > 0) {
    return NextResponse.json({ error: `该类型下还有 ${countRow.cnt} 个客户，请先修改这些客户的类型再删除` }, { status: 400 });
  }

  await db.execute({ sql: 'DELETE FROM customer_types WHERE id=?', args: [id] });
  return NextResponse.json({ ok: true });
}

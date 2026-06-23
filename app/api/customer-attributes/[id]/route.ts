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
  await db.execute({ sql: `UPDATE customer_attributes SET ${updates.join(',')} WHERE id=?`, args });
  const { rows: [row] } = await db.execute({ sql: 'SELECT * FROM customer_attributes WHERE id=?', args: [id] });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows: [r] } = await db.execute({ sql: 'SELECT key FROM customer_attributes WHERE id=?', args: [id] });
  if (!r) return NextResponse.json({ error: '不存在' }, { status: 404 });
  const { rows: [c] } = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM customers WHERE customer_attribute=?', args: [r.key] });
  if ((c?.cnt as number) > 0) return NextResponse.json({ error: `该属性下还有 ${c.cnt} 个客户，请先修改` }, { status: 400 });
  await db.execute({ sql: 'DELETE FROM customer_attributes WHERE id=?', args: [id] });
  return NextResponse.json({ ok: true });
}

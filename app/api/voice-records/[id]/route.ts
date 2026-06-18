import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import type { InValue } from '@libsql/client';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows: [rec] } = await db.execute({
    sql: `SELECT v.*, c.name as customer_name FROM voice_records v
          LEFT JOIN customers c ON v.customer_id = c.id WHERE v.id = ?`,
    args: [id],
  });
  if (!rec) return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  return NextResponse.json(rec);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const db = await ensureDb();

  const fields: string[] = [];
  const args: InValue[] = [];

  if ('title' in body) { fields.push('title=?'); args.push(body.title); }
  if ('transcript' in body) { fields.push('transcript=?'); args.push(body.transcript); }
  if ('summary' in body) { fields.push('summary=?'); args.push(body.summary); }
  if ('key_points' in body) { fields.push('key_points=?'); args.push(JSON.stringify(body.key_points)); }
  if ('customer_id' in body) { fields.push('customer_id=?'); args.push(body.customer_id); }
  if ('follow_up_id' in body) { fields.push('follow_up_id=?'); args.push(body.follow_up_id); }
  if ('status' in body) { fields.push('status=?'); args.push(body.status); }

  if (fields.length === 0) return NextResponse.json({ error: '无更新内容' }, { status: 400 });

  args.push(id);
  await db.execute({ sql: `UPDATE voice_records SET ${fields.join(', ')} WHERE id=?`, args });

  const { rows: [updated] } = await db.execute({ sql: 'SELECT * FROM voice_records WHERE id = ?', args: [id] });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  await db.execute({ sql: 'DELETE FROM voice_records WHERE id = ?', args: [id] });
  return NextResponse.json({ success: true });
}

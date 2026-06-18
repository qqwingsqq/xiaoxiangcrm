import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows: [followUp] } = await db.execute({ sql: 'SELECT * FROM follow_ups WHERE id = ?', args: [id] });
  if (!followUp) return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  const { rows: docs } = await db.execute({ sql: 'SELECT * FROM documents WHERE follow_up_id = ?', args: [id] });
  return NextResponse.json({ ...followUp, documents: docs });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  if (!body.title?.trim()) return NextResponse.json({ error: '标题不能为空' }, { status: 400 });

  const db = await ensureDb();
  await db.execute({
    sql: `UPDATE follow_ups SET title=?, content=?, follow_up_date=? WHERE id=?`,
    args: [body.title.trim(), body.content?.trim() || null, body.follow_up_date || null, id],
  });

  const { rows: [updated] } = await db.execute({ sql: 'SELECT * FROM follow_ups WHERE id = ?', args: [id] });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  await db.execute({ sql: 'DELETE FROM follow_ups WHERE id = ?', args: [id] });
  return NextResponse.json({ success: true });
}

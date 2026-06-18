import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { is_done } = await req.json();
  const db = await ensureDb();
  await db.execute({
    sql: 'UPDATE calendar_events SET is_done = ? WHERE id = ?',
    args: [is_done, id],
  });
  const { rows: [row] } = await db.execute({
    sql: 'SELECT * FROM calendar_events WHERE id = ?',
    args: [id],
  });
  return NextResponse.json(row);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await ensureDb();
  await db.execute({ sql: 'DELETE FROM calendar_events WHERE id = ?', args: [id] });
  return NextResponse.json({ ok: true });
}

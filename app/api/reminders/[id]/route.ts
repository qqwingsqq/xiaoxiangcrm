import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const db = await ensureDb();
  if ('is_done' in body) {
    await db.execute({ sql: 'UPDATE reminders SET is_done=? WHERE id=?', args: [body.is_done ? 1 : 0, id] });
  }
  const { rows: [reminder] } = await db.execute({ sql: 'SELECT * FROM reminders WHERE id = ?', args: [id] });
  return NextResponse.json(reminder);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  await db.execute({ sql: 'DELETE FROM reminders WHERE id = ?', args: [id] });
  return NextResponse.json({ success: true });
}

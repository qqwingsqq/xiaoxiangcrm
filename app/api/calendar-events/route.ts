import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

export async function GET() {
  const db = await ensureDb();
  const { rows } = await db.execute(
    'SELECT * FROM calendar_events ORDER BY event_date, event_time'
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { title, event_date, event_time, description } = await req.json();
  if (!title || !event_date) {
    return NextResponse.json({ error: 'title and event_date required' }, { status: 400 });
  }
  const db = await ensureDb();
  const result = await db.execute({
    sql: 'INSERT INTO calendar_events (title, event_date, event_time, description) VALUES (?, ?, ?, ?)',
    args: [title, event_date, event_time || null, description || null],
  });
  const { rows: [row] } = await db.execute({
    sql: 'SELECT * FROM calendar_events WHERE id = ?',
    args: [result.lastInsertRowid!],
  });
  return NextResponse.json(row, { status: 201 });
}

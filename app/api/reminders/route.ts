import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

export async function GET() {
  const db = await ensureDb();
  const { rows } = await db.execute({
    sql: `SELECT r.*, c.name as customer_name
          FROM reminders r LEFT JOIN customers c ON r.customer_id = c.id
          WHERE r.is_done = 0
          ORDER BY r.is_done ASC, CASE WHEN r.remind_date IS NULL THEN 1 ELSE 0 END, r.remind_date ASC`,
    args: [],
  });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.content?.trim()) return NextResponse.json({ error: '内容不能为空' }, { status: 400 });

  const db = await ensureDb();
  const result = await db.execute({
    sql: `INSERT INTO reminders (customer_id, content, location, remind_date) VALUES (?, ?, ?, ?)`,
    args: [body.customer_id || null, body.content.trim(), body.location || null, body.remind_date || null],
  });

  const { rows: [reminder] } = await db.execute({ sql: 'SELECT * FROM reminders WHERE id = ?', args: [result.lastInsertRowid!] });
  return NextResponse.json(reminder, { status: 201 });
}

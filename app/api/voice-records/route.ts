import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

export async function GET() {
  const db = await ensureDb();
  const { rows } = await db.execute({
    sql: `SELECT v.*, c.name as customer_name
          FROM voice_records v
          LEFT JOIN customers c ON v.customer_id = c.id
          ORDER BY v.created_at DESC`,
    args: [],
  });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const db = await ensureDb();
  const result = await db.execute({
    sql: `INSERT INTO voice_records (title, transcript, duration, status) VALUES (?, ?, ?, 'recorded')`,
    args: [body.title || null, body.transcript || null, body.duration || null],
  });
  const { rows: [rec] } = await db.execute({ sql: 'SELECT * FROM voice_records WHERE id = ?', args: [result.lastInsertRowid!] });
  return NextResponse.json(rec, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows } = await db.execute({
    sql: `SELECT f.*,
            (SELECT COUNT(*) FROM documents d WHERE d.follow_up_id = f.id) as doc_count
          FROM follow_ups f WHERE f.customer_id = ? ORDER BY f.created_at DESC`,
    args: [id],
  });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  if (!body.title?.trim()) {
    return NextResponse.json({ error: '请填写跟进标题' }, { status: 400 });
  }

  const db = await ensureDb();
  const { rows: exists } = await db.execute({ sql: 'SELECT id FROM customers WHERE id = ?', args: [id] });
  if (!exists[0]) return NextResponse.json({ error: '客户不存在' }, { status: 404 });

  const result = await db.execute({
    sql: `INSERT INTO follow_ups (customer_id, title, content, follow_up_date) VALUES (?, ?, ?, ?)`,
    args: [id, body.title.trim(), body.content?.trim() || null, body.follow_up_date || null],
  });

  const { rows } = await db.execute({ sql: 'SELECT * FROM follow_ups WHERE id = ?', args: [result.lastInsertRowid!] });
  return NextResponse.json(rows[0], { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function GET() {
  const db = await ensureDb();
  const { rows } = await db.execute('SELECT * FROM customer_statuses ORDER BY sort_order, id');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { label, shape, color } = await req.json() as { label: string; shape?: string; color?: string };
  if (!label?.trim()) return NextResponse.json({ error: '请填写状态名称' }, { status: 400 });
  const db = await ensureDb();
  const key = `status_${randomUUID().slice(0, 8)}`;
  const { rows: [maxRow] } = await db.execute('SELECT MAX(sort_order) as m FROM customer_statuses');
  const sortOrder = ((maxRow?.m as number) || 0) + 1;
  const result = await db.execute({
    sql: 'INSERT INTO customer_statuses (key,label,shape,color,sort_order) VALUES (?,?,?,?,?)',
    args: [key, label.trim(), shape || 'circle', color || '#6b7280', sortOrder],
  });
  const { rows: [row] } = await db.execute({ sql: 'SELECT * FROM customer_statuses WHERE id=?', args: [result.lastInsertRowid!] });
  return NextResponse.json(row, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function GET() {
  const db = await ensureDb();
  const { rows } = await db.execute('SELECT * FROM customer_attributes ORDER BY sort_order, id');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { label, color } = await req.json() as { label: string; color?: string };
  if (!label?.trim()) return NextResponse.json({ error: '请填写属性名称' }, { status: 400 });
  const db = await ensureDb();
  const key = `attr_${randomUUID().slice(0, 8)}`;
  const { rows: [maxRow] } = await db.execute('SELECT MAX(sort_order) as m FROM customer_attributes');
  const sortOrder = ((maxRow?.m as number) || 0) + 1;
  const result = await db.execute({
    sql: 'INSERT INTO customer_attributes (key,label,color,sort_order) VALUES (?,?,?,?)',
    args: [key, label.trim(), color || '#6b7280', sortOrder],
  });
  const { rows: [row] } = await db.execute({ sql: 'SELECT * FROM customer_attributes WHERE id=?', args: [result.lastInsertRowid!] });
  return NextResponse.json(row, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, CustomerInput } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const type = searchParams.get('type') || '';

  const db = await ensureDb();
  let sql = 'SELECT * FROM customers WHERE 1=1';
  const args: string[] = [];

  if (search) {
    sql += ' AND name LIKE ?';
    args.push(`%${search}%`);
  }
  if (type) {
    sql += ' AND type = ?';
    args.push(type);
  }
  sql += ' ORDER BY created_at DESC';

  const { rows } = await db.execute({ sql, args });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body: CustomerInput = await request.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: '客户名称不能为空' }, { status: 400 });
  }
  if (!body.type) {
    return NextResponse.json({ error: '请选择客户类型' }, { status: 400 });
  }

  const db = await ensureDb();
  const result = await db.execute({
    sql: `INSERT INTO customers (name, type, address, contact_name, contact_info, tags) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      body.name.trim(),
      body.type,
      body.address?.trim() || null,
      body.contact_name?.trim() || null,
      body.contact_info?.trim() || null,
      JSON.stringify(body.tags || []),
    ],
  });

  const { rows } = await db.execute({ sql: 'SELECT * FROM customers WHERE id = ?', args: [result.lastInsertRowid!] });
  return NextResponse.json(rows[0], { status: 201 });
}

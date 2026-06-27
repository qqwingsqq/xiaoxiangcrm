import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, CustomerInput } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const type = searchParams.get('type') || '';
  const attribute = searchParams.get('attribute') || '';
  const status = searchParams.get('status') || '';

  const db = await ensureDb();
  let sql = 'SELECT * FROM customers WHERE (is_blocked = 0 OR is_blocked IS NULL)';
  const args: string[] = [];

  if (search) { sql += ' AND name LIKE ?'; args.push(`%${search}%`); }
  if (type) { sql += ' AND type = ?'; args.push(type); }
  if (attribute) { sql += ' AND customer_attribute = ?'; args.push(attribute); }
  if (status) { sql += ' AND customer_status = ?'; args.push(status); }
  sql += ' ORDER BY created_at DESC';

  const { rows } = await db.execute({ sql, args });
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body: CustomerInput = await request.json();

  if (!body.name?.trim()) return NextResponse.json({ error: '客户名称不能为空' }, { status: 400 });
  if (!body.customer_attribute) return NextResponse.json({ error: '请选择客户属性' }, { status: 400 });
  if (!body.customer_status) return NextResponse.json({ error: '请选择客户状态' }, { status: 400 });

  const db = await ensureDb();
  const result = await db.execute({
    sql: `INSERT INTO customers (name, type, customer_attribute, customer_status, address, contact_name, contact_info, wechat_id, tags)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      body.name.trim(),
      body.customer_attribute, // keep type in sync for backward compat
      body.customer_attribute,
      body.customer_status,
      body.address?.trim() || null,
      body.contact_name?.trim() || null,
      body.contact_info?.trim() || null,
      body.wechat_id?.trim() || null,
      JSON.stringify(body.tags || []),
    ],
  });

  const { rows } = await db.execute({ sql: 'SELECT * FROM customers WHERE id = ?', args: [result.lastInsertRowid!] });
  return NextResponse.json(rows[0], { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, CustomerInput } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows } = await db.execute({ sql: 'SELECT * FROM customers WHERE id = ?', args: [id] });
  if (!rows[0]) return NextResponse.json({ error: '客户不存在' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body: CustomerInput = await request.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: '客户名称不能为空' }, { status: 400 });
  }
  if (!body.type) {
    return NextResponse.json({ error: '请选择客户类型' }, { status: 400 });
  }

  const db = await ensureDb();
  const { rows: exists } = await db.execute({ sql: 'SELECT id FROM customers WHERE id = ?', args: [id] });
  if (!exists[0]) return NextResponse.json({ error: '客户不存在' }, { status: 404 });

  await db.execute({
    sql: `UPDATE customers SET name=?, type=?, address=?, contact_name=?, contact_info=?, tags=?,
          updated_at=datetime('now','localtime') WHERE id=?`,
    args: [
      body.name.trim(),
      body.type,
      body.address?.trim() || null,
      body.contact_name?.trim() || null,
      body.contact_info?.trim() || null,
      JSON.stringify(body.tags || []),
      id,
    ],
  });

  const { rows } = await db.execute({ sql: 'SELECT * FROM customers WHERE id = ?', args: [id] });
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows: exists } = await db.execute({ sql: 'SELECT id FROM customers WHERE id = ?', args: [id] });
  if (!exists[0]) return NextResponse.json({ error: '客户不存在' }, { status: 404 });
  await db.execute({ sql: 'DELETE FROM customers WHERE id = ?', args: [id] });
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import path from 'path';
import fs from 'fs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows: [doc] } = await db.execute({ sql: 'SELECT * FROM documents WHERE id = ?', args: [id] });
  if (!doc) return NextResponse.json({ error: '文档不存在' }, { status: 404 });
  return NextResponse.json(doc);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows: [doc] } = await db.execute({ sql: 'SELECT * FROM documents WHERE id = ?', args: [id] });
  if (!doc) return NextResponse.json({ error: '文档不存在' }, { status: 404 });

  const filePath = path.join(process.cwd(), 'uploads', String(doc.stored_name));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await db.execute({ sql: 'DELETE FROM documents WHERE id = ?', args: [id] });
  return NextResponse.json({ success: true });
}

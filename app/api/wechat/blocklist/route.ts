import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

export async function GET() {
  const db = await ensureDb();
  const { rows } = await db.execute('SELECT * FROM wechat_blocklist ORDER BY created_at DESC');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { wxid, name } = await req.json();
  if (!wxid) return NextResponse.json({ error: 'wxid required' }, { status: 400 });
  const db = await ensureDb();
  await db.execute({
    sql: 'INSERT OR REPLACE INTO wechat_blocklist (wxid, name) VALUES (?, ?)',
    args: [wxid, name || wxid],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { wxid } = await req.json();
  const db = await ensureDb();
  await db.execute({ sql: 'DELETE FROM wechat_blocklist WHERE wxid = ?', args: [wxid] });
  return NextResponse.json({ ok: true });
}

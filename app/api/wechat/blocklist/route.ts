import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { getMonitorUserId, requireSession } from '@/lib/auth';

function getUser(req: NextRequest): number | null {
  return getMonitorUserId(req) ?? ((() => { try { return requireSession(req).id; } catch { return null; } })());
}

export async function GET(req: NextRequest) {
  const userId = getUser(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = await ensureDb();
  const { rows } = await db.execute('SELECT * FROM wechat_blocklist ORDER BY created_at DESC');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const userId = getUser(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { wxid, name } = await req.json();
  if (!wxid) return NextResponse.json({ error: 'wxid required' }, { status: 400 });
  const db = await ensureDb();
  await db.execute({
    sql: 'INSERT OR REPLACE INTO wechat_blocklist (wxid, name) VALUES (?, ?)',
    args: [wxid, name || wxid],
  });
  await db.execute({
    sql: 'UPDATE customers SET is_blocked = 1 WHERE contact_info = ? AND (user_id = ? OR user_id IS NULL)',
    args: [wxid, userId],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = getUser(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { wxid } = await req.json();
  const db = await ensureDb();
  await db.execute({ sql: 'DELETE FROM wechat_blocklist WHERE wxid = ?', args: [wxid] });
  await db.execute({
    sql: 'UPDATE customers SET is_blocked = 0 WHERE contact_info = ? AND (user_id = ? OR user_id IS NULL)',
    args: [wxid, userId],
  });
  return NextResponse.json({ ok: true });
}

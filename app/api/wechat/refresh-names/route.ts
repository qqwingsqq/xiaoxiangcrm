import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { getMonitorUserId, getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const userId = getMonitorUserId(req) ?? getSessionUser(req)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { updates } = await req.json() as { updates: { wxid: string; name: string }[] };
  if (!Array.isArray(updates)) return NextResponse.json({ error: 'updates required' }, { status: 400 });

  const db = await ensureDb();
  let updated = 0;

  for (const { wxid, name } of updates) {
    if (!wxid || !name) continue;
    const result = await db.execute({
      sql: `UPDATE customers SET name = ? WHERE contact_info = ? AND (user_id = ? OR user_id IS NULL)`,
      args: [name, wxid, userId],
    });
    if ((result.rowsAffected ?? 0) > 0) updated++;
  }

  return NextResponse.json({ ok: true, updated });
}

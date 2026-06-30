import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = getSessionUser(req);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = await ensureDb();
  const { rows } = await db.execute({
    sql: 'SELECT id, username, display_name, phone, email, created_at FROM users WHERE id = ?',
    args: [session.id],
  });
  if (!rows.length) return NextResponse.json({ error: 'user not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

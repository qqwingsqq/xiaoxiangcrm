import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

const ALLOWED_KEYS = new Set([
  'display_name', 'phone', 'email', 'company', 'title', 'wechat_id',
  'amap_key', 'amap_security', 'theme', 'record_shortcut', 'password_hash',
  'anthropic_key',
]);

export async function GET(req: NextRequest) {
  const db = await ensureDb();
  const { rows } = await db.execute('SELECT key, value FROM user_settings');
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key as string] = row.value as string;
  }
  const session = getSessionUser(req);
  if (session) {
    const { rows: userRows } = await db.execute({
      sql: 'SELECT display_name, phone, email FROM users WHERE id = ?',
      args: [session.id],
    });
    const user = userRows[0];
    if (user) {
      if (user.display_name) result.display_name = user.display_name as string;
      if (user.phone) result.phone = user.phone as string;
      if (user.email) result.email = user.email as string;
    }
  }
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, string>;
  const db = await ensureDb();
  const entries = Object.entries(body).filter(([k]) => ALLOWED_KEYS.has(k));
  if (entries.length === 0) return NextResponse.json({ ok: true });

  for (const [key, value] of entries) {
    await db.execute({
      sql: `INSERT INTO user_settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now','localtime')`,
      args: [key, value ?? ''],
    });
  }
  const session = getSessionUser(req);
  if (session && ('display_name' in body || 'phone' in body || 'email' in body)) {
    await db.execute({
      sql: `UPDATE users
            SET display_name = COALESCE(?, display_name),
                phone = COALESCE(?, phone),
                email = COALESCE(?, email)
            WHERE id = ?`,
      args: [
        body.display_name?.trim() || null,
        body.phone?.trim() || null,
        body.email?.trim().toLowerCase() || null,
        session.id,
      ],
    });
  }
  return NextResponse.json({ ok: true });
}

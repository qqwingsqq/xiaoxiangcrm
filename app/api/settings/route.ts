import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

const ALLOWED_KEYS = new Set([
  'display_name', 'phone', 'company', 'title', 'wechat_id',
  'amap_key', 'amap_security', 'theme', 'record_shortcut',
]);

export async function GET() {
  const db = await ensureDb();
  const { rows } = await db.execute('SELECT key, value FROM user_settings');
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key as string] = row.value as string;
  }
  return NextResponse.json(result);
}

export async function POST(req: Request) {
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
  return NextResponse.json({ ok: true });
}

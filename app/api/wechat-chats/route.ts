import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = await ensureDb();
  const since = req.nextUrl.searchParams.get('since');

  if (since) {
    const { rows } = await db.execute({
      sql: `SELECT wc.id, wc.customer_id, wc.created_at, c.name as customer_name
            FROM wechat_chats wc
            JOIN customers c ON c.id = wc.customer_id
            WHERE wc.created_at > ? AND (c.is_blocked = 0 OR c.is_blocked IS NULL)
            ORDER BY wc.created_at DESC`,
      args: [since],
    });
    return NextResponse.json(rows);
  }

  const { rows } = await db.execute(`
    SELECT wc.*, c.name as customer_name, c.contact_name, c.contact_info as customer_wxid, c.customer_status, c.customer_attribute
    FROM wechat_chats wc
    JOIN customers c ON c.id = wc.customer_id
    WHERE (c.is_blocked = 0 OR c.is_blocked IS NULL)
    ORDER BY wc.created_at DESC
  `);
  return NextResponse.json(rows);
}

import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

export async function GET() {
  const db = await ensureDb();
  const { rows } = await db.execute(`
    SELECT wc.*, c.name as customer_name, c.contact_name, c.customer_status, c.customer_attribute
    FROM wechat_chats wc
    JOIN customers c ON c.id = wc.customer_id
    ORDER BY wc.created_at DESC
  `);
  return NextResponse.json(rows);
}

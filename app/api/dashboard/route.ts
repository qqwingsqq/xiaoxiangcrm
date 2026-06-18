import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

export async function GET() {
  const db = await ensureDb();

  const [
    { rows: customerStats },
    { rows: [totalRow] },
    { rows: recentFollowUps },
    { rows: pendingReminders },
    { rows: customerLocations },
    { rows: customersByType },
    { rows: recentCustomers },
  ] = await Promise.all([
    db.execute({ sql: `SELECT type, COUNT(*) as count FROM customers GROUP BY type`, args: [] }),
    db.execute({ sql: `SELECT COUNT(*) as n FROM customers`, args: [] }),
    db.execute({
      sql: `SELECT f.*, c.name as customer_name, c.type as customer_type
            FROM follow_ups f JOIN customers c ON f.customer_id = c.id
            ORDER BY f.created_at DESC LIMIT 5`,
      args: [],
    }),
    db.execute({
      sql: `SELECT r.*, c.name as customer_name
            FROM reminders r JOIN customers c ON r.customer_id = c.id
            WHERE r.is_done = 0
            ORDER BY CASE WHEN r.remind_date IS NULL THEN 1 ELSE 0 END, r.remind_date ASC
            LIMIT 10`,
      args: [],
    }),
    db.execute({
      sql: `SELECT id, name, type, address FROM customers WHERE address IS NOT NULL AND address != ''`,
      args: [],
    }),
    db.execute({
      sql: `SELECT type, COUNT(*) as count FROM customers GROUP BY type ORDER BY count DESC`,
      args: [],
    }),
    db.execute({
      sql: `SELECT id, name, type, contact_name, contact_info, created_at FROM customers ORDER BY created_at DESC LIMIT 6`,
      args: [],
    }),
  ]);

  return NextResponse.json({
    totalCustomers: Number(totalRow?.n ?? 0),
    customerStats,
    recentFollowUps,
    pendingReminders,
    customerLocations,
    customersByType,
    recentCustomers,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  let session;
  try { session = requireSession(req); } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const uid = session.id;

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
    db.execute({
      sql: `SELECT type, COUNT(*) as count FROM customers WHERE (user_id = ? OR user_id IS NULL) GROUP BY type`,
      args: [uid],
    }),
    db.execute({
      sql: `SELECT COUNT(*) as n FROM customers WHERE (user_id = ? OR user_id IS NULL)`,
      args: [uid],
    }),
    db.execute({
      sql: `SELECT f.*, c.name as customer_name, c.type as customer_type
            FROM follow_ups f JOIN customers c ON f.customer_id = c.id
            WHERE (c.user_id = ? OR c.user_id IS NULL)
            ORDER BY f.created_at DESC LIMIT 5`,
      args: [uid],
    }),
    db.execute({
      sql: `SELECT r.*, c.name as customer_name
            FROM reminders r LEFT JOIN customers c ON r.customer_id = c.id
            WHERE r.is_done = 0 AND (c.user_id = ? OR c.user_id IS NULL OR r.customer_id IS NULL)
            ORDER BY CASE WHEN r.remind_date IS NULL THEN 1 ELSE 0 END, r.remind_date ASC
            LIMIT 10`,
      args: [uid],
    }),
    db.execute({
      sql: `SELECT id, name, type, address FROM customers WHERE address IS NOT NULL AND address != '' AND (user_id = ? OR user_id IS NULL)`,
      args: [uid],
    }),
    db.execute({
      sql: `SELECT type, COUNT(*) as count FROM customers WHERE (user_id = ? OR user_id IS NULL) GROUP BY type ORDER BY count DESC`,
      args: [uid],
    }),
    db.execute({
      sql: `SELECT id, name, type, contact_name, contact_info, created_at FROM customers WHERE (user_id = ? OR user_id IS NULL) ORDER BY created_at DESC LIMIT 6`,
      args: [uid],
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

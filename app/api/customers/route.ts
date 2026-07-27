import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, CustomerInput } from '@/lib/db';
import { requireSession, getMonitorUserId, getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const userId = getMonitorUserId(request) ?? getSessionUser(request)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const type = searchParams.get('type') || '';
  const attribute = searchParams.get('attribute') || '';
  const status = searchParams.get('status') || '';

  const db = await ensureDb();
  let sql = 'SELECT * FROM customers WHERE (is_blocked = 0 OR is_blocked IS NULL) AND (user_id = ? OR user_id IS NULL)';
  const args: (string | number)[] = [userId];

  if (search) { sql += ' AND name LIKE ?'; args.push(`%${search}%`); }
  if (type) { sql += ' AND type = ?'; args.push(type); }
  if (attribute) { sql += ' AND customer_attribute = ?'; args.push(attribute); }
  if (status) { sql += ' AND customer_status = ?'; args.push(status); }
  sql += ' ORDER BY created_at DESC';

  const { rows } = await db.execute({ sql, args });
  const enriched = rows as any[];

  // 批量补全聊天统计
  if (enriched.length > 0) {
    const customerIds = enriched.map((r: any) => r.id as number);
    const placeholders = customerIds.map(() => '?').join(',');

    const { rows: chatStats } = await db.execute({
      sql: `SELECT customer_id, COUNT(*) as chat_count, MAX(chat_date) as last_chat_date FROM wechat_chats WHERE customer_id IN (${placeholders}) GROUP BY customer_id`,
      args: customerIds,
    });
    const statsMap = Object.fromEntries((chatStats as any[]).map((s: any) => [s.customer_id, s]));
    for (const r of enriched as any[]) {
      const stats = statsMap[r.id as number];
      if (stats) {
        r.last_chat_date = stats.last_chat_date;
        r.chat_count = stats.chat_count;
      }
    }

    // 批量获取每个客户最近10条聊天记录（含总结和提醒）
    const { rows: recentChats } = await db.execute({
      sql: `SELECT wc.customer_id, wc.summary, wc.next_action, wc.chat_date, wc.created_at
            FROM wechat_chats wc
            WHERE wc.customer_id IN (${placeholders})
            ORDER BY wc.customer_id, wc.chat_date DESC, wc.created_at DESC`,
      args: customerIds,
    });
    // 按 customer_id 分组，每组取最近10条
    const recentMap: Record<number, any[]> = {};
    for (const row of recentChats as any[]) {
      const cid = row.customer_id as number;
      if (!recentMap[cid]) recentMap[cid] = [];
      if (recentMap[cid].length < 10) recentMap[cid].push(row);
    }

    for (const r of enriched as any[]) {
      const recents = recentMap[r.id as number] || [];

      // 优先查找最近10条中是否有提醒（next_action）
      const reminder = recents.find(c => c.next_action && c.next_action.trim());
      if (reminder) {
        r.last_chat_summary = `📋 ${reminder.next_action.trim()}`;
      } else {
        // 无提醒则显示最近一条有总结的
        const withSummary = recents.find(c => c.summary && c.summary.trim());
        if (withSummary) {
          r.last_chat_summary = withSummary.summary;
        }
      }

      // 取最新一条的日期
      const latest = recents[0];
      if (latest?.chat_date) r.last_chat_date = latest.chat_date;
    }
  }

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  let sessionUserId: number;
  try { sessionUserId = requireSession(request).id; } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body: CustomerInput = await request.json();

  if (!body.name?.trim()) return NextResponse.json({ error: '客户名称不能为空' }, { status: 400 });
  if (!body.customer_attribute) return NextResponse.json({ error: '请选择客户属性' }, { status: 400 });
  if (!body.customer_status) return NextResponse.json({ error: '请选择客户状态' }, { status: 400 });

  const db = await ensureDb();
  const result = await db.execute({
    sql: `INSERT INTO customers (name, type, customer_attribute, customer_status, address, contact_name, contact_info, wechat_id, tags, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      body.name.trim(),
      body.customer_attribute,
      body.customer_attribute,
      body.customer_status,
      body.address?.trim() || null,
      body.contact_name?.trim() || null,
      body.contact_info?.trim() || null,
      body.wechat_id?.trim() || null,
      JSON.stringify(body.tags || []),
      sessionUserId,
    ],
  });

  const { rows } = await db.execute({ sql: 'SELECT * FROM customers WHERE id = ?', args: [result.lastInsertRowid!] });
  return NextResponse.json(rows[0], { status: 201 });
}

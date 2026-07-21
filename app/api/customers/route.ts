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

    // 批量获取每个客户的最近聊天内容 + 联系人
    const { rows: lastChats } = await db.execute({
      sql: `SELECT wc.customer_id, wc.raw_content, wc.summary, wc.chat_date, wcc.name as contact_name
            FROM wechat_chats wc
            LEFT JOIN wechat_contacts wcc ON wcc.id = wc.wechat_contact_id
            INNER JOIN (
              SELECT customer_id, MAX(chat_date || '-' || created_at) as max_key
              FROM wechat_chats WHERE customer_id IN (${placeholders})
              GROUP BY customer_id
            ) latest ON wc.customer_id = latest.customer_id
              AND (wc.chat_date || '-' || wc.created_at) = latest.max_key`,
      args: customerIds,
    });
    const chatMap = Object.fromEntries((lastChats as any[]).map(c => [c.customer_id, c]));
    for (const r of enriched as any[]) {
      const chat = chatMap[r.id as number];
      if (chat) {
        if (chat.summary) {
          r.last_chat_summary = chat.summary;
        } else if (chat.raw_content) {
          const lines = chat.raw_content.split('\n').filter((l: string) => l.trim());
          r.last_chat_summary = lines.slice(-3).join(' ');
        }
        if (chat.chat_date) r.last_chat_date = chat.chat_date;
        if (chat.contact_name) r.last_contact_name = chat.contact_name;
      }
    }

    // 批量获取每个客户的主要联系人（聊天记录最多的）
    const { rows: contactStats } = await db.execute({
      sql: `SELECT wcc.customer_id, wcc.name, COUNT(wc.id) as cnt
            FROM wechat_contacts wcc
            INNER JOIN wechat_chats wc ON wc.wechat_contact_id = wcc.id
            WHERE wcc.customer_id IN (${placeholders})
            GROUP BY wcc.id
            ORDER BY cnt DESC`,
      args: customerIds,
    });
    // 按 customer_id 取第一个（最多的）
    const mainContactMap: Record<number, string> = {};
    for (const row of contactStats as any[]) {
      const cid = row.customer_id as number;
      if (!mainContactMap[cid]) mainContactMap[cid] = row.name;
    }
    for (const r of enriched as any[]) {
      r.main_contact = mainContactMap[r.id as number] || null;
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

import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db    = await ensureDb();
  const since = req.nextUrl.searchParams.get('since');

  // 轮询新消息时，只返回增量（用于 badge 计数）
  if (since) {
    const { rows } = await db.execute({
      sql: `SELECT wc.customer_id, c.name as customer_name, MAX(wc.created_at) as created_at
            FROM wechat_chats wc
            JOIN customers c ON c.id = wc.customer_id
            WHERE wc.created_at > ? AND (c.is_blocked = 0 OR c.is_blocked IS NULL)
            GROUP BY wc.customer_id`,
      args: [since],
    });
    return NextResponse.json(rows);
  }

  // 主列表：每个客户只返回最新一条记录，附带聊天总数
  const { rows } = await db.execute(`
    SELECT
      wc.id, wc.customer_id, wc.chat_date, wc.created_at,
      wc.raw_content, wc.summary, wc.next_meeting,
      wc.discussed_features, wc.next_steps, wc.intent_level, wc.analysis_status,
      c.name         AS customer_name,
      c.contact_name AS contact_name,
      c.contact_info AS customer_wxid,
      c.customer_status,
      c.customer_attribute,
      (SELECT COUNT(*) FROM wechat_chats w2 WHERE w2.customer_id = wc.customer_id) AS total_chats,
      (SELECT MAX(w3.chat_date) FROM wechat_chats w3 WHERE w3.customer_id = wc.customer_id) AS latest_date
    FROM wechat_chats wc
    JOIN customers c ON c.id = wc.customer_id
    WHERE (c.is_blocked = 0 OR c.is_blocked IS NULL)
      -- 每个客户只取最新一条（按聊天日期最近）
      AND wc.id = (
        SELECT w4.id FROM wechat_chats w4
        WHERE w4.customer_id = wc.customer_id
        ORDER BY w4.chat_date DESC, w4.created_at DESC
        LIMIT 1
      )
    ORDER BY latest_date DESC, wc.created_at DESC
  `);
  return NextResponse.json(rows);
}

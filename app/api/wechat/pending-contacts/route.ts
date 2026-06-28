import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

// 返回尚未关联真实客户的微信导入联系人
// 条件：contact_info 不为空，且 name 看起来像 wxid（等于 contact_info，或以 wxid_ 开头，或包含 @chatroom）
export async function GET() {
  const db = await ensureDb();
  const { rows } = await db.execute(`
    SELECT c.id, c.name, c.contact_info, c.tags, c.created_at,
           COUNT(wc.id) as chat_count
    FROM customers c
    LEFT JOIN wechat_chats wc ON wc.customer_id = c.id
    WHERE c.contact_info IS NOT NULL
      AND c.contact_info != ''
      AND (
        c.name = c.contact_info
        OR c.name LIKE 'wxid_%'
        OR c.name LIKE '%\_%\_%\_%'
      )
      AND (c.is_blocked = 0 OR c.is_blocked IS NULL)
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
  return NextResponse.json(rows);
}

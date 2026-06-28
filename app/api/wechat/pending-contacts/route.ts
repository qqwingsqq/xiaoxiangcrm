import { NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

function looksLikeRealName(name: string): boolean {
  // 包含中文字符 → 是真实姓名
  if (/[一-鿿]/.test(name)) return true;
  // 含空格（英文名）→ 视为真实姓名
  if (name.includes(' ')) return true;
  // 纯字母+数字+下划线，且没有中文 → 是 wxid / alias
  return false;
}

export async function GET() {
  const db = await ensureDb();
  const { rows } = await db.execute(`
    SELECT c.id, c.name, c.contact_info, c.tags, c.created_at,
           COUNT(wc.id) as chat_count
    FROM customers c
    LEFT JOIN wechat_chats wc ON wc.customer_id = c.id
    WHERE c.contact_info IS NOT NULL
      AND c.contact_info != ''
      AND (c.is_blocked = 0 OR c.is_blocked IS NULL)
      AND c.tags LIKE '%微信导入%'
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);

  // JS 侧过滤：名字看起来不是真实姓名的
  const pending = rows.filter(r => !looksLikeRealName(String(r.name || '')));
  return NextResponse.json(pending);
}

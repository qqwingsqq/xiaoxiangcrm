import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';

function looksLikeRealName(name: string): boolean {
  if (/[一-鿿]/.test(name)) return true;
  if (name.includes(' ')) return true;
  return false;
}

export async function GET(req: NextRequest) {
  let session;
  try { session = requireSession(req); } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = await ensureDb();
  const { rows } = await db.execute({
    sql: `
      SELECT c.id, c.name, c.contact_info, c.tags, c.created_at,
             COUNT(wc.id) as chat_count,
             MAX(wc.raw_content) as latest_chat,
             MAX(wc.chat_date) as latest_date
      FROM customers c
      LEFT JOIN wechat_chats wc ON wc.customer_id = c.id
      WHERE c.contact_info IS NOT NULL
        AND c.contact_info != ''
        AND (c.is_blocked = 0 OR c.is_blocked IS NULL)
        AND c.tags LIKE '%微信导入%'
        AND (c.user_id = ? OR c.user_id IS NULL)
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `,
    args: [session.id],
  });

  const pending = rows.filter(r => !looksLikeRealName(String(r.name || '')));
  return NextResponse.json(pending);
}

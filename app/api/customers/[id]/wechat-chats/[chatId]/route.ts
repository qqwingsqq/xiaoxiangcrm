import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chatId: string }> }
) {
  const session = getSessionUser(req);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id, chatId } = await params;
  const { wechat_contact_id } = await req.json();

  const db = await ensureDb();

  // 验证客户所有权
  const { rows: owns } = await db.execute({
    sql: 'SELECT id FROM customers WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
    args: [id, session.id],
  });
  if (!owns.length) return NextResponse.json({ error: '客户不存在' }, { status: 404 });

  // 验证联系人属于该客户
  if (wechat_contact_id) {
    const { rows: contactOwns } = await db.execute({
      sql: 'SELECT id FROM wechat_contacts WHERE id = ? AND customer_id = ?',
      args: [wechat_contact_id, id],
    });
    if (!contactOwns.length) return NextResponse.json({ error: '联系人不存在' }, { status: 404 });
  }

  // 更新聊天记录的联系人关联
  await db.execute({
    sql: 'UPDATE wechat_chats SET wechat_contact_id = ? WHERE id = ? AND customer_id = ?',
    args: [wechat_contact_id || null, chatId, id],
  });

  // 返回更新后的记录
  const { rows: [updated] } = await db.execute({
    sql: `SELECT wc.*, wc2.name as contact_name
          FROM wechat_chats wc
          LEFT JOIN wechat_contacts wc2 ON wc2.id = wc.wechat_contact_id
          WHERE wc.id = ?`,
    args: [chatId],
  });

  return NextResponse.json(updated);
}

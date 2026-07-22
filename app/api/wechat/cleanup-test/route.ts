import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { getMonitorUserId, getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const userId = getMonitorUserId(req) ?? getSessionUser(req)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = await ensureDb();

  // 删除 wxid 为 test_wxid 的测试客户及其聊天记录
  const { rows: testCustomers } = await db.execute({
    sql: `SELECT id FROM customers WHERE contact_info = 'test_wxid' LIMIT 1`,
    args: [],
  });

  if (testCustomers.length > 0) {
    const cid = testCustomers[0].id as number;
    await db.execute({ sql: `DELETE FROM wechat_chats WHERE customer_id = ?`, args: [cid] });
    await db.execute({ sql: `DELETE FROM wechat_contacts WHERE customer_id = ?`, args: [cid] });
    await db.execute({ sql: `DELETE FROM customers WHERE id = ?`, args: [cid] });
    return NextResponse.json({ deleted: true, customer_id: cid });
  }

  return NextResponse.json({ deleted: false, message: '未找到测试数据' });
}
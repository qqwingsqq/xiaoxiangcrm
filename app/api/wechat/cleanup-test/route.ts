import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { getMonitorUserId, getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const userId = getMonitorUserId(req) ?? getSessionUser(req)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = await ensureDb();

  // 查找所有名字以 Test 开头的客户（含 test_wxid 测试数据）
  const { rows: testCustomers } = await db.execute({
    sql: `SELECT id, name FROM customers WHERE name LIKE 'Test%' OR name LIKE 'test%' OR contact_info = 'test_wxid'`,
    args: [],
  });

  if (testCustomers.length === 0) {
    return NextResponse.json({ deleted: false, message: '未找到测试数据' });
  }

  const deletedNames: string[] = [];
  for (const c of testCustomers) {
    const cid = c.id as number;
    await db.execute({ sql: `DELETE FROM wechat_chats WHERE customer_id = ?`, args: [cid] });
    await db.execute({ sql: `DELETE FROM wechat_contacts WHERE customer_id = ?`, args: [cid] });
    await db.execute({ sql: `DELETE FROM follow_ups WHERE customer_id = ?`, args: [cid] });
    await db.execute({ sql: `DELETE FROM reminders WHERE customer_id = ?`, args: [cid] });
    await db.execute({ sql: `DELETE FROM customer_lists WHERE customer_id = ?`, args: [cid] });
    await db.execute({ sql: `DELETE FROM customers WHERE id = ?`, args: [cid] });
    deletedNames.push(c.name as string);
  }

  return NextResponse.json({ deleted: true, count: testCustomers.length, names: deletedNames });
}

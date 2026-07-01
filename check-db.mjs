import { createClient } from '@libsql/client';

const db = createClient({
  url: 'file:data/crm.db',
});

async function main() {
  console.log('=== Customers ===');
  const customers = await db.execute('SELECT * FROM customers ORDER BY id');
  console.table(customers.rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    contact_name: r.contact_name,
    contact_info: r.contact_info,
    wechat_id: r.wechat_id,
    user_id: r.user_id,
  })));

  console.log('\n=== WeChat Chats ===');
  const chats = await db.execute('SELECT * FROM wechat_chats ORDER BY id DESC LIMIT 20');
  console.table(chats.rows.map(r => ({
    id: r.id,
    customer_id: r.customer_id,
    chat_date: r.chat_date,
    analysis_status: r.analysis_status,
    raw_preview: (r.raw_content || '').substring(0, 50),
    created_at: r.created_at,
  })));

  console.log('\n=== Chat count per customer ===');
  const counts = await db.execute(`
    SELECT c.id, c.name, COUNT(wc.id) as chat_count
    FROM customers c
    LEFT JOIN wechat_chats wc ON c.id = wc.customer_id
    GROUP BY c.id
    ORDER BY chat_count DESC
  `);
  console.table(counts.rows);
}

main().catch(console.error).finally(() => process.exit(0));

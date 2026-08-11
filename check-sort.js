const { createClient } = require('@libsql/client');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const result = await db.execute({
    sql: `SELECT 
      wc.id, wc.customer_id, wc.chat_date, wc.created_at,
      c.name AS customer_name,
      (SELECT MAX(w3.chat_date) FROM wechat_chats w3 WHERE w3.customer_id = wc.customer_id) AS latest_date,
      (SELECT MAX(w4.created_at) FROM wechat_chats w4 WHERE w4.customer_id = wc.customer_id) AS latest_created
    FROM wechat_chats wc
    JOIN customers c ON c.id = wc.customer_id
    WHERE (c.is_blocked = 0 OR c.is_blocked IS NULL)
      AND wc.id = (
        SELECT w4.id FROM wechat_chats w4
        WHERE w4.customer_id = wc.customer_id
        ORDER BY w4.chat_date DESC, w4.created_at DESC
        LIMIT 1
      )
    ORDER BY latest_date DESC, wc.created_at DESC
    LIMIT 15`,
    args: [],
  });
  
  console.log('=== Current sort (top 15) ===');
  console.log('Name | chat_date | created_at | latest_date | latest_created');
  for (const r of result.rows) {
    console.log(`${r.customer_name} | ${r.chat_date} | ${r.created_at} | ${r.latest_date} | ${r.latest_created}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
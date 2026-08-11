const { createClient } = require('@libsql/client');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  // Backfill last_message_at with created_at for existing records
  const result = await db.execute({
    sql: `UPDATE wechat_chats SET last_message_at = created_at WHERE last_message_at IS NULL`,
    args: [],
  });
  console.log(`Updated ${(result.rowsAffected || 0)} records with last_message_at = created_at`);
  
  // Verify
  const check = await db.execute({
    sql: `SELECT c.name, wc.chat_date, wc.last_message_at, wc.created_at
          FROM wechat_chats wc
          JOIN customers c ON c.id = wc.customer_id
          ORDER BY wc.last_message_at DESC
          LIMIT 10`,
    args: [],
  });
  
  console.log('\nTop 10 by last_message_at DESC:');
  for (const r of check.rows) {
    console.log(`${r.name} | ${r.chat_date} | last_msg=${r.last_message_at} | created=${r.created_at}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
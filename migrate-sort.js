const { createClient } = require('@libsql/client');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  // Add last_message_at column (idempotent)
  try {
    await db.execute('ALTER TABLE wechat_chats ADD COLUMN last_message_at TEXT');
    console.log('Added last_message_at column');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('last_message_at column already exists');
    } else {
      console.log('Migration error:', e.message);
    }
  }
  
  // Show some data to verify
  const result = await db.execute({
    sql: `SELECT wc.id, c.name, wc.chat_date, wc.created_at, wc.last_message_at
          FROM wechat_chats wc
          JOIN customers c ON c.id = wc.customer_id
          ORDER BY wc.created_at DESC
          LIMIT 5`,
    args: [],
  });
  
  console.log('\nTop 5 by created_at DESC:');
  for (const r of result.rows) {
    console.log(`${r.name} | chat_date=${r.chat_date} | created_at=${r.created_at} | last_message_at=${r.last_message_at}`);
  }
  
  console.log('\nDone. Ready for code changes.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
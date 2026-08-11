const { createClient } = require('@libsql/client');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  // Get all chat records with their raw_content
  const { rows } = await db.execute({
    sql: `SELECT id, chat_date, raw_content FROM wechat_chats`,
    args: [],
  });
  
  console.log(`Processing ${rows.length} records...`);
  let updated = 0;
  
  for (const row of rows) {
    const raw = row.raw_content || '';
    const chatDate = row.chat_date || '';
    if (!chatDate) continue;
    
    // Extract all timestamps from raw_content: [HH:MM:SS]
    const timeMatches = raw.match(/\[(\d{2}:\d{2}:\d{2})\]/g);
    if (!timeMatches || timeMatches.length === 0) continue;
    
    // Get the last timestamp
    const lastTimeStr = timeMatches[timeMatches.length - 1].replace(/[\[\]]/g, '');
    const lastMessageAt = `${chatDate} ${lastTimeStr}`;
    
    await db.execute({
      sql: `UPDATE wechat_chats SET last_message_at = ? WHERE id = ?`,
      args: [lastMessageAt, row.id],
    });
    updated++;
  }
  
  console.log(`Updated ${updated} records with extracted last_message_at`);
  
  // Verify
  const check = await db.execute({
    sql: `SELECT c.name, wc.chat_date, wc.last_message_at
          FROM wechat_chats wc
          JOIN customers c ON c.id = wc.customer_id
          WHERE (c.is_blocked = 0 OR c.is_blocked IS NULL)
          ORDER BY wc.last_message_at DESC
          LIMIT 15`,
    args: [],
  });
  
  console.log('\nTop 15 by last_message_at DESC (actual message time):');
  for (const r of check.rows) {
    console.log(`${r.name} | ${r.chat_date} | last_msg=${r.last_message_at}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
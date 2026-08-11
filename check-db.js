const { createClient } = require('@libsql/client');
const db = createClient({ 
  url: 'libsql://xiaoxiangcrm-mrqu.aws-ap-northeast-1.turso.io', 
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE3NTM4MjMsImlkIjoiMDE5ZWQ1MTEtOTEwMS03ZTgwLTk5NGEtMzY3MWMwYTM5NjI3IiwicmlkIjoiMzlkOGIzZjAtMGU0ZC00NWRjLWI2NzYtZTI4NmMyNzQwOWQ2In0.6wlSVGQmLf36XAlqwV_sKNy9n7rSeFHi7sTNqRTpPxDAY5Ye1XSXEmFsegP8WZ2W9zSoh5gyUV2zIgVIdJBjAA'
});

(async () => {
  // Status breakdown
  const status = await db.execute('SELECT analysis_status, COUNT(*) as cnt FROM wechat_chats GROUP BY analysis_status');
  console.log('=== Chat analysis status ===');
  status.rows.forEach(r => console.log(r.analysis_status + ': ' + r.cnt));

  // Total customers
  const customers = await db.execute('SELECT COUNT(*) as cnt FROM customers');
  console.log('\nTotal customers:', customers.rows[0].cnt);

  // Recent chats
  const recent = await db.execute('SELECT wc.id, c.name, wc.analysis_status, wc.chat_date FROM wechat_chats wc JOIN customers c ON c.id = wc.customer_id ORDER BY wc.created_at DESC LIMIT 10');
  console.log('\n=== Recent 10 chats ===');
  recent.rows.forEach(r => console.log(r.id + ' | ' + r.name + ' | ' + r.analysis_status + ' | ' + r.chat_date));

  // Error chats
  const errors = await db.execute("SELECT wc.id, c.name, wc.analysis_status FROM wechat_chats wc JOIN customers c ON c.id = wc.customer_id WHERE wc.analysis_status = 'error' LIMIT 10");
  console.log('\n=== Error chats ===');
  errors.rows.forEach(r => console.log(r.id + ' | ' + r.name));

  // Pending chats
  const pending = await db.execute("SELECT wc.id, c.name, wc.analysis_status, LENGTH(wc.raw_content) as content_len FROM wechat_chats wc JOIN customers c ON c.id = wc.customer_id WHERE wc.analysis_status = 'pending' LIMIT 10");
  console.log('\n=== Pending chats (first 10) ===');
  pending.rows.forEach(r => console.log(r.id + ' | ' + r.name + ' | content_len: ' + r.content_len));

  // Done chats without summary
  const noSummary = await db.execute("SELECT wc.id, c.name, wc.summary FROM wechat_chats wc JOIN customers c ON c.id = wc.customer_id WHERE wc.analysis_status = 'done' AND (wc.summary IS NULL OR wc.summary = '') LIMIT 10");
  console.log('\n=== Done but no summary (first 10) ===');
  noSummary.rows.forEach(r => console.log(r.id + ' | ' + r.name));
})();

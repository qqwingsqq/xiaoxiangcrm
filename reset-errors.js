const { createClient } = require('@libsql/client');
const db = createClient({ 
  url: 'libsql://xiaoxiangcrm-mrqu.aws-ap-northeast-1.turso.io', 
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE3NTM4MjMsImlkIjoiMDE5ZWQ1MTEtOTEwMS03ZTgwLTk5NGEtMzY3MWMwYTM5NjI3IiwicmlkIjoiMzlkOGIzZjAtMGU0ZC00NWRjLWI2NzYtZTI4NmMyNzQwOWQ2In0.6wlSVGQmLf36XAlqwV_sKNy9n7rSeFHi7sTNqRTpPxDAY5Ye1XSXEmFsegP8WZ2W9zSoh5gyUV2zIgVIdJBjAA'
});

(async () => {
  // Reset error chats back to pending
  const result = await db.execute("UPDATE wechat_chats SET analysis_status = 'pending' WHERE analysis_status = 'error'");
  console.log('Reset ' + result.rowsAffected + ' error chats to pending');

  // Verify
  const status = await db.execute('SELECT analysis_status, COUNT(*) as cnt FROM wechat_chats GROUP BY analysis_status');
  console.log('\n=== Updated status ===');
  status.rows.forEach(r => console.log(r.analysis_status + ': ' + r.cnt));
})();

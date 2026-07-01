import { createClient } from '@libsql/client';

const db = createClient({
  url: 'file:data/crm.db',
});

async function main() {
  console.log('Seeding database...');

  // Ensure wechat_contacts and wechat_chats tables exist
  await db.execute(`CREATE TABLE IF NOT EXISTS wechat_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    wxid TEXT,
    role TEXT,
    avatar TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS wechat_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    wechat_contact_id INTEGER,
    raw_content TEXT NOT NULL,
    summary TEXT,
    next_meeting TEXT,
    discussed_features TEXT DEFAULT '[]',
    next_steps TEXT DEFAULT '[]',
    intent_level TEXT DEFAULT 'unknown',
    key_points TEXT DEFAULT '[]',
    analysis_status TEXT DEFAULT 'pending',
    chat_date TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (wechat_contact_id) REFERENCES wechat_contacts(id) ON DELETE SET NULL
  )`);

  // Add wechat_contact_id column if not exists
  try {
    await db.execute('ALTER TABLE wechat_chats ADD COLUMN wechat_contact_id INTEGER');
  } catch (e) {
    // Column already exists, ignore
  }

  // Find or create a test customer
  let customerId;
  const { rows: customers } = await db.execute('SELECT id FROM customers ORDER BY id LIMIT 1');
  if (customers.length > 0) {
    customerId = customers[0].id;
    console.log(`Using existing customer #${customerId}`);
  } else {
    const { rows: [{ last_id }] } = await db.execute(
      `INSERT INTO customers (name, type, contact_name, company, status)
       VALUES ('千幻科技', 'enterprise', '杨克强', '千幻科技有限公司', 'active')
       RETURNING id as last_id`
    );
    customerId = last_id;
    console.log(`Created new customer #${customerId}`);
  }

  // Check if contacts already exist
  const { rows: existingContacts } = await db.execute({
    sql: 'SELECT id, name FROM wechat_contacts WHERE customer_id = ?',
    args: [customerId],
  });

  if (existingContacts.length > 0) {
    console.log(`Contacts already exist for this customer: ${existingContacts.length} contacts`);
    console.table(existingContacts);
  } else {
    // Add sample contacts
    const contacts = [
      { name: '杨克强老板', role: '老板', sort_order: 1 },
      { name: '千幻', role: '总机', sort_order: 2 },
      { name: '赵总', role: '销售经理', sort_order: 3 },
      { name: '康小姐', role: '采购', sort_order: 4 },
    ];

    for (const contact of contacts) {
      const { rows: [{ last_id }] } = await db.execute({
        sql: `INSERT INTO wechat_contacts (customer_id, name, role, sort_order)
              VALUES (?, ?, ?, ?) RETURNING id as last_id`,
        args: [customerId, contact.name, contact.role, contact.sort_order],
      });
      console.log(`Added contact: ${contact.name} (id: ${last_id})`);
    }
  }

  // Add sample chats for each contact
  const { rows: allContacts } = await db.execute({
    sql: 'SELECT id, name FROM wechat_contacts WHERE customer_id = ? ORDER BY sort_order',
    args: [customerId],
  });

  const sampleChats = [
    {
      contactName: '杨克强老板',
      content: `杨克强老板 2026/6/28 10:30:00
你好，我们公司最近在考虑上一套CRM系统，想了解一下你们的产品。

我 2026/6/28 10:32:00
您好杨总！非常感谢您的关注。我们的CRM系统主要功能包括客户管理、销售跟进、数据分析等，可以帮您的团队提升效率。请问您公司目前大概有多少销售人员？

杨克强老板 2026/6/28 10:35:00
我们销售团队大概15人左右，主要是做企业级软件销售的。

我 2026/6/28 10:36:00
明白，15人团队非常适合我们的产品。我们可以约个时间做个产品演示，您看这周哪天方便？

杨克强老板 2026/6/28 10:40:00
下周二下午吧，2点到3点左右。

我 2026/6/28 10:41:00
好的杨总，下周二下午2点我准时联系您。我先把产品资料发您邮箱参考一下。`,
    },
    {
      contactName: '赵总',
      role: '销售经理',
      content: `赵总 2026/6/29 14:20:00
你好，我是千幻的销售经理赵XX，杨总让我跟你对接一下CRM的具体需求。

我 2026/6/29 14:22:00
赵总您好！很高兴认识您。请问您这边最关注哪些功能呢？

赵总 2026/6/29 14:25:00
我们主要关心几个点：第一是客户的公海池管理，第二是销售漏斗的数据分析，第三是微信聊天记录的同步。

我 2026/6/29 14:28:00
这几个功能我们都有，而且微信聊天记录同步是我们的特色功能。可以自动导入微信聊天，AI自动提炼关键信息，生成跟进任务。

赵总 2026/6/29 14:30:00
听起来不错。价格方面怎么算？

我 2026/6/29 14:32:00
按用户数收费，每个用户每年XX元。15人团队的话可以给您申请个折扣价。

赵总 2026/6/29 14:35:00
行，你把报价单发我一下吧。另外周二的演示我也会参加。`,
    },
    {
      contactName: '康小姐',
      role: '采购',
      content: `康小姐 2026/6/30 09:15:00
你好，我是千幻的采购康XX。想跟你确认一下合同的事情。

我 2026/6/30 09:17:00
康小姐您好！请问有什么可以帮您的？

康小姐 2026/6/30 09:20:00
赵总已经跟我沟通过了，我们准备先试用一个月，看看效果。想问一下试用版有没有功能限制？

我 2026/6/30 09:22:00
试用版功能完整开放的，没有任何限制，可以免费试用14天。如果需要延长到1个月也可以帮您申请。

康小姐 2026/6/30 09:25:00
好的，那你帮我们开通一下试用吧。需要提供什么资料吗？

我 2026/6/30 09:27:00
只需要公司名称和您的手机号就行，我这边帮您注册好。`,
    },
  ];

  for (const sample of sampleChats) {
    const contact = allContacts.find(c => c.name === sample.contactName);
    if (!contact) continue;

    // Check if this contact already has chats
    const { rows: chatCount } = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM wechat_chats WHERE wechat_contact_id = ?',
      args: [contact.id],
    });

    if (chatCount[0].count > 0) {
      console.log(`Contact ${contact.name} already has ${chatCount[0].count} chats, skipping`);
      continue;
    }

    const chatDate = sample.contactName === '杨克强老板' ? '2026-06-28' :
                     sample.contactName === '赵总' ? '2026-06-29' : '2026-06-30';

    await db.execute({
      sql: `INSERT INTO wechat_chats (customer_id, wechat_contact_id, raw_content, chat_date, analysis_status)
            VALUES (?, ?, ?, ?, 'completed')`,
      args: [customerId, contact.id, sample.content, chatDate],
    });
    console.log(`Added sample chat for ${contact.name}`);
  }

  console.log('\nDone! Summary:');
  const { rows: finalContacts } = await db.execute({
    sql: `SELECT wc.id, wc.name, wc.role,
           (SELECT COUNT(*) FROM wechat_chats wc2 WHERE wc2.wechat_contact_id = wc.id) as chat_count
          FROM wechat_contacts wc
          WHERE wc.customer_id = ?
          ORDER BY wc.sort_order`,
    args: [customerId],
  });
  console.table(finalContacts);
}

main().catch(console.error).finally(() => process.exit(0));

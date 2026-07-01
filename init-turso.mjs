import { createClient } from '@libsql/client';

const dbUrl = process.argv[2];
const authToken = process.argv[3];

if (!dbUrl || !authToken) {
  console.error('Usage: node init-turso.mjs <db-url> <auth-token>');
  process.exit(1);
}

const db = createClient({
  url: dbUrl,
  authToken: authToken,
});

console.log('Initializing database...');

try {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      address TEXT,
      contact_name TEXT,
      contact_info TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      follow_up_date TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follow_up_id INTEGER,
      customer_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_size INTEGER,
      summary TEXT,
      key_points TEXT DEFAULT '[]',
      reminders TEXT DEFAULT '[]',
      analysis_status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (follow_up_id) REFERENCES follow_ups(id) ON DELETE SET NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS voice_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      transcript TEXT,
      summary TEXT,
      key_points TEXT DEFAULT '[]',
      duration INTEGER,
      customer_id INTEGER,
      follow_up_id INTEGER,
      status TEXT DEFAULT 'recorded',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      document_id INTEGER,
      follow_up_id INTEGER,
      content TEXT NOT NULL,
      remind_date TEXT,
      is_done INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS wechat_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      wxid TEXT,
      role TEXT,
      avatar TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS wechat_chats (
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
    )`,
    `CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT,
      description TEXT,
      is_done INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS password_reset_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT NOT NULL,
      contact TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS customer_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6b7280',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS customer_attributes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6b7280',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS customer_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      shape TEXT NOT NULL DEFAULT 'circle',
      color TEXT NOT NULL DEFAULT '#6b7280',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )`,
  ], 'write');

  try { await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    phone TEXT,
    email TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`); } catch (_) {}

  try { await db.execute(`CREATE TABLE IF NOT EXISTS wechat_blocklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wxid TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`); } catch (_) {}

  const migrations = [
    'ALTER TABLE customers ADD COLUMN is_blocked INTEGER DEFAULT 0',
    'ALTER TABLE customers ADD COLUMN wechat_id TEXT',
    'ALTER TABLE customers ADD COLUMN map_lat REAL',
    'ALTER TABLE customers ADD COLUMN map_lng REAL',
    'ALTER TABLE customers ADD COLUMN customer_attribute TEXT',
    'ALTER TABLE customers ADD COLUMN customer_status TEXT',
    'ALTER TABLE customers ADD COLUMN user_id INTEGER DEFAULT 1',
    'ALTER TABLE users ADD COLUMN phone TEXT',
    'ALTER TABLE users ADD COLUMN email TEXT',
    'ALTER TABLE wechat_chats ADD COLUMN wechat_contact_id INTEGER',
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch (_) {}
  }

  const { rows } = await db.execute('SELECT COUNT(*) as cnt FROM customer_types');
  if ((rows[0]?.cnt) === 0 || rows[0]?.cnt === '0') {
    await db.batch([
      `INSERT INTO customer_types (key,label,color,sort_order) VALUES ('dealer','经销商','#a855f7',1)`,
      `INSERT INTO customer_types (key,label,color,sort_order) VALUES ('terminal','终端客户','#10b981',2)`,
      `INSERT INTO customer_types (key,label,color,sort_order) VALUES ('partner','合作伙伴','#3b82f6',3)`,
      `INSERT INTO customer_types (key,label,color,sort_order) VALUES ('potential','潜在客户','#f59e0b',4)`,
    ], 'write');
  }

  const { rows: attrRows } = await db.execute('SELECT COUNT(*) as cnt FROM customer_attributes');
  if ((attrRows[0]?.cnt) === 0 || attrRows[0]?.cnt === '0') {
    await db.batch([
      `INSERT INTO customer_attributes (key,label,color,sort_order) VALUES ('ecommerce','电商客户','#10b981',1)`,
      `INSERT INTO customer_attributes (key,label,color,sort_order) VALUES ('factory','工厂客户','#3b82f6',2)`,
      `INSERT INTO customer_attributes (key,label,color,sort_order) VALUES ('solution','方案商客户','#a855f7',3)`,
      `INSERT INTO customer_attributes (key,label,color,sort_order) VALUES ('brand','品牌商客户','#f59e0b',4)`,
    ], 'write');
  }

  const { rows: statusRows } = await db.execute('SELECT COUNT(*) as cnt FROM customer_statuses');
  if ((statusRows[0]?.cnt) === 0 || statusRows[0]?.cnt === '0') {
    await db.batch([
      `INSERT INTO customer_statuses (key,label,shape,color,sort_order) VALUES ('potential','潜在客户','circle','#6b7280',1)`,
      `INSERT INTO customer_statuses (key,label,shape,color,sort_order) VALUES ('to_develop','待开发客户','square','#60a5fa',2)`,
      `INSERT INTO customer_statuses (key,label,shape,color,sort_order) VALUES ('following','跟进中','diamond','#fbbf24',3)`,
      `INSERT INTO customer_statuses (key,label,shape,color,sort_order) VALUES ('pending','待成交','triangle','#f97316',4)`,
      `INSERT INTO customer_statuses (key,label,shape,color,sort_order) VALUES ('closed','已成交','star','#10b981',5)`,
      `INSERT INTO customer_statuses (key,label,shape,color,sort_order) VALUES ('lost','已流失','cross','#ef4444',6)`,
    ], 'write');
  }

  console.log('Database initialized successfully!');
  process.exit(0);
} catch (error) {
  console.error('Error initializing database:', error.message);
  process.exit(1);
}

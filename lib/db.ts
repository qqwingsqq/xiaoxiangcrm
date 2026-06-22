import { createClient, type Client, type InValue } from '@libsql/client';

let _client: Client | null = null;
let _initDone = false;

export function getDb(): Client {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

export async function ensureDb(): Promise<Client> {
  const db = getDb();
  if (!_initDone) {
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
      `CREATE TABLE IF NOT EXISTS customer_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#6b7280',
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )`,
    ], 'write');
    // Migrations
    try { await db.execute('ALTER TABLE customers ADD COLUMN wechat_id TEXT'); } catch (_) {}
    try { await db.execute('ALTER TABLE customers ADD COLUMN map_lat REAL'); } catch (_) {}
    try { await db.execute('ALTER TABLE customers ADD COLUMN map_lng REAL'); } catch (_) {}
    // Seed default customer types if empty
    const { rows } = await db.execute('SELECT COUNT(*) as cnt FROM customer_types');
    if ((rows[0]?.cnt as number) === 0) {
      await db.batch([
        `INSERT INTO customer_types (key,label,color,sort_order) VALUES ('dealer','经销商','#a855f7',1)`,
        `INSERT INTO customer_types (key,label,color,sort_order) VALUES ('terminal','终端客户','#10b981',2)`,
        `INSERT INTO customer_types (key,label,color,sort_order) VALUES ('partner','合作伙伴','#3b82f6',3)`,
        `INSERT INTO customer_types (key,label,color,sort_order) VALUES ('potential','潜在客户','#f59e0b',4)`,
      ], 'write');
    }
    _initDone = true;
  }
  return db;
}

export type { InValue };

export interface CustomerInput {
  name: string;
  type: string;
  address?: string;
  contact_name?: string;
  contact_info?: string;
  wechat_id?: string;
  tags?: string[];
}

export interface Customer {
  id: number;
  name: string;
  type: string;
  address: string | null;
  contact_name: string | null;
  contact_info: string | null;
  wechat_id: string | null;
  map_lat: number | null;
  map_lng: number | null;
  tags: string;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: number;
  customer_id: number;
  title: string;
  content: string | null;
  follow_up_date: string | null;
  created_at: string;
}

export interface Document {
  id: number;
  follow_up_id: number | null;
  customer_id: number;
  original_name: string;
  stored_name: string;
  file_size: number | null;
  summary: string | null;
  key_points: string;
  reminders: string;
  analysis_status: string;
  created_at: string;
}

export interface Reminder {
  id: number;
  customer_id: number;
  document_id: number | null;
  follow_up_id: number | null;
  content: string;
  remind_date: string | null;
  is_done: number;
  created_at: string;
}

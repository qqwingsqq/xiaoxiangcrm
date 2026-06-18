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
    ], 'write');
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
  tags?: string[];
}

export interface Customer {
  id: number;
  name: string;
  type: string;
  address: string | null;
  contact_name: string | null;
  contact_info: string | null;
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

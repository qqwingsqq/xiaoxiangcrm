import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { ALLOWED_EXTENSIONS } from '@/lib/extract';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const customerId = formData.get('customer_id') as string;
  const followUpId = formData.get('follow_up_id') as string | null;

  if (!file) return NextResponse.json({ error: '请选择文件' }, { status: 400 });
  if (!customerId) return NextResponse.json({ error: '缺少客户ID' }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({
      error: `不支持该文件格式，支持：Word、Excel、PPT、TXT、图片（JPG/PNG等）、PDF`
    }, { status: 400 });
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: '文件大小不能超过 50MB' }, { status: 400 });
  }

  const storedName = `${randomUUID()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, storedName);
  fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

  const db = await ensureDb();
  const result = await db.execute({
    sql: `INSERT INTO documents (follow_up_id, customer_id, original_name, stored_name, file_size, analysis_status)
          VALUES (?, ?, ?, ?, ?, 'pending')`,
    args: [followUpId || null, customerId, file.name, storedName, file.size],
  });

  const { rows: [doc] } = await db.execute({ sql: 'SELECT * FROM documents WHERE id = ?', args: [result.lastInsertRowid!] });
  return NextResponse.json(doc, { status: 201 });
}

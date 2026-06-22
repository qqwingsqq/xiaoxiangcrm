import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { ALLOWED_EXTENSIONS, extractTextFromBuffer, isImageFile } from '@/lib/extract';
import { analyzeText, analyzeImageFromBuffer } from '@/lib/ai';
import path from 'path';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const customerId = formData.get('customer_id') as string;
  const followUpId = formData.get('follow_up_id') as string | null;

  if (!file) return NextResponse.json({ error: '请选择文件' }, { status: 400 });
  if (!customerId) return NextResponse.json({ error: '缺少客户ID' }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: '不支持该文件格式，支持：Word、Excel、PPT、PDF、TXT、图片' }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: '文件大小不能超过 50MB' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const db = await ensureDb();

  // Get user API key (DB setting overrides env var)
  const { rows: keyRow } = await db.execute({ sql: `SELECT value FROM user_settings WHERE key='anthropic_key'`, args: [] });
  const userApiKey = (keyRow[0]?.value as string) || process.env.ANTHROPIC_API_KEY || '';

  // Create document record
  const insertResult = await db.execute({
    sql: `INSERT INTO documents (follow_up_id, customer_id, original_name, stored_name, file_size, analysis_status)
          VALUES (?, ?, ?, ?, ?, 'analyzing')`,
    args: [followUpId || null, customerId, file.name, file.name, file.size],
  });
  const docId = insertResult.lastInsertRowid!;

  // Analyze in-memory (no disk write needed)
  if (!userApiKey) {
    await db.execute({ sql: `UPDATE documents SET analysis_status='pending' WHERE id=?`, args: [docId] });
    const { rows: [doc] } = await db.execute({ sql: 'SELECT * FROM documents WHERE id=?', args: [docId] });
    return NextResponse.json(doc, { status: 201 });
  }

  try {
    let result;
    if (isImageFile(file.name)) {
      result = await analyzeImageFromBuffer(buffer, file.name, userApiKey);
    } else {
      const text = await extractTextFromBuffer(buffer, file.name);
      if (!text.trim()) {
        await db.execute({ sql: `UPDATE documents SET analysis_status='error' WHERE id=?`, args: [docId] });
        return NextResponse.json({ error: '无法从文档提取文字内容' }, { status: 400 });
      }
      result = await analyzeText(text, file.name, userApiKey);
    }

    await db.execute({
      sql: `UPDATE documents SET summary=?, key_points=?, reminders=?, analysis_status='done' WHERE id=?`,
      args: [result.summary, JSON.stringify(result.keyPoints), JSON.stringify(result.reminders), docId],
    });

    for (const r of result.reminders) {
      await db.execute({
        sql: `INSERT INTO reminders (customer_id, document_id, follow_up_id, content, remind_date) VALUES (?, ?, ?, ?, ?)`,
        args: [customerId, docId, followUpId || null, r.content, r.remind_date || null],
      });
    }
  } catch (err) {
    await db.execute({ sql: `UPDATE documents SET analysis_status='error' WHERE id=?`, args: [docId] });
    const msg = String(err);
    return NextResponse.json({ error: `AI 分析失败：${msg.substring(0, 200)}` }, { status: 500 });
  }

  const { rows: [doc] } = await db.execute({ sql: 'SELECT * FROM documents WHERE id=?', args: [docId] });
  return NextResponse.json(doc, { status: 201 });
}

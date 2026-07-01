import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, Document } from '@/lib/db';
import { analyzeText, analyzeImageFromBuffer } from '@/lib/ai';
import { extractTextFromBuffer, isImageFile } from '@/lib/extract';
import { getUploadFilePath } from '@/lib/storage';
import fs from 'fs';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows: [doc] } = await db.execute({ sql: 'SELECT * FROM documents WHERE id = ?', args: [id] });
  if (!doc) return NextResponse.json({ error: '文档不存在' }, { status: 404 });

  // Get user API key (DB setting overrides env var)
  const { rows: keyRow } = await db.execute({ sql: `SELECT value FROM user_settings WHERE key='anthropic_key'`, args: [] });
  const userApiKey = (keyRow[0]?.value as string) || process.env.ANTHROPIC_API_KEY || '';
  if (!userApiKey) {
    return NextResponse.json({ error: '未配置 Anthropic API Key，请在设置中添加' }, { status: 500 });
  }

  await db.execute({ sql: `UPDATE documents SET analysis_status='analyzing' WHERE id=?`, args: [id] });

  const typedDoc = doc as unknown as Document;

  try {
    const filePath = getUploadFilePath(typedDoc.stored_name);
    if (!fs.existsSync(filePath)) {
      await db.execute({ sql: `UPDATE documents SET analysis_status='error' WHERE id=?`, args: [id] });
      return NextResponse.json({ error: '文件不存在，无法重新分析（Vercel 临时存储中的文件可能已过期）' }, { status: 400 });
    }
    const buffer = fs.readFileSync(filePath);
    let result;

    if (isImageFile(typedDoc.original_name)) {
      result = await analyzeImageFromBuffer(buffer, typedDoc.original_name, userApiKey);
    } else {
      const text = await extractTextFromBuffer(buffer, typedDoc.original_name);
      if (!text.trim()) {
        await db.execute({ sql: `UPDATE documents SET analysis_status='error' WHERE id=?`, args: [id] });
        return NextResponse.json({ error: '无法从文档提取文字内容' }, { status: 400 });
      }
      result = await analyzeText(text, typedDoc.original_name, userApiKey);
    }

    await db.execute({
      sql: `UPDATE documents SET summary=?, key_points=?, reminders=?, analysis_status='done' WHERE id=?`,
      args: [result.summary, JSON.stringify(result.keyPoints), JSON.stringify(result.reminders), id],
    });

    for (const r of result.reminders) {
      await db.execute({
        sql: `INSERT INTO reminders (customer_id, document_id, follow_up_id, content, remind_date) VALUES (?, ?, ?, ?, ?)`,
        args: [typedDoc.customer_id, typedDoc.id, typedDoc.follow_up_id, r.content, r.remind_date || null],
      });
    }

    const { rows: [updated] } = await db.execute({ sql: 'SELECT * FROM documents WHERE id = ?', args: [id] });
    return NextResponse.json(updated);
  } catch (err) {
    await db.execute({ sql: `UPDATE documents SET analysis_status='error' WHERE id=?`, args: [id] });
    const msg = String(err);
    let friendly = msg;
    if (msg.includes('403') || msg.includes('forbidden') || msg.includes('not allowed')) {
      friendly = 'API Key 无权限（403）：请确认使用的是 console.anthropic.com 的 API Key，而非 claude.ai 网页版账号';
    } else if (msg.includes('401') || msg.includes('authentication')) {
      friendly = 'API Key 无效（401）：请检查 .env.local 中的 ANTHROPIC_API_KEY 是否正确';
    } else if (msg.includes('429')) {
      friendly = '请求过于频繁（429）：请稍后再试';
    }
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}

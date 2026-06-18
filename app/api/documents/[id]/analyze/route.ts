import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, Document } from '@/lib/db';
import { analyzeText, analyzeImage } from '@/lib/ai';
import { extractText, isImageFile } from '@/lib/extract';
import path from 'path';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await ensureDb();
  const { rows: [doc] } = await db.execute({ sql: 'SELECT * FROM documents WHERE id = ?', args: [id] });
  if (!doc) return NextResponse.json({ error: '文档不存在' }, { status: 404 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: '未配置 ANTHROPIC_API_KEY，无法使用 AI 分析' }, { status: 500 });
  }

  await db.execute({ sql: `UPDATE documents SET analysis_status='analyzing' WHERE id=?`, args: [id] });

  const typedDoc = doc as unknown as Document;

  try {
    const filePath = path.join(process.cwd(), 'uploads', typedDoc.stored_name);
    let result;

    if (isImageFile(typedDoc.original_name)) {
      result = await analyzeImage(filePath, typedDoc.original_name);
    } else {
      const text = await extractText(filePath, typedDoc.original_name);
      if (!text.trim()) {
        await db.execute({ sql: `UPDATE documents SET analysis_status='error' WHERE id=?`, args: [id] });
        return NextResponse.json({ error: '无法从文档提取文字内容' }, { status: 400 });
      }
      result = await analyzeText(text, typedDoc.original_name);
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

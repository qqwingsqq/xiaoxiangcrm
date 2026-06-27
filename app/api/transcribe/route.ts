import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import OpenAI from 'openai';
import { toFile } from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const db = await ensureDb();
  const { rows: keyRow } = await db.execute({ sql: `SELECT value FROM user_settings WHERE key='openai_key'`, args: [] });
  const apiKey = (keyRow[0]?.value as string) || process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: '未配置 OpenAI API Key，请在设置页面添加' }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get('audio') as File | null;
  if (!file) return NextResponse.json({ error: '未收到音频文件' }, { status: 400 });

  const client = new OpenAI({ apiKey });

  try {
    const arrayBuf = await file.arrayBuffer();
    const audioFile = await toFile(Buffer.from(arrayBuf), file.name || 'audio.webm', { type: file.type || 'audio/webm' });

    const transcription = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'zh',
    });

    return NextResponse.json({ text: transcription.text });
  } catch (err) {
    const msg = String(err);
    let friendly = 'Whisper 转写失败：' + msg;
    if (msg.includes('401')) friendly = 'OpenAI API Key 无效，请在设置中检查';
    else if (msg.includes('429')) friendly = 'OpenAI 请求频率超限，请稍后重试';
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}

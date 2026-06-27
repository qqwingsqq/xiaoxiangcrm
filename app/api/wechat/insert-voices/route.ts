import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';

interface VoiceLine {
  time: string;   // HH:MM:SS
  sender: string; // '我' or '对方'
  transcript: string;
}

export async function POST(req: NextRequest) {
  const { wxid, date, voices } = await req.json() as { wxid: string; date: string; voices: VoiceLine[] };
  if (!wxid || !date || !voices?.length) {
    return NextResponse.json({ error: 'wxid, date, voices required' }, { status: 400 });
  }

  const db = await ensureDb();

  // Find customer by contact_info
  const { rows: customers } = await db.execute({
    sql: 'SELECT id FROM customers WHERE contact_info = ? LIMIT 1',
    args: [wxid],
  });
  if (!customers.length) {
    return NextResponse.json({ error: `Customer not found for wxid ${wxid}` }, { status: 404 });
  }
  const customerId = customers[0].id as number;

  // Find existing chat record for this date
  const { rows: chats } = await db.execute({
    sql: 'SELECT id, raw_content FROM wechat_chats WHERE customer_id = ? AND chat_date = ? LIMIT 1',
    args: [customerId, date],
  });

  if (!chats.length) {
    // No text messages that day — create a new record with only voice lines
    const voiceContent = voices
      .map(v => `[${v.time}] ${v.sender}: [语音] ${v.transcript}`)
      .join('\n');
    await db.execute({
      sql: `INSERT INTO wechat_chats (customer_id, raw_content, chat_date, analysis_status) VALUES (?, ?, ?, 'pending')`,
      args: [customerId, voiceContent, date],
    });
    return NextResponse.json({ action: 'created' });
  }

  const chatId = chats[0].id as number;
  const existingContent = String(chats[0].raw_content || '');

  // Merge: parse existing lines, add voice lines, re-sort by timestamp
  const existingLines = existingContent.split('\n').filter(Boolean);
  const voiceLines = voices.map(v => `[${v.time}] ${v.sender}: [语音] ${v.transcript}`);
  const allLines = [...existingLines, ...voiceLines];

  // Sort by time prefix [HH:MM:SS]
  allLines.sort((a, b) => {
    const ta = a.match(/^\[(\d{2}:\d{2}:\d{2})\]/)?.[1] ?? '';
    const tb = b.match(/^\[(\d{2}:\d{2}:\d{2})\]/)?.[1] ?? '';
    return ta.localeCompare(tb);
  });

  const merged = allLines.join('\n');
  await db.execute({
    sql: `UPDATE wechat_chats SET raw_content = ?, analysis_status = 'pending' WHERE id = ?`,
    args: [merged, chatId],
  });

  return NextResponse.json({ action: 'merged', lines_added: voiceLines.length });
}

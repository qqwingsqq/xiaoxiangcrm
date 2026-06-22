import { NextRequest, NextResponse } from 'next/server';
import { testApiKey } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const { key } = await req.json() as { key: string };
  if (!key?.trim()) return NextResponse.json({ valid: false, error: '请输入 API Key' });
  const result = await testApiKey(key.trim());
  return NextResponse.json(result);
}

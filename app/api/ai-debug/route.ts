import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  const expected = process.env.MONITOR_API_KEY;
  if (!apiKey || !expected || apiKey !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    OPENROUTER_API_KEY: openrouterKey ? openrouterKey.substring(0, 6) + '...' + openrouterKey.substring(openrouterKey.length - 4) : 'NOT SET',
    ANTHROPIC_API_KEY: anthropicKey ? anthropicKey.substring(0, 6) + '...' + anthropicKey.substring(anthropicKey.length - 4) : 'NOT SET',
    openrouter_key_length: openrouterKey?.length || 0,
    anthropic_key_length: anthropicKey?.length || 0,
  });
}
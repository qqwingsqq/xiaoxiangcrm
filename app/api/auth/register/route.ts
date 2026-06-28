import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { username, password, display_name } = await req.json();
  if (!username?.trim() || !password) {
    return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '密码至少6位' }, { status: 400 });
  }

  const db = await ensureDb();
  const { rows: existing } = await db.execute('SELECT COUNT(*) as cnt FROM users');
  const count = existing[0]?.cnt as number;
  if (count > 0) {
    return NextResponse.json({ error: '注册已关闭，请联系管理员' }, { status: 403 });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const passwordHash = hashPassword(password);

  try {
    const result = await db.execute({
      sql: 'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
      args: [normalizedUsername, passwordHash, display_name?.trim() || normalizedUsername],
    });
    const userId = result.lastInsertRowid as number;
    const token = createToken(userId, normalizedUsername);

    const res = NextResponse.json({
      ok: true,
      user: { id: userId, username: normalizedUsername, display_name: display_name || normalizedUsername },
    }, { status: 201 });
    res.cookies.set('crm_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  } catch {
    return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
  }
}

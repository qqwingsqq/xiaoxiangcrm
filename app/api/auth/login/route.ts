import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { verifyPassword, createToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
  }

  const db = await ensureDb();
  const { rows } = await db.execute({
    sql: 'SELECT id, username, password_hash, display_name FROM users WHERE username = ?',
    args: [username.trim().toLowerCase()],
  });

  if (!rows.length || !verifyPassword(password, rows[0].password_hash as string)) {
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
  }

  const user = rows[0];
  const token = createToken(user.id as number, user.username as string);

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username, display_name: user.display_name },
  });
  res.cookies.set('crm_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}

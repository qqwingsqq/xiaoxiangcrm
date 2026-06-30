import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { username, password, display_name, phone, email } = await req.json();
  if (!username?.trim() || !password) {
    return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '密码至少6位' }, { status: 400 });
  }

  const db = await ensureDb();
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedPhone = phone?.trim() || null;
  const normalizedEmail = email?.trim().toLowerCase() || null;
  const passwordHash = hashPassword(password);

  try {
    const result = await db.execute({
      sql: 'INSERT INTO users (username, password_hash, display_name, phone, email) VALUES (?, ?, ?, ?, ?)',
      args: [normalizedUsername, passwordHash, display_name?.trim() || normalizedUsername, normalizedPhone, normalizedEmail],
    });
    const userId = Number(result.lastInsertRowid);
    const token = createToken(userId, normalizedUsername);

    const res = NextResponse.json({
      ok: true,
      user: {
        id: userId,
        username: normalizedUsername,
        display_name: display_name?.trim() || normalizedUsername,
        phone: normalizedPhone,
        email: normalizedEmail,
      },
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

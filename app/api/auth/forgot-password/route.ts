import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ensureDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

type ResetMethod = 'phone' | 'email';
type ResetAction = 'request-code' | 'reset-password';

function normalizeContact(method: ResetMethod, contact?: string) {
  return method === 'email' ? contact?.trim().toLowerCase() : contact?.trim();
}

function hashCode(method: ResetMethod, contact: string, code: string) {
  return crypto
    .createHash('sha256')
    .update(`${method}:${contact}:${code}`)
    .digest('hex');
}

export async function POST(req: NextRequest) {
  const { action, method, contact, code, newPassword } = await req.json() as {
    action?: ResetAction;
    method?: ResetMethod;
    contact?: string;
    code?: string;
    newPassword?: string;
  };

  const normalizedMethod = method === 'email' ? 'email' : method === 'phone' ? 'phone' : null;
  const normalizedContact = normalizedMethod ? normalizeContact(normalizedMethod, contact) : null;

  if (!normalizedMethod || !normalizedContact) {
    return NextResponse.json({ error: '请填写手机号或邮箱' }, { status: 400 });
  }

  if (normalizedMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContact)) {
    return NextResponse.json({ error: '请输入正确的邮箱地址' }, { status: 400 });
  }

  const db = await ensureDb();

  if (action === 'request-code') {
    const { rows } = await db.execute({
      sql: `SELECT id FROM users WHERE ${normalizedMethod} = ?`,
      args: [normalizedContact],
    });

    if (!rows.length) {
      return NextResponse.json({ error: '没有找到绑定该手机号或邮箱的账户' }, { status: 404 });
    }

    const resetCode = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashCode(normalizedMethod, normalizedContact, resetCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.execute({
      sql: `UPDATE password_reset_codes
            SET used_at = datetime('now','localtime')
            WHERE method = ? AND contact = ? AND used_at IS NULL`,
      args: [normalizedMethod, normalizedContact],
    });

    await db.execute({
      sql: 'INSERT INTO password_reset_codes (method, contact, code_hash, expires_at) VALUES (?, ?, ?, ?)',
      args: [normalizedMethod, normalizedContact, codeHash, expiresAt],
    });

    // 当前项目尚未接入短信/邮件服务，本地预览阶段返回验证码用于测试。
    return NextResponse.json({
      ok: true,
      message: normalizedMethod === 'phone' ? '验证码已生成' : '验证码已生成',
      devCode: resetCode,
    });
  }

  if (action === 'reset-password') {
    if (!code?.trim() || !newPassword) {
      return NextResponse.json({ error: '请填写验证码和新密码' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: '新密码至少6位' }, { status: 400 });
    }

    const codeHash = hashCode(normalizedMethod, normalizedContact, code.trim());
    const { rows } = await db.execute({
      sql: `SELECT id FROM password_reset_codes
            WHERE method = ? AND contact = ? AND code_hash = ? AND used_at IS NULL AND expires_at > ?
            ORDER BY id DESC LIMIT 1`,
      args: [normalizedMethod, normalizedContact, codeHash, new Date().toISOString()],
    });

    if (!rows.length) {
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 });
    }

    const result = await db.execute({
      sql: `UPDATE users SET password_hash = ? WHERE ${normalizedMethod} = ?`,
      args: [hashPassword(newPassword), normalizedContact],
    });

    if ((result.rowsAffected ?? 0) === 0) {
      return NextResponse.json({ error: '没有找到绑定该手机号或邮箱的账户' }, { status: 404 });
    }

    await db.execute({
      sql: 'UPDATE password_reset_codes SET used_at = datetime(\'now\',\'localtime\') WHERE id = ?',
      args: [rows[0].id],
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set('crm_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return res;
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}

import crypto from 'crypto';
import type { NextRequest } from 'next/server';

const SECRET = () => process.env.AUTH_SECRET ?? 'dev-secret-change-me-in-production';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  try {
    const candidate = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
  } catch {
    return false;
  }
}

interface TokenPayload {
  id: number;
  u: string;
  exp: number;
}

export function createToken(userId: number, username: string): string {
  const payload: TokenPayload = {
    id: userId,
    u: username,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET()).update(encoded).digest('hex');
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): { userId: number; username: string } | null {
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;
  const encoded = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);

  const expected = crypto.createHmac('sha256', SECRET()).update(encoded).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
  } catch {
    return null;
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
  } catch {
    return null;
  }

  if (Date.now() > payload.exp) return null;
  return { userId: payload.id, username: payload.u };
}

export interface SessionUser {
  id: number;
  username: string;
}

export function getSessionUser(req: NextRequest): SessionUser | null {
  const token = req.cookies.get('crm_session')?.value;
  if (!token) return null;
  const result = verifyToken(token);
  if (!result) return null;
  return { id: result.userId, username: result.username };
}

export function requireSession(req: NextRequest): SessionUser {
  const user = getSessionUser(req);
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

export function getMonitorUserId(req: NextRequest): number | null {
  const key = req.headers.get('x-api-key');
  const expected = process.env.MONITOR_API_KEY;
  if (!key || !expected || key !== expected) return null;
  return 1;
}

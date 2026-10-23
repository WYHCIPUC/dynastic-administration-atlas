import argon2 from 'argon2';
import { NextResponse } from 'next/server';
import { COOKIE_NAME, CSRF_COOKIE_NAME, createCsrfToken, createSession } from '@/lib/admin-auth';
import { requireSessionSecret } from '@/lib/env';
import { allowRequest } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!allowRequest(`login:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: '登录尝试过于频繁，请一分钟后再试。' }, { status: 429 });
  }
  const body = await request.json().catch(() => ({})) as { email?: string; password?: string };
  const expectedEmail = process.env.ADMIN_EMAIL;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  let sessionSecretConfigured = true;
  try {
    requireSessionSecret();
  } catch {
    sessionSecretConfigured = false;
  }
  if (!expectedEmail || !passwordHash || !sessionSecretConfigured) {
    return NextResponse.json({ error: '管理员环境变量未配置' }, { status: 503 });
  }
  let valid = body.email?.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
  try { valid = valid && Boolean(body.password) && await argon2.verify(passwordHash, body.password!); } catch { valid = false; }
  if (!valid) return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, createSession(expectedEmail), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 8 * 60 * 60, path: '/' });
  response.cookies.set(CSRF_COOKIE_NAME, createCsrfToken(), { httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 8 * 60 * 60, path: '/' });
  return response;
}

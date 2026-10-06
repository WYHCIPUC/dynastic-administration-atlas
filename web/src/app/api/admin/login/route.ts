import argon2 from 'argon2';
import { NextResponse } from 'next/server';
import { COOKIE_NAME, CSRF_COOKIE_NAME, createCsrfToken, createSession } from '@/lib/admin-auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { email?: string; password?: string };
  const expectedEmail = process.env.ADMIN_EMAIL;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedEmail || !passwordHash) return NextResponse.json({ error: '管理员环境变量未配置' }, { status: 503 });
  let valid = body.email?.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
  try { valid = valid && Boolean(body.password) && await argon2.verify(passwordHash, body.password!); } catch { valid = false; }
  if (!valid) return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, createSession(expectedEmail), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 8 * 60 * 60, path: '/' });
  response.cookies.set(CSRF_COOKIE_NAME, createCsrfToken(), { httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 8 * 60 * 60, path: '/' });
  return response;
}

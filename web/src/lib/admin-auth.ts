import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'atlas_admin_session';
const CSRF_COOKIE_NAME = 'atlas_admin_csrf';

function secret() {
  return process.env.ADMIN_SESSION_SECRET || 'development-only-change-me';
}

function signature(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifySession(value: string | undefined) {
  if (!value) return null;
  const [payload, supplied] = value.split('.');
  if (!payload || !supplied) return null;
  const expected = signature(payload);
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: string; exp?: number };
    if (!parsed.email || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch { return null; }
}

export function createCsrfToken() { return Buffer.from(`${Date.now()}:${Math.random()}:${secret()}`).toString('base64url'); }

export async function requireAdmin(request: Request) {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get(COOKIE_NAME)?.value);
  const csrf = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  if (!session) return { error: Response.json({ error: '需要管理员登录' }, { status: 401 }) } as const;
  if (!csrf || request.headers.get('x-csrf-token') !== csrf) return { error: Response.json({ error: 'CSRF 校验失败' }, { status: 403 }) } as const;
  return { session } as const;
}

export { COOKIE_NAME, CSRF_COOKIE_NAME };

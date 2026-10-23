import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { requireSessionSecret } from './env';

const COOKIE_NAME = 'atlas_admin_session';
const CSRF_COOKIE_NAME = 'atlas_admin_csrf';

function signature(payload: string) {
  return createHmac('sha256', requireSessionSecret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function createSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifySession(value: string | undefined) {
  if (!value) return null;
  const [payload, supplied] = value.split('.');
  if (!payload || !supplied) return null;
  let expected: string;
  try {
    expected = signature(payload);
  } catch {
    return null;
  }
  if (!safeEqual(supplied, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: string; exp?: number };
    if (!parsed.email || !parsed.exp || parsed.exp < Date.now()) return null;
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!adminEmail || parsed.email.trim().toLowerCase() !== adminEmail) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createCsrfToken() {
  const random = randomBytes(32).toString('base64url');
  const mac = createHmac('sha256', requireSessionSecret()).update(random).digest('base64url');
  return `${random}.${mac}`;
}

export function verifyCsrfToken(token: string | undefined) {
  if (!token) return false;
  const [random, mac] = token.split('.');
  if (!random || !mac) return false;
  let expected: string;
  try {
    expected = createHmac('sha256', requireSessionSecret()).update(random).digest('base64url');
  } catch {
    return false;
  }
  return safeEqual(mac, expected);
}

export async function requireAdmin(request: Request) {
  let secretConfigured = true;
  try {
    requireSessionSecret();
  } catch {
    secretConfigured = false;
  }
  if (!secretConfigured) return { error: Response.json({ error: '管理员会话密钥未配置' }, { status: 503 }) } as const;
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get(COOKIE_NAME)?.value);
  if (!session) return { error: Response.json({ error: '需要管理员登录' }, { status: 401 }) } as const;
  const csrf = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const header = request.headers.get('x-csrf-token');
  if (!csrf || !header || !verifyCsrfToken(csrf) || !safeEqual(csrf, header)) {
    return { error: Response.json({ error: 'CSRF 校验失败' }, { status: 403 }) } as const;
  }
  return { session } as const;
}

export { COOKIE_NAME, CSRF_COOKIE_NAME };

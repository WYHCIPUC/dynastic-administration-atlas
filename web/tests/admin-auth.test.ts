import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { checkCsrf, createCsrfToken, createSession, verifyCsrfToken, verifySession } from '../src/lib/admin-auth';
import { requireSessionSecret, validateAdminEnv } from '../src/lib/env';

const SECRET = 'unit-test-secret-0123456789abcdef';
const EMAIL = 'admin@example.com';

const ENV_KEYS = ['ADMIN_SESSION_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'NODE_ENV'] as const;

function setEnv(values: Record<string, string | undefined>) {
  const env = process.env as Record<string, string | undefined>;
  const saved = new Map(ENV_KEYS.map((key) => [key, env[key]] as const));
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return () => {
    for (const key of ENV_KEYS) {
      const value = saved.get(key);
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  };
}

function signedPayload(payload: Record<string, unknown>, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${mac}`;
}

test('合法会话可通过校验', () => {
  const restore = setEnv({ ADMIN_SESSION_SECRET: SECRET, ADMIN_EMAIL: EMAIL });
  try {
    const session = createSession(EMAIL);
    const parsed = verifySession(session);
    assert.equal(parsed?.email, EMAIL);
  } finally {
    restore();
  }
});

test('伪造签名的会话返回 null', () => {
  const restore = setEnv({ ADMIN_SESSION_SECRET: SECRET, ADMIN_EMAIL: EMAIL });
  try {
    const forged = signedPayload({ email: EMAIL, exp: Date.now() + 60_000 }, 'wrong-secret');
    assert.equal(verifySession(forged), null);
  } finally {
    restore();
  }
});

test('过期会话返回 null', () => {
  const restore = setEnv({ ADMIN_SESSION_SECRET: SECRET, ADMIN_EMAIL: EMAIL });
  try {
    const expired = signedPayload({ email: EMAIL, exp: Date.now() - 1_000 }, SECRET);
    assert.equal(verifySession(expired), null);
  } finally {
    restore();
  }
});

test('邮箱与 ADMIN_EMAIL 不符的会话返回 null', () => {
  const restore = setEnv({ ADMIN_SESSION_SECRET: SECRET, ADMIN_EMAIL: EMAIL });
  try {
    const wrongEmail = signedPayload({ email: 'intruder@example.com', exp: Date.now() + 60_000 }, SECRET);
    assert.equal(verifySession(wrongEmail), null);
  } finally {
    restore();
  }
});

test('ADMIN_EMAIL 未配置时会话一律无效', () => {
  const restore = setEnv({ ADMIN_SESSION_SECRET: SECRET });
  try {
    const session = signedPayload({ email: EMAIL, exp: Date.now() + 60_000 }, SECRET);
    assert.equal(verifySession(session), null);
  } finally {
    restore();
  }
});

test('密钥缺失时 requireSessionSecret 抛出中文错误', () => {
  const restore = setEnv({});
  try {
    assert.throws(() => requireSessionSecret(), /ADMIN_SESSION_SECRET 未配置/);
  } finally {
    restore();
  }
});

test('密钥缺失时 verifySession 返回 null 而不是抛出', () => {
  const restore = setEnv({ ADMIN_EMAIL: EMAIL });
  try {
    const session = signedPayload({ email: EMAIL, exp: Date.now() + 60_000 }, SECRET);
    assert.equal(verifySession(session), null);
  } finally {
    restore();
  }
});

test('CSRF 令牌校验通过且可循环使用', () => {
  const restore = setEnv({ ADMIN_SESSION_SECRET: SECRET });
  try {
    const token = createCsrfToken();
    assert.equal(verifyCsrfToken(token), true);
  } finally {
    restore();
  }
});

test('篡改后的 CSRF 令牌校验失败', () => {
  const restore = setEnv({ ADMIN_SESSION_SECRET: SECRET });
  try {
    const token = createCsrfToken();
    const [random, mac] = token.split('.');
    const tamperedMac = `${mac.startsWith('A') ? 'B' : 'A'}${mac.slice(1)}`;
    assert.equal(verifyCsrfToken(`${random}.${tamperedMac}`), false);
    assert.equal(verifyCsrfToken(`${random}.`), false);
    assert.equal(verifyCsrfToken('not-a-token'), false);
    assert.equal(verifyCsrfToken(undefined), false);
  } finally {
    restore();
  }
});

test('CSRF 令牌 base64 解码后不包含会话密钥', () => {
  const restore = setEnv({ ADMIN_SESSION_SECRET: SECRET });
  try {
    const token = createCsrfToken();
    const [random, mac] = token.split('.');
    assert.ok(!Buffer.from(random, 'base64url').toString('utf8').includes(SECRET));
    assert.ok(!Buffer.from(mac, 'base64url').toString('utf8').includes(SECRET));
    assert.ok(!token.includes(SECRET));
  } finally {
    restore();
  }
});

test('GET/HEAD 只读请求豁免 CSRF 校验', () => {
  const restore = setEnv({ ADMIN_SESSION_SECRET: SECRET });
  try {
    assert.equal(checkCsrf('GET', undefined, undefined), true);
    assert.equal(checkCsrf('HEAD', undefined, undefined), true);
    assert.equal(checkCsrf('get', undefined, undefined), true);
  } finally {
    restore();
  }
});

test('写方法缺少或伪造 CSRF 时被拒绝', () => {
  const restore = setEnv({ ADMIN_SESSION_SECRET: SECRET });
  try {
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      assert.equal(checkCsrf(method, undefined, undefined), false, `${method} 无令牌`);
      const token = createCsrfToken();
      assert.equal(checkCsrf(method, token, undefined), false, `${method} 缺请求头`);
      assert.equal(checkCsrf(method, token, `${token}x`), false, `${method} 令牌不符`);
      const other = createCsrfToken();
      assert.equal(checkCsrf(method, token, other), false, `${method} 令牌不匹配`);
    }
  } finally {
    restore();
  }
});

test('写方法携带匹配 CSRF 令牌时放行', () => {
  const restore = setEnv({ ADMIN_SESSION_SECRET: SECRET });
  try {
    const token = createCsrfToken();
    assert.equal(checkCsrf('POST', token, token), true);
    assert.equal(checkCsrf('patch', token, token), true);
  } finally {
    restore();
  }
});

test('生产环境缺少密钥时 validateAdminEnv 抛出中文错误', () => {
  const restore = setEnv({ NODE_ENV: 'production' });
  try {
    assert.throws(() => validateAdminEnv(), /管理员环境变量配置不完整/);
  } finally {
    restore();
  }
});

test('生产环境配置齐全时 validateAdminEnv 不抛出', () => {
  const restore = setEnv({ NODE_ENV: 'production', ADMIN_SESSION_SECRET: SECRET, ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD_HASH: '$argon2id$v=19$fake' });
  try {
    assert.doesNotThrow(() => validateAdminEnv());
  } finally {
    restore();
  }
});

test('非生产环境缺项时 validateAdminEnv 仅告警不抛出', () => {
  const restore = setEnv({ NODE_ENV: 'development' });
  try {
    assert.doesNotThrow(() => validateAdminEnv());
  } finally {
    restore();
  }
});

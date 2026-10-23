#!/usr/bin/env node
// 端到端冒烟：公开读取 → 安全负路径 → 管理端发布闭环（DRAFT→REVIEW→PUBLISHED→ARCHIVED→回滚）
// 零依赖（Node 22 原生 fetch / crypto），可在 GitHub Actions ubuntu 上直接复用。
// 环境变量：
//   BASE_URL                  被测服务地址，默认 http://127.0.0.1:3100
//   E2E_ADMIN_EMAIL           管理员邮箱，默认回落到 ADMIN_EMAIL，再默认 admin@example.com
//   E2E_ADMIN_PASSWORD        管理员明文密码（必填，仅用于登录请求，不写库不落盘）
//   E2E_EXPECTED_SOURCE_COUNT 来源索引期望条数，默认 46
import { createHmac } from 'node:crypto';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3100').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '';
const EXPECTED_SOURCES = Number(process.env.E2E_EXPECTED_SOURCE_COUNT || 46);

let failures = 0;
function pass(name) {
  console.log(`  ✓ ${name}`);
}
function fail(name, detail) {
  failures += 1;
  console.error(`  ✗ ${name} — ${detail}`);
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function step(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (error) {
    fail(name, error instanceof Error ? error.message : String(error));
  }
}

async function api(path, { method = 'GET', body, cookie, csrf } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (csrf) headers['x-csrf-token'] = csrf;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // 非 JSON 响应，保留 text 供断言语境使用
  }
  return { status: res.status, json, text, headers: res.headers };
}

function readSetCookies(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const jar = {};
  for (const line of raw) {
    const pair = line.split(';', 1)[0];
    const eq = pair.indexOf('=');
    if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return jar;
}

function forgedSessionCookie(email) {
  // 用与服务器无关的错误密钥自签，服务器必须拒收（401）
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 3_600_000 })).toString('base64url');
  const signature = createHmac('sha256', 'e2e-forged-wrong-secret').update(payload).digest('base64url');
  return `atlas_admin_session=${payload}.${signature}`;
}

async function waitForServer(attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {
      // 服务尚未就绪，继续等待
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`服务在 ${attempts}s 内未就绪：${BASE_URL}`);
}

const runId = Date.now().toString(36);
const testSlug = `e2e-smoke-${runId}`;
const testName = `E2E 冒烟测试时期 ${runId}`;
let sessionCookie = '';
let csrfToken = '';
let createdId = '';

console.log(`E2E 冒烟开始：${BASE_URL}`);

if (!ADMIN_PASSWORD) {
  console.error('缺少 E2E_ADMIN_PASSWORD 环境变量（管理员明文密码，仅用于登录请求）。');
  process.exit(2);
}

try {
  await waitForServer();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

await step('GET /api/health → 200 且报文标识 ok', async () => {
  const res = await api('/api/health');
  assert(res.status === 200, `期望 200，实际 ${res.status}：${res.text.slice(0, 120)}`);
  assert(res.json && (res.json.status === 'ok' || res.json.ok === true), `响应体缺少 ok 标识：${res.text.slice(0, 120)}`);
});

await step('GET /api/periods → 200，含已导入制度矩阵（时期名含"秦"）', async () => {
  const res = await api('/api/periods');
  assert(res.status === 200, `期望 200，实际 ${res.status}`);
  assert(res.json && Array.isArray(res.json.rows), `响应缺少 rows 数组：${res.text.slice(0, 120)}`);
  assert(res.json.total > 0, '制度矩阵为空，content:import 可能未运行');
  assert(res.json.rows.some((row) => String(row.period).includes('秦')), '矩阵行中未找到已知时期"秦（前221—前207）"');
});

await step(`GET /api/sources → 200 且恰好 ${EXPECTED_SOURCES} 条已发布来源`, async () => {
  const res = await api('/api/sources');
  assert(res.status === 200, `期望 200，实际 ${res.status}`);
  assert(res.json && res.json.total === EXPECTED_SOURCES, `期望 ${EXPECTED_SOURCES} 条，实际 ${res.json?.total}`);
});

await step('未登录 POST /api/admin/content/:id/publish → 401', async () => {
  const res = await api('/api/admin/content/any-id/publish', { method: 'POST', body: { entityType: 'period' } });
  assert(res.status === 401, `期望 401，实际 ${res.status}：${res.text.slice(0, 120)}`);
});

await step('伪造会话 cookie（错误密钥 HMAC 自签）→ 401', async () => {
  const res = await api('/api/admin/content/any-id/publish', {
    method: 'POST',
    body: { entityType: 'period' },
    cookie: forgedSessionCookie(ADMIN_EMAIL),
    csrf: 'forged',
  });
  assert(res.status === 401, `期望 401，实际 ${res.status}：${res.text.slice(0, 120)}`);
});

await step('错误密码登录 → 401', async () => {
  const res = await api('/api/admin/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: `${ADMIN_PASSWORD}-wrong` } });
  assert(res.status === 401, `期望 401，实际 ${res.status}：${res.text.slice(0, 120)}`);
});

await step('正确密码登录 → 200 且种下会话与 CSRF 两个 cookie', async () => {
  const res = await api('/api/admin/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  assert(res.status === 200, `期望 200，实际 ${res.status}：${res.text.slice(0, 120)}`);
  const jar = readSetCookies(res);
  assert(jar.atlas_admin_session, `缺少 atlas_admin_session cookie：${JSON.stringify(jar)}`);
  assert(jar.atlas_admin_csrf, `缺少 atlas_admin_csrf cookie：${JSON.stringify(jar)}`);
  sessionCookie = `atlas_admin_session=${jar.atlas_admin_session}; atlas_admin_csrf=${jar.atlas_admin_csrf}`;
  csrfToken = jar.atlas_admin_csrf;
});

await step('带会话但缺 x-csrf-token 的写请求 → 403', async () => {
  const res = await api('/api/admin/periods', { method: 'POST', body: { slug: `e2e-csrf-${runId}`, name: '不应创建' }, cookie: sessionCookie });
  assert(res.status === 403, `期望 403，实际 ${res.status}：${res.text.slice(0, 120)}`);
});

await step('带会话但 x-csrf-token 错误的写请求 → 403', async () => {
  const res = await api('/api/admin/periods', {
    method: 'POST',
    body: { slug: `e2e-csrf-${runId}`, name: '不应创建' },
    cookie: sessionCookie,
    csrf: 'wrong-token',
  });
  assert(res.status === 403, `期望 403，实际 ${res.status}：${res.text.slice(0, 120)}`);
});

await step('创建草稿 period → 201 且状态 DRAFT', async () => {
  const res = await api('/api/admin/periods', {
    method: 'POST',
    body: { slug: testSlug, name: testName, regimeGroup: testName, summary: 'E2E 冒烟测试创建，结尾归档清理', startYear: 1900, endYear: 1910 },
    cookie: sessionCookie,
    csrf: csrfToken,
  });
  assert(res.status === 201, `期望 201，实际 ${res.status}：${res.text.slice(0, 200)}`);
  assert(res.json?.id, '响应缺少 id');
  assert(res.json.status === 'DRAFT', `新内容应为 DRAFT，实际 ${res.json.status}`);
  createdId = res.json.id;
});

const slugUrl = `/api/periods/${encodeURIComponent(testSlug)}`;
const actionUrl = (action) => `/api/admin/content/${createdId}/${action}`;
const adminPost = (url) => api(url, { method: 'POST', body: { entityType: 'period' }, cookie: sessionCookie, csrf: csrfToken });

await step('草稿对公开不可见：GET /api/periods/[slug] → 404', async () => {
  const res = await api(slugUrl);
  assert(res.status === 404, `期望 404，实际 ${res.status}`);
});

await step('草稿不出现在制度矩阵行中', async () => {
  const res = await api('/api/periods');
  assert(res.status === 200, `期望 200，实际 ${res.status}`);
  assert(!res.json.rows.some((row) => String(row.period).includes(testName)), '草稿 period 泄漏进公开矩阵');
});

await step('DRAFT 直接 publish → 409（非法迁移）', async () => {
  const res = await adminPost(actionUrl('publish'));
  assert(res.status === 409, `期望 409，实际 ${res.status}：${res.text.slice(0, 160)}`);
});

await step('submit-review → 200 REVIEW，且公开仍不可见', async () => {
  const res = await adminPost(actionUrl('submit-review'));
  assert(res.status === 200, `期望 200，实际 ${res.status}：${res.text.slice(0, 160)}`);
  assert(res.json?.status === 'REVIEW', `期望 REVIEW，实际 ${res.json?.status}`);
  const pub = await api(slugUrl);
  assert(pub.status === 404, `REVIEW 状态应对公开不可见，实际 ${pub.status}`);
});

await step('publish → 200 PUBLISHED，且 GET /api/periods/[slug] → 200', async () => {
  const res = await adminPost(actionUrl('publish'));
  assert(res.status === 200, `期望 200，实际 ${res.status}：${res.text.slice(0, 160)}`);
  assert(res.json?.status === 'PUBLISHED', `期望 PUBLISHED，实际 ${res.json?.status}`);
  const pub = await api(slugUrl);
  assert(pub.status === 200, `发布后应公开可见，实际 ${pub.status}：${pub.text.slice(0, 120)}`);
  assert(pub.json?.period === testName, `公开时期名不匹配：${pub.json?.period}`);
});

await step('archive → 200，且公开不再可见', async () => {
  const res = await adminPost(actionUrl('archive'));
  assert(res.status === 200, `期望 200，实际 ${res.status}：${res.text.slice(0, 160)}`);
  assert(res.json?.status === 'ARCHIVED', `期望 ARCHIVED，实际 ${res.json?.status}`);
  const pub = await api(slugUrl);
  assert(pub.status === 404, `归档后应不可见，实际 ${pub.status}`);
});

await step('rollback → 200，恢复到归档前快照（PUBLISHED，重新可见）', async () => {
  const res = await adminPost(actionUrl('rollback'));
  assert(res.status === 200, `期望 200，实际 ${res.status}：${res.text.slice(0, 200)}`);
  assert(res.json?.status === 'PUBLISHED', `回滚应恢复 PUBLISHED，实际 ${res.json?.status}`);
  const pub = await api(slugUrl);
  assert(pub.status === 200, `回滚后应按快照恢复可见，实际 ${pub.status}`);
});

await step('GET /api/periods/[未知 slug] → 404', async () => {
  const res = await api('/api/periods/no-such-period-e2e');
  assert(res.status === 404, `期望 404，实际 ${res.status}`);
});

await step('清理：测试 period 重新归档 → 200，公开不可见', async () => {
  const res = await adminPost(actionUrl('archive'));
  assert(res.status === 200, `期望 200，实际 ${res.status}：${res.text.slice(0, 160)}`);
  const pub = await api(slugUrl);
  assert(pub.status === 404, `清理后应不可见，实际 ${pub.status}`);
});

console.log('');
if (failures > 0) {
  console.error(`E2E 冒烟失败：${failures} 项未通过。`);
  process.exit(1);
}
console.log('E2E 冒烟全部通过。');
console.log(`备注：测试 period（id=${createdId || '未创建'}）已归档留存于库中，下一次迁移重置将清除。`);

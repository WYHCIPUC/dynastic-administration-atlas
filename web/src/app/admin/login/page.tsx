'use client';

import { useState } from 'react';

export default function AdminLoginPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) window.location.href = '/admin'; else setError(data.error ?? '登录失败');
    setBusy(false);
  }
  return <main className="admin-shell"><form className="admin-card" onSubmit={submit}><div className="eyebrow">Administrator access</div><h1>进入内容后台</h1><p>管理员密码使用 Argon2id 校验，会话写入 HttpOnly Cookie。公开端不需要登录。</p><label>管理员邮箱<input type="email" name="email" placeholder="admin@example.com" required /></label><label>密码<input type="password" name="password" required /></label>{error && <div className="error" role="alert">{error}</div>}<button className="primary-button" type="submit" disabled={busy}>{busy ? '验证中…' : '登录'}</button><a className="back-link" href="/">← 返回公开研究站</a></form></main>;
}

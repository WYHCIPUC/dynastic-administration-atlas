'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  useEffect(() => { fetch('/api/admin/session').then(async (response) => { const data = await response.json(); setAuthenticated(Boolean(data.authenticated)); setEmail(data.email ?? ''); }).catch(() => setAuthenticated(false)); }, []);
  if (authenticated === null) return <main className="admin-shell"><div className="admin-card">正在验证管理员会话…</div></main>;
  if (!authenticated) return <main className="admin-shell"><div className="admin-card"><div className="eyebrow">Administrator access</div><h1>需要登录</h1><p>公开研究内容无需登录；编辑、审核、发布和回滚操作需要管理员会话。</p><a className="primary-button back-link" href="/admin/login">前往登录</a><a className="back-link" href="/">← 返回公开研究站</a></div></main>;
  const links = [['制度卡片', '/admin/periods'], ['官职与生活', '/admin/offices'], ['生活百科', '/admin/lifestyle'], ['来源登记', '/admin/sources'], ['证据主张', '/admin/claims'], ['版本记录', '/admin/versions']];
  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/');
  }
  return <main className="admin-shell"><div className="admin-card"><div className="eyebrow">Content control room · {email}</div><h1>内容管理后台</h1><p>内容按草稿、待审核、已发布和已归档流转。每次写操作应记录管理员、时间、前后版本和来源变化。</p><div className="admin-grid">{links.map(([item, href], index) => <a className="admin-tile" href={href} key={item}><span>0{index + 1}</span><strong>{item}</strong><small>进入内容列表与状态工作流 →</small></a>)}</div><button className="primary-button" onClick={() => { void logout(); }}>退出登录</button><a className="back-link" href="/">← 返回公开研究站</a></div></main>;
}

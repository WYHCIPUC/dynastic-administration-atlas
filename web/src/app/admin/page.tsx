'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/components/admin/admin-api';

interface StatusCounts {
  total: number;
  DRAFT: number;
  REVIEW: number;
  PUBLISHED: number;
  ARCHIVED: number;
}

interface Overview {
  period: StatusCounts;
  office: StatusCounts;
  lifestyle: StatusCounts;
  source: StatusCounts;
  claim: StatusCounts;
  audit: { total: number };
}

const TILES: Array<{ key: keyof Overview; label: string; href: string }> = [
  { key: 'period', label: '制度卡片', href: '/admin/periods' },
  { key: 'office', label: '官职与生活', href: '/admin/offices' },
  { key: 'lifestyle', label: '生活百科', href: '/admin/lifestyle' },
  { key: 'source', label: '来源登记', href: '/admin/sources' },
  { key: 'claim', label: '证据主张', href: '/admin/claims' },
  { key: 'audit', label: '版本记录', href: '/admin/versions' },
];

function distribution(counts: StatusCounts) {
  return `草稿 ${counts.DRAFT} · 待审 ${counts.REVIEW} · 发布 ${counts.PUBLISHED} · 归档 ${counts.ARCHIVED}`;
}

function countsFor(overview: Overview | null, key: keyof Overview): StatusCounts | null {
  if (!overview || key === 'audit') return null;
  return overview[key];
}

export default function AdminPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewError, setOverviewError] = useState('');

  useEffect(() => {
    fetch('/api/admin/session')
      .then(async (response) => {
        const data = await response.json();
        setAuthenticated(Boolean(data.authenticated));
        setEmail(data.email ?? '');
      })
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    adminFetch<Overview>('/api/admin/overview')
      .then(setOverview)
      .catch((err: unknown) => setOverviewError(err instanceof Error ? err.message : '统计加载失败'));
  }, [authenticated]);

  if (authenticated === null) return <main className="admin-shell"><div className="admin-card">正在验证管理员会话…</div></main>;
  if (!authenticated) return <main className="admin-shell"><div className="admin-card"><div className="eyebrow">Administrator access</div><h1>需要登录</h1><p>公开研究内容无需登录；编辑、审核、发布和回滚操作需要管理员会话。</p><a className="primary-button back-link" href="/admin/login">前往登录</a><a className="back-link" href="/">← 返回公开研究站</a></div></main>;

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <main className="admin-shell admin-shell-wide">
      <div className="admin-card admin-card-wide">
        <div className="eyebrow">Content control room · {email}</div>
        <h1>内容管理后台</h1>
        <p>内容按草稿、待审核、已发布和已归档流转。每次写操作会记录管理员、时间、前后版本和变更原因。</p>
        {overviewError && <div className="error" role="alert">内容统计加载失败：{overviewError}</div>}
        <div className="admin-grid">
          {TILES.map((tile, index) => {
            const counts = countsFor(overview, tile.key);
            return (
              <a className="admin-tile" href={tile.href} key={tile.key}>
                <span>0{index + 1}</span>
                <strong>{tile.label}</strong>
                {counts && <span className="tile-count">{counts.total}<small className="tile-dist">{distribution(counts)}</small></span>}
                {tile.key === 'audit' && overview && <span className="tile-count">{overview.audit.total}<small className="tile-dist">条审计记录</small></span>}
                {!overview && !overviewError && <small>统计加载中…</small>}
                <small>进入内容列表与状态工作流 →</small>
              </a>
            );
          })}
        </div>
        <button className="primary-button" onClick={() => { void logout(); }}>退出登录</button>
        <a className="back-link" href="/">← 返回公开研究站</a>
      </div>
    </main>
  );
}

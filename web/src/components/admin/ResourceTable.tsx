'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { adminFetch, AdminApiError, type ListResponse } from './admin-api';

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  REVIEW: '待审核',
  PUBLISHED: '已发布',
  ARCHIVED: '已归档',
};

export const ENTITY_LABELS: Record<string, string> = {
  period: '制度时期',
  office: '官职',
  lifestyle: '生活百科',
  source: '来源',
  claim: '证据主张',
  mappingRule: '映射规则',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

const ACTIONS_BY_STATUS: Record<string, Array<{ action: string; label: string; primary?: boolean }>> = {
  DRAFT: [{ action: 'submit-review', label: '提交审核' }],
  REVIEW: [{ action: 'publish', label: '发布', primary: true }, { action: 'archive', label: '归档' }],
  PUBLISHED: [{ action: 'archive', label: '归档' }],
  ARCHIVED: [],
};

export function StatusActions({ entityType, id, status, onChanged }: { entityType: string; id: string; status: string; onChanged: () => void }) {
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  async function run(action: string) {
    setBusy(action);
    setNote(null);
    try {
      await adminFetch(`/api/admin/content/${id}/${action}`, { method: 'POST', body: { entityType } });
      setNote({ kind: 'ok', text: '已更新' });
      onChanged();
    } catch (error) {
      setNote({ kind: 'error', text: error instanceof Error ? error.message : '操作失败' });
    } finally {
      setBusy('');
    }
  }
  const actions = ACTIONS_BY_STATUS[status] ?? [];
  return (
    <div className="row-actions">
      {actions.map((item) => (
        <button
          key={item.action}
          className={item.primary ? 'mini-button primary' : 'mini-button'}
          disabled={busy !== ''}
          onClick={() => { void run(item.action); }}
        >
          {busy === item.action ? '处理中…' : item.label}
        </button>
      ))}
      <button className="mini-button" disabled={busy !== ''} onClick={() => { void run('rollback'); }}>
        {busy === 'rollback' ? '处理中…' : '回滚'}
      </button>
      {note && <span className={`action-note ${note.kind === 'error' ? 'error-note' : 'ok-note'}`} role={note.kind === 'error' ? 'alert' : undefined}>{note.text}</span>}
    </div>
  );
}

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
}

export function AdminTable<T>({ columns, rows, rowKey }: { columns: Array<Column<T>>; rows: T[]; rowKey: (row: T) => string }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.header}>{column.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => <td key={column.header}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPageShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <main className="admin-shell admin-shell-wide">
      <div className="admin-card admin-card-wide">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
        <a className="back-link" href="/admin">← 返回后台首页</a>
      </div>
    </main>
  );
}

export function ListState({ loading, error, empty }: { loading: boolean; error: string; empty: boolean }) {
  if (loading) return <div className="empty">正在加载…</div>;
  if (error) return <div className="error" role="alert">{error}</div>;
  if (empty) return <div className="empty">暂无内容，可先通过下方或创建接口新增。</div>;
  return null;
}

export function Pagination({ total, limit, offset, onPage }: { total: number; limit: number; offset: number; onPage: (offset: number) => void }) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="pagination">
      <button className="mini-button" disabled={offset <= 0} onClick={() => onPage(Math.max(0, offset - limit))}>上一页</button>
      <span>第 {page} / {pages} 页 · 共 {total} 条</span>
      <button className="mini-button" disabled={offset + limit >= total} onClick={() => onPage(offset + limit)}>下一页</button>
    </div>
  );
}

export function useAdminList<T>(path: string, options: { limit?: number; offset?: number } = {}) {
  const { limit = 100, offset = 0 } = options;
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<ListResponse<T>>(`${path}?limit=${limit}&offset=${offset}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      if (!(err instanceof AdminApiError && err.status === 401)) {
        setError(err instanceof Error ? err.message : '加载失败');
      }
    } finally {
      setLoading(false);
    }
  }, [path, limit, offset]);
  useEffect(() => { void reload(); }, [reload]);
  return { items, total, loading, error, reload };
}

export function jsonPreview(value: unknown, max = 3): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) {
    const parts = value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
    const joined = parts.slice(0, max).join('、');
    return parts.length > max ? `${joined} 等 ${parts.length} 项` : joined || '—';
  }
  if (typeof value === 'string') return value || '—';
  return JSON.stringify(value);
}

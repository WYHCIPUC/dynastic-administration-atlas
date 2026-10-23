'use client';

import { useState, type FormEvent } from 'react';
import { adminFetch } from '@/components/admin/admin-api';
import { AdminPageShell, AdminTable, ListState, StatusActions, StatusBadge, useAdminList } from '@/components/admin/ResourceTable';

interface PeriodRow {
  id: string;
  slug: string;
  name: string;
  startYear: number | null;
  endYear: number | null;
  regimeGroup: string;
  summary: string;
  status: string;
  _count?: { offices: number };
}

export default function AdminPeriodsPage() {
  const { items, total, loading, error, reload } = useAdminList<PeriodRow>('/api/admin/periods');
  const [formError, setFormError] = useState('');
  const [formOk, setFormOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    const year = (key: string) => {
      const raw = text(key);
      if (!raw) return undefined;
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    setBusy(true);
    setFormError('');
    setFormOk('');
    try {
      await adminFetch('/api/admin/periods', {
        method: 'POST',
        body: {
          slug: text('slug'),
          name: text('name'),
          startYear: year('startYear'),
          endYear: year('endYear'),
          regimeGroup: text('regimeGroup') || undefined,
          summary: text('summary'),
        },
      });
      formEl.reset();
      setFormOk('已创建草稿。');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell eyebrow="Content control room" title="制度时期卡" description={`创建、提交审核和发布时期制度摘要。当前共 ${total} 条。`}>
      <ListState loading={loading} error={error} empty={items.length === 0} />
      {!loading && !error && items.length > 0 && (
        <AdminTable<PeriodRow>
          rowKey={(row) => row.id}
          columns={[
            {
              header: '名称',
              render: (row) => (
                <span className="cell-title">{row.name}<span className="cell-sub">{row.slug}</span></span>
              ),
            },
            {
              header: '年代',
              render: (row) => (row.startYear !== null || row.endYear !== null ? `${row.startYear ?? '？'} — ${row.endYear ?? '？'}` : '—'),
            },
            { header: '政权组', render: (row) => row.regimeGroup },
            { header: '官职数', render: (row) => row._count?.offices ?? 0 },
            { header: '状态', render: (row) => <StatusBadge status={row.status} /> },
            {
              header: '操作',
              render: (row) => <StatusActions entityType="period" id={row.id} status={row.status} onChanged={() => { void reload(); }} />,
            },
          ]}
          rows={items}
        />
      )}
      <form className="admin-form" onSubmit={create}>
        <strong className="admin-form-title">新增时期</strong>
        <label>slug（唯一标识，如 han-western）<input name="slug" required placeholder="han-western" /></label>
        <label>名称<input name="name" required placeholder="西汉" /></label>
        <label>开始年份（公元前用负数）<input name="startYear" type="number" placeholder="-202" /></label>
        <label>结束年份<input name="endYear" type="number" placeholder="8" /></label>
        <label>政权组（默认同名称）<input name="regimeGroup" placeholder="汉" /></label>
        <label className="form-full">制度摘要<textarea name="summary" rows={3} placeholder="这一时期的制度要点…" /></label>
        {formError && <div className="error form-full" role="alert">{formError}</div>}
        {formOk && <div className="ok-note form-full">{formOk}</div>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? '提交中…' : '创建时期草稿'}</button>
      </form>
    </AdminPageShell>
  );
}

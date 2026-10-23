'use client';

import { useState, type FormEvent } from 'react';
import { adminFetch } from '@/components/admin/admin-api';
import { AdminPageShell, AdminTable, ListState, StatusActions, StatusBadge, useAdminList } from '@/components/admin/ResourceTable';

interface OfficeRow {
  id: string;
  slug: string;
  name: string;
  institutionLevel: string;
  rankOrGrade: string | null;
  status: string;
  periodId: string;
  period?: { id: string; name: string; slug: string };
}

interface PeriodOption {
  id: string;
  name: string;
}

export default function AdminOfficesPage() {
  const { items, total, loading, error, reload } = useAdminList<OfficeRow>('/api/admin/offices');
  const periods = useAdminList<PeriodOption>('/api/admin/periods');
  const [formError, setFormError] = useState('');
  const [formOk, setFormOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    const aliases = text('aliases').split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean);
    setBusy(true);
    setFormError('');
    setFormOk('');
    try {
      await adminFetch('/api/admin/offices', {
        method: 'POST',
        body: {
          slug: text('slug'),
          name: text('name'),
          periodId: text('periodId'),
          institutionLevel: text('institutionLevel') || '中央',
          aliases,
          rankOrGrade: text('rankOrGrade') || undefined,
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
    <AdminPageShell eyebrow="Content control room" title="官职与生活" description={`维护官职职责、边界与生活条目。当前共 ${total} 条。`}>
      <ListState loading={loading} error={error} empty={items.length === 0} />
      {!loading && !error && items.length > 0 && (
        <AdminTable<OfficeRow>
          rowKey={(row) => row.id}
          columns={[
            {
              header: '名称',
              render: (row) => (
                <span className="cell-title">{row.name}<span className="cell-sub">{row.slug}</span></span>
              ),
            },
            { header: '所属时期', render: (row) => row.period?.name ?? row.periodId },
            { header: '层级', render: (row) => row.institutionLevel },
            { header: '品级', render: (row) => row.rankOrGrade ?? '—' },
            { header: '状态', render: (row) => <StatusBadge status={row.status} /> },
            {
              header: '操作',
              render: (row) => <StatusActions entityType="office" id={row.id} status={row.status} onChanged={() => { void reload(); }} />,
            },
          ]}
          rows={items}
        />
      )}
      <form className="admin-form" onSubmit={create}>
        <strong className="admin-form-title">新增官职</strong>
        <label>slug（唯一标识，如 chengxiang）<input name="slug" required placeholder="chengxiang" /></label>
        <label>名称<input name="name" required placeholder="丞相" /></label>
        <label>所属时期
          <select name="periodId" required defaultValue="">
            <option value="" disabled>选择时期…</option>
            {periods.items.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
          </select>
        </label>
        <label>机构层级<input name="institutionLevel" placeholder="中央" /></label>
        <label>别名（逗号或空格分隔）<input name="aliases" placeholder="相国 相邦" /></label>
        <label>品级<input name="rankOrGrade" placeholder="万石" /></label>
        {formError && <div className="error form-full" role="alert">{formError}</div>}
        {formOk && <div className="ok-note form-full">{formOk}</div>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? '提交中…' : '创建官职草稿'}</button>
      </form>
    </AdminPageShell>
  );
}

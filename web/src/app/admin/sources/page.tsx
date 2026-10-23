'use client';

import { AdminPageShell, AdminTable, ListState, StatusBadge, useAdminList } from '@/components/admin/ResourceTable';

interface SourceRow {
  id: string;
  title: string;
  authorOrInstitution: string | null;
  year: string | null;
  sourceType: string;
  authorityGrade: string;
  locator: string | null;
  url: string | null;
  status: string;
}

export default function AdminSourcesPage() {
  const { items, total, loading, error } = useAdminList<SourceRow>('/api/admin/sources');

  return (
    <AdminPageShell eyebrow="Content control room" title="来源登记" description={`原典、档案、考古与学术研究资料台账。当前共 ${total} 条。`}>
      <ListState loading={loading} error={error} empty={items.length === 0} />
      {!loading && !error && items.length > 0 && (
        <AdminTable<SourceRow>
          rowKey={(row) => row.id}
          columns={[
            {
              header: '题名',
              render: (row) => (
                <span className="cell-title">
                  {row.title}
                  <span className="cell-sub">{row.id}{row.authorOrInstitution ? ` · ${row.authorOrInstitution}` : ''}</span>
                </span>
              ),
            },
            { header: '类型', render: (row) => row.sourceType },
            { header: '年代', render: (row) => row.year ?? '—' },
            { header: '等级', render: (row) => <span className={`source-level level-${row.authorityGrade}`}>{row.authorityGrade}</span> },
            { header: '定位', render: (row) => row.locator ?? '—' },
            { header: '状态', render: (row) => <StatusBadge status={row.status} /> },
          ]}
          rows={items}
        />
      )}
    </AdminPageShell>
  );
}

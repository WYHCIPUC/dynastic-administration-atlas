'use client';

import { AdminPageShell, AdminTable, ENTITY_LABELS, ListState, StatusBadge, useAdminList } from '@/components/admin/ResourceTable';

interface ClaimRow {
  id: string;
  entityType: string;
  claimText: string;
  citationLocator: string | null;
  evidenceLevel: string;
  uncertaintyType: string;
  status: string;
  source?: { id: string; title: string };
  period?: { id: string; name: string } | null;
  office?: { id: string; name: string } | null;
}

export default function AdminClaimsPage() {
  const { items, total, loading, error } = useAdminList<ClaimRow>('/api/admin/claims');

  return (
    <AdminPageShell eyebrow="Content control room" title="证据主张" description={`可审核主张与其来源、定位、证据等级和不确定性。当前共 ${total} 条。`}>
      <ListState loading={loading} error={error} empty={items.length === 0} />
      {!loading && !error && items.length > 0 && (
        <AdminTable<ClaimRow>
          rowKey={(row) => row.id}
          columns={[
            {
              header: '主张',
              render: (row) => (
                <span className="cell-title cell-claim">
                  {row.claimText}
                  <span className="cell-sub">{row.citationLocator ? `定位：${row.citationLocator}` : '未标注定位'}</span>
                </span>
              ),
            },
            {
              header: '关联实体',
              render: (row) => (
                <>
                  {ENTITY_LABELS[row.entityType] ?? row.entityType}
                  <span className="cell-sub">{row.office?.name ?? row.period?.name ?? '—'}</span>
                </>
              ),
            },
            { header: '证据等级', render: (row) => <span className={`source-level level-${row.evidenceLevel}`}>{row.evidenceLevel}</span> },
            {
              header: '来源',
              render: (row) => (
                <>
                  {row.source?.title ?? row.id}
                  <span className="cell-sub">{row.uncertaintyType}</span>
                </>
              ),
            },
            { header: '状态', render: (row) => <StatusBadge status={row.status} /> },
          ]}
          rows={items}
        />
      )}
    </AdminPageShell>
  );
}

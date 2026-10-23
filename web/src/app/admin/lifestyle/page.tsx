'use client';

import { AdminPageShell, AdminTable, jsonPreview, ListState, StatusBadge, useAdminList } from '@/components/admin/ResourceTable';

interface LifestyleRow {
  id: string;
  typicalTasks: unknown;
  scheduleOrWorkCycle: unknown;
  risks: unknown;
  transport: string | null;
  foodAndConsumption: string | null;
  status: string;
  updatedAt: string;
  office?: { id: string; name: string; slug: string; period?: { name: string } };
}

export default function AdminLifestylePage() {
  const { items, total, loading, error } = useAdminList<LifestyleRow>('/api/admin/lifestyle');

  return (
    <AdminPageShell eyebrow="Content control room" title="生活百科条目" description={`各官职的工作周期、居住、饮食、医疗、家庭与娱乐条目。当前共 ${total} 条。`}>
      <ListState loading={loading} error={error} empty={items.length === 0} />
      {!loading && !error && items.length > 0 && (
        <AdminTable<LifestyleRow>
          rowKey={(row) => row.id}
          columns={[
            {
              header: '官职',
              render: (row) => (
                <span className="cell-title">
                  {row.office?.name ?? row.id}
                  <span className="cell-sub">{row.office?.period?.name ?? ''}{row.office ? ` · ${row.office.slug}` : ''}</span>
                </span>
              ),
            },
            { header: '典型任务', render: (row) => jsonPreview(row.typicalTasks) },
            { header: '作息周期', render: (row) => jsonPreview(row.scheduleOrWorkCycle) },
            { header: '饮食消费', render: (row) => row.foodAndConsumption ?? '—' },
            { header: '风险', render: (row) => jsonPreview(row.risks, 2) },
            { header: '状态', render: (row) => <StatusBadge status={row.status} /> },
            { header: '更新于', render: (row) => new Date(row.updatedAt).toLocaleDateString('zh-CN') },
          ]}
          rows={items}
        />
      )}
    </AdminPageShell>
  );
}

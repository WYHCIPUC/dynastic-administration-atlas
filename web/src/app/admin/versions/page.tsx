'use client';

import { useState } from 'react';
import { AdminPageShell, AdminTable, ENTITY_LABELS, ListState, Pagination, useAdminList } from '@/components/admin/ResourceTable';

interface AuditRow {
  id: string;
  adminId: string;
  entityType: string;
  entityId: string;
  action: string;
  reason: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '更新',
  REVIEW: '提交审核',
  PUBLISHED: '发布',
  ARCHIVED: '归档',
  rollback: '回滚',
};

const PAGE_SIZE = 20;

export default function AdminVersionsPage() {
  const [offset, setOffset] = useState(0);
  const { items, total, loading, error } = useAdminList<AuditRow>('/api/admin/audit', { limit: PAGE_SIZE, offset });

  return (
    <AdminPageShell eyebrow="Content control room" title="版本与审计" description={`发布、归档和回滚记录，保留修改前后快照与变更原因。共 ${total} 条。`}>
      <ListState loading={loading} error={error} empty={items.length === 0} />
      {!loading && !error && items.length > 0 && (
        <>
          <AdminTable<AuditRow>
            rowKey={(row) => row.id}
            columns={[
              { header: '时间', render: (row) => new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false }) },
              { header: '操作者', render: (row) => row.adminId },
              {
                header: '实体',
                render: (row) => (
                  <>
                    {ENTITY_LABELS[row.entityType] ?? row.entityType}
                    <span className="cell-sub" title={row.entityId}>{row.entityId.slice(0, 10)}…</span>
                  </>
                ),
              },
              { header: '动作', render: (row) => <span className={`audit-action audit-${row.action}`}>{ACTION_LABELS[row.action] ?? row.action}</span> },
              { header: '原因', render: (row) => row.reason ?? '—' },
            ]}
            rows={items}
          />
          <Pagination total={total} limit={PAGE_SIZE} offset={offset} onPage={setOffset} />
        </>
      )}
    </AdminPageShell>
  );
}

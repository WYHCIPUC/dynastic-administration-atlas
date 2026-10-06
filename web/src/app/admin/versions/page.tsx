import AdminResourcePage from '@/components/AdminResourcePage';
export default function AdminVersionsPage() { return <AdminResourcePage title="版本与审计" description="查看发布、归档和回滚记录，保留修改前后快照与变更原因。" endpoint="AdminAuditLog · /api/admin/content/:id/rollback" />; }

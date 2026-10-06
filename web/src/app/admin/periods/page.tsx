import AdminResourcePage from '@/components/AdminResourcePage';
export default function AdminPeriodsPage() { return <AdminResourcePage title="制度时期卡" description="创建、编辑、提交审核和发布时期制度摘要。" endpoint="POST /api/admin/periods · PATCH /api/admin/periods/:id" />; }

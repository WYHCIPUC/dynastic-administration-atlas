import AdminResourcePage from '@/components/AdminResourcePage';
export default function AdminOfficesPage() { return <AdminResourcePage title="官职与生活百科" description="维护官职职责、边界、服饰、日程、生活和风险条目。" endpoint="POST /api/admin/offices · POST /api/admin/content/:id/publish" />; }

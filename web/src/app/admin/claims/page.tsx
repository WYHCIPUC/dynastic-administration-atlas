import AdminResourcePage from '@/components/AdminResourcePage';
export default function AdminClaimsPage() { return <AdminResourcePage title="证据主张" description="把公开结论拆成可审核主张，关联来源、定位、证据等级和不确定性。" endpoint="POST /api/admin/claims" />; }

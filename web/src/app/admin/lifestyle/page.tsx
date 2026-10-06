import AdminResourcePage from '@/components/AdminResourcePage';
export default function AdminLifestylePage() { return <AdminResourcePage title="生活百科条目" description="为每个官职补充工作周期、居住、饮食、医疗、家庭与娱乐证据。" endpoint="POST /api/admin/content/:id/{submit-review|publish|archive|rollback}" />; }

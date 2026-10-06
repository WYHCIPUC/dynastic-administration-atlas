export default function AdminResourcePage({ title, description, endpoint }: { title: string; description: string; endpoint: string }) {
  return <main className="admin-shell"><div className="admin-card"><div className="eyebrow">Content control room</div><h1>{title}</h1><p>{description}</p><div className="admin-tile"><strong>管理接口</strong><small>{endpoint}</small><small>所有写操作需要管理员会话、CSRF Token，并写入审计日志。</small></div><a className="back-link" href="/admin">← 返回后台首页</a></div></main>;
}

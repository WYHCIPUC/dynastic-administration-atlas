import PublicShell from '@/components/PublicShell';

export default function NotFound() {
  return (
    <PublicShell>
      <main className="public-page">
        <a className="back-link" href="/">← 返回首页</a>
        <div className="eyebrow">404</div>
        <h1>页面不存在或尚未发布</h1>
        <p className="lead">你访问的内容不存在、已下线，或仍在后台审核中。可以返回首页重新匹配，或到制度浏览与来源索引继续查阅。</p>
      </main>
    </PublicShell>
  );
}

import { loadPublishedSources } from '@/lib/published-content';
import PublicShell from '@/components/PublicShell';

export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  const sources = await loadPublishedSources();
  return <PublicShell active="sources"><main className="public-page"><a className="back-link" href="/">← 返回首页</a><div className="eyebrow">来源索引</div><h1>原典、档案与研究资料</h1><p className="lead">来源等级用于说明证据性质，不代表单条材料可以独立证明全部结论。</p><div className="source-table">{sources.map((source) => <article className="source-item" key={source.source_id}><div><strong>{source.source_id} · {source.title}</strong><p>{source.author_or_institution} · {source.coverage}</p>{source.locator && <small>定位：{source.locator}</small>}{source.url && <a href={source.url} target="_blank" rel="noreferrer">打开来源 ↗</a>}</div><span className={`source-level level-${source.authority_grade}`}>{source.authority_grade}</span></article>)}</div></main></PublicShell>;
}

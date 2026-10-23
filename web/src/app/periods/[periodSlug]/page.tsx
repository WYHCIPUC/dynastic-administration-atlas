import { notFound } from 'next/navigation';
import { findPublishedPeriod, loadPublishedSources } from '@/lib/published-content';
import PublicShell from '@/components/PublicShell';

export const dynamic = 'force-dynamic';

export default async function PeriodDetailPage({ params }: { params: Promise<{ periodSlug: string }> }) {
  const { periodSlug } = await params;
  const found = await findPublishedPeriod(decodeURIComponent(periodSlug));
  if (!found) notFound();
  const sources = await loadPublishedSources();
  const sourceIds = new Set(found.rows.flatMap((row) => String(row.source_ids ?? '').split(';').filter(Boolean)));
  return <PublicShell active="periods"><main className="public-page"><a className="back-link" href="/periods">← 返回制度浏览</a><div className="eyebrow">时期制度卡</div><h1>{found.name}</h1><p className="lead">法定制度、实际运行和改革危机并列呈现；跨朝比较时请结合来源等级和时期边界阅读。</p><div className="detail-list">{found.rows.map((row) => <article className="browse-card" key={`${row.period}-${row.dimension}`}><span>{row.dimension} · {row.evidence_grade}</span><h2>制度结构</h2><p>{row.legal_structure}</p><h3>实际运行</h3><p>{row.actual_operation}</p><h3>改革与危机</h3><p>{row.reforms_risks}</p></article>)}</div><h2>相关来源</h2><ul className="source-links">{sources.filter((source) => sourceIds.has(source.source_id)).map((source) => <li key={source.source_id}><strong>{source.source_id} · {source.title}</strong>{source.url && <> · <a href={source.url} target="_blank" rel="noreferrer">打开</a></>}</li>)}</ul></main></PublicShell>;
}

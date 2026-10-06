import { loadExamples } from '@/lib/content';
import PublicShell from '@/components/PublicShell';

function slugify(value: string) { return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, ''); }

export default async function OfficeDetailPage({ params }: { params: Promise<{ officeSlug: string }> }) {
  const { officeSlug } = await params;
  const examples = await loadExamples();
  const found = examples.flatMap((example) => [example.primary, ...example.alternatives].map((candidate) => ({ candidate, modern: example.modern_input, slug: `${slugify(candidate.ancient_candidate)}-${slugify(example.modern_input)}` }))).find((item) => item.slug === officeSlug || slugify(item.candidate.ancient_candidate) === officeSlug);
  if (!found) return <PublicShell><main className="public-page"><a className="back-link" href="/">← 返回首页</a><h1>官职不存在</h1><p>请从职位匹配结果进入具体官职档案。</p></main></PublicShell>;
  const { candidate, modern } = found;
  return <PublicShell active="match"><main className="public-page"><a className="back-link" href="/">← 返回首页</a><div className="eyebrow">官职档案 · 功能类比</div><h1>{candidate.ancient_candidate}</h1><p className="lead">现代示例：{modern}。相似度 {Math.round(candidate.similarity * 100)}%，置信度{candidate.confidence}；该结果不把现代职级直接换算为古代品秩。</p><div className="detail-list"><article className="browse-card"><h2>职责与边界</h2><p>{candidate.duty_difference}</p><h2>典型日常</h2><ul>{candidate.daily_activities.map((item) => <li key={item}>{item}</li>)}</ul></article><article className="browse-card"><h2>服饰与生活</h2><p>{candidate.clothing}</p><p>{candidate.life}</p><h2>风险</h2><ul>{candidate.risks.map((item) => <li key={item}>{item}</li>)}</ul><small>证据等级：{candidate.evidence_level} · 来源：{candidate.source_ids.join('、')}</small></article></div></main></PublicShell>;
}

import { prisma } from '@/lib/prisma';
import PublicShell from '@/components/PublicShell';

export default async function SharedMatchPage({ params }: { params: Promise<{ queryId: string }> }) {
  const { queryId } = await params;
  let result: any = null;
  try { const saved = await prisma.matchQuery.findUnique({ where: { id: queryId } }); result = saved ? { input: saved.input, ...(saved.result as object) } : null; } catch { result = null; }
  if (!result) return <PublicShell active="match"><main className="public-page"><a className="back-link" href="/">← 返回首页</a><div className="eyebrow">可分享的匹配结果</div><h1>结果暂不可用</h1><p className="lead">该结果可能已过期，或当前数据库尚未连接。可以返回首页重新匹配。</p><a className="primary-button back-link" href={`/api/matching/${queryId}`}>查看 API 状态</a></main></PublicShell>;
  return <PublicShell active="match"><main className="public-page"><a className="back-link" href="/">← 返回首页</a><div className="eyebrow">可分享的匹配结果 · {result.input?.rawText}</div><h1>历史官职候选</h1><p className="lead">{result.inferredScenario?.dynasty} · {result.inferredScenario?.location}</p><div className="detail-list">{(result.candidates ?? []).map((candidate: any, index: number) => <article className="browse-card" key={`${candidate.ancient_candidate}-${index}`}><span>{index === 0 ? '主候选' : `备选 ${index}`} · 相似度 {Math.round(candidate.score * 100)}%</span><h2>{candidate.ancient_candidate}</h2><p>{candidate.duty_difference}</p><h3>日常与生活</h3><ul>{candidate.daily_activities?.map((item: string) => <li key={item}>{item}</li>)}</ul><p>{candidate.clothing}</p><p>{candidate.life}</p><small>证据 {candidate.evidence_level} · {candidate.source_ids?.join('、')}</small></article>)}</div></main></PublicShell>;
}

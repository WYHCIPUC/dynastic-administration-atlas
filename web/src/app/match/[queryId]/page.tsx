import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { readQuery } from '@/lib/query-store';
import PublicShell from '@/components/PublicShell';

export const dynamic = 'force-dynamic';

type SharedResult = { input?: unknown; inferredScenario?: unknown; candidates?: unknown };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asCandidateArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null) : [];
}

async function loadResult(queryId: string): Promise<SharedResult | null> {
  try {
    const saved = await prisma.matchQuery.findUnique({ where: { id: queryId } });
    const record = saved ? asRecord(saved.result) : null;
    if (saved && record) return { input: saved.input, ...record };
  } catch {
    // 数据库不可用时继续尝试内存查询存储。
  }
  const memory = readQuery(queryId);
  const record = memory ? asRecord(memory.result) : null;
  if (memory && record) return { input: memory.input, ...record };
  return null;
}

export default async function SharedMatchPage({ params }: { params: Promise<{ queryId: string }> }) {
  const { queryId } = await params;
  const result = await loadResult(queryId);
  if (!result) return <PublicShell active="match"><main className="public-page"><Link className="back-link" href="/">← 返回首页</Link><div className="eyebrow">可分享的匹配结果</div><h1>结果暂不可用</h1><p className="lead">该结果可能已过期，或当前数据库尚未连接。可以返回首页重新匹配。</p><a className="primary-button back-link" href={`/api/matching/${queryId}`}>查看 API 状态</a></main></PublicShell>;
  const input = asRecord(result.input);
  const scenario = asRecord(result.inferredScenario);
  const candidates = asCandidateArray(result.candidates);
  return <PublicShell active="match"><main className="public-page"><Link className="back-link" href="/">← 返回首页</Link><div className="eyebrow">可分享的匹配结果 · {asString(input?.rawText)}</div><h1>历史官职候选</h1><p className="lead">{asString(scenario?.dynasty)} · {asString(scenario?.location)}</p><div className="detail-list">{candidates.map((candidate, index) => <article className="browse-card" key={`${asString(candidate.ancient_candidate)}-${index}`}><span>{index === 0 ? '主候选' : `备选 ${index}`} · 相似度 {Math.round(asNumber(candidate.score) * 100)}%</span><h2>{asString(candidate.ancient_candidate)}</h2><p>{asString(candidate.duty_difference)}</p><h3>日常与生活</h3><ul>{asStringArray(candidate.daily_activities).map((item) => <li key={item}>{item}</li>)}</ul><p>{asString(candidate.clothing)}</p><p>{asString(candidate.life)}</p><small>证据 {asString(candidate.evidence_level)} · {asStringArray(candidate.source_ids).join('、')}</small></article>)}</div></main></PublicShell>;
}

import Link from 'next/link';

import { loadPublishedMatrix } from '@/lib/published-content';
import { slugify } from '@/lib/slug';
import PublicShell from '@/components/PublicShell';

export const dynamic = 'force-dynamic';

export default async function PeriodsPage() {
  const rows = await loadPublishedMatrix();
  const periods = Array.from(new Map(rows.map((row) => [row.period, row])).values());
  return <PublicShell active="periods"><main className="public-page"><Link className="back-link" href="/">← 返回首页</Link><div className="eyebrow">制度浏览</div><h1>中国历代行政制度矩阵</h1><p className="lead">按时期查看中央、地方、财政、军务、法律、选官、礼制与社会生活材料。每条结论保留运行机制、改革风险和来源等级。</p><div className="browse-grid">{periods.map((row) => <a className="browse-card" href={`/periods/${slugify(row.period)}`} key={row.period}><span>{row.regime}</span><h2>{row.period}</h2><p>{row.legal_structure}</p><small>{row.evidence_grade} 级证据 · {rows.filter((item) => item.period === row.period).length} 个制度维度</small></a>)}</div></main></PublicShell>;
}

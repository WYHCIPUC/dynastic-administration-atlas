'use client';

import { useEffect, useMemo, useState } from 'react';

type Candidate = {
  ancient_candidate: string;
  score: number;
  confidence: string;
  duty_difference: string;
  daily_activities: string[];
  clothing: string;
  life: string;
  risks: string[];
  evidence_level: string;
  source_ids: string[];
};

type MatrixRow = Record<string, string>;
type SourceRow = Record<string, string>;

const examples = ['财政厅厅长', '县公安局长', '军分区主官', '医院负责人', '企业技术人员', '法院院长', '边疆事务负责人'];

export default function ResearchConsole() {
  const [query, setQuery] = useState('财政厅厅长');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [scenario, setScenario] = useState<{ dynasty: string; location: string; assumption: string } | null>(null);
  const [queryId, setQueryId] = useState('');
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [matrixQuery, setMatrixQuery] = useState('');
  const [sourceQuery, setSourceQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function runMatch(nextQuery = query) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/matching/preview', { method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({ rawText: nextQuery }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '匹配失败');
      setCandidates(data.candidates ?? []);
      setScenario(data.inferredScenario ?? null);
      setQueryId(data.queryId ?? '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '匹配失败');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void runMatch(); }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (matrixQuery) params.set('q', matrixQuery);
    fetch(`/api/periods?${params.toString()}`).then((response) => response.json()).then((data) => setMatrix(data.rows ?? [])).catch(() => setMatrix([]));
  }, [matrixQuery]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (sourceQuery) params.set('q', sourceQuery);
    fetch(`/api/sources?${params.toString()}`).then((response) => response.json()).then((data) => setSources(data.rows ?? [])).catch(() => setSources([]));
  }, [sourceQuery]);

  const visibleMatrix = useMemo(() => matrix.slice(0, 30), [matrix]);
  const visibleSources = useMemo(() => sources.slice(0, 12), [sources]);

  return (
    <>
      <section className="console">
        <div className="panel"><div className="panel-inner">
          <div className="eyebrow">现代职位 → 历史角色</div>
          <h2>把今天的工作，放回历史制度里</h2>
          <p>输入单位和职位，系统按职能、行政层级和证据完整度召回候选官职。结果是功能类比，不是现代职级与古代品秩的直接换算。</p>
          <form className="search-row" onSubmit={(event) => { event.preventDefault(); void runMatch(); }}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="现代单位和职位" placeholder="例如：某省财政厅厅长" />
            <button className="primary-button" type="submit">{busy ? '匹配中…' : '开始匹配'}</button>
          </form>
          <div className="examples">{examples.map((example) => <button className="chip" key={example} onClick={() => { setQuery(example); void runMatch(example); }}>{example}</button>)}</div>
          {error && <div className="error" role="alert">{error}</div>}
        </div></div>
        <aside className="panel"><div className="panel-inner">
          <div className="eyebrow">证据护栏</div>
          <h2>每一条生活细节都有来源层级</h2>
          <p>A 级是法令、实录、档案或简牍；B 级是传统正史与政书；C/D 级补充考古、博物馆和现代学术研究。证据不足时会标为“情景重建”。</p>
          <div className="stat-grid"><div className="stat"><strong>11</strong><span>历史时期</span></div><div className="stat"><strong>8</strong><span>制度维度</span></div><div className="stat"><strong>43</strong><span>登记来源</span></div><div className="stat"><strong>A–E</strong><span>证据等级</span></div></div>
        </div></aside>
      </section>

      <section className="section" aria-live="polite">
        <div className="section-heading"><div><h2>匹配结果</h2><p>{scenario ? `${scenario.dynasty} · ${scenario.location}` : '输入职位开始探索'}</p></div><div>{queryId && <a className="candidate-meta" href={`/match/${queryId}`}>分享结果 ↗</a>}{scenario && <span className="candidate-meta">{scenario.assumption}</span>}</div></div>
        {candidates.length ? <div className="result-grid">{candidates.map((candidate, index) => <article className={`candidate ${index === 0 ? 'primary' : ''}`} key={`${candidate.ancient_candidate}-${index}`}>
          <div className="candidate-label">{index === 0 ? '主候选' : `备选 ${index}`}</div>
          <h3>{candidate.ancient_candidate}</h3>
          <div className="candidate-meta">置信度：{candidate.confidence} · 证据：{candidate.evidence_level}</div>
          <div className="score"><span className="score-dot" />相似度 {Math.round(candidate.score * 100)}%</div>
          <p>{candidate.duty_difference}</p>
          <details className="detail-box"><summary>展开生活百科</summary><ul>{candidate.daily_activities.map((item) => <li key={item}>{item}</li>)}</ul><p><strong>服饰：</strong>{candidate.clothing}</p><p><strong>生活：</strong>{candidate.life}</p><ul>{candidate.risks.map((item) => <li key={item}>风险：{item}</li>)}</ul></details>
          <span className="evidence">来源 {candidate.source_ids.join(' · ')}</span>
        </article>)}</div> : <div className="panel empty">暂无匹配结果</div>}
      </section>

      <section className="section"><div className="section-heading"><div><h2>制度浏览</h2><p>按时期和制度维度检索研究矩阵</p></div><input className="chip" value={matrixQuery} onChange={(event) => setMatrixQuery(event.target.value)} placeholder="搜索朝代、税制、军制…" /></div><div className="panel panel-inner matrix-panel"><div className="matrix-list">{visibleMatrix.map((row, index) => <article className="matrix-card" key={`${row.period}-${row.dimension}-${index}`}><span className="dimension">{row.dimension} · {row.evidence_grade}</span><h3>{row.period}</h3><p><strong>制度：</strong>{row.legal_structure}</p><p><strong>运行：</strong>{row.actual_operation}</p><p><strong>改革：</strong>{row.reforms_risks}</p></article>)}</div>{!visibleMatrix.length && <div className="empty">没有符合条件的制度条目</div>}</div></section>

      <section className="section"><div className="section-heading"><div><h2>来源索引</h2><p>原典、档案、学术研究和博物馆资料</p></div><input className="chip" value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="搜索来源或机构…" /></div><div className="panel panel-inner"><div className="source-list">{visibleSources.map((source, index) => <div className="source-row" key={`${source.source_id}-${index}`}><div><strong>{source.title}</strong><div className="candidate-meta">{source.author_or_institution} · {source.coverage}</div>{source.url && <a href={source.url} target="_blank" rel="noreferrer">打开来源 ↗</a>}</div><span className={`source-level level-${source.authority_grade}`}>{source.authority_grade}</span></div>)}</div>{!visibleSources.length && <div className="empty">没有符合条件的来源</div>}</div></section>
    </>
  );
}

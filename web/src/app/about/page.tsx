import PublicShell from '@/components/PublicShell';

export default function AboutPage() {
  return <PublicShell active="about"><main className="public-page"><a className="back-link" href="/">← 返回首页</a><div className="eyebrow">研究方法</div><h1>证据、类比与不确定性</h1><div className="detail-list"><article className="browse-card"><h2>类比原则</h2><p>现代职位先拆成职能、层级、权限和工作地点，再召回历史机构。现代职级不会被机械换算成古代品级。</p></article><article className="browse-card"><h2>证据等级</h2><p>A 为法令、会典、实录、档案和简牍；B 为正史与政书；C 为同行评审论文和学术专著；D 为博物馆与公共机构整理；E 为待核验的普及材料。</p></article><article className="browse-card"><h2>生活百科的边界</h2><p>有起居记录时写具体时段；只有制度规定时写典型工作周期；只有学术复原时标情景重建；无可靠证据的细节不编造。</p></article></div></main></PublicShell>;
}

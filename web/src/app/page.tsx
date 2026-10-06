import ResearchConsole from '@/components/ResearchConsole';
import PublicShell from '@/components/PublicShell';

export default function HomePage() {
  return (
    <PublicShell active="match">
      <main>
        <section className="hero" id="match"><div><div className="eyebrow">A source-backed atlas of Chinese governance</div><h1>让一个现代职位，穿越回它可能的历史现场。</h1><p className="hero-copy">从郡县、三省六部到行省、督抚；从财政和军制到服饰、饮食与一天的工作节奏。输入你今天的单位和职位，沿着制度、证据和生活细节寻找可解释的历史角色。</p></div><p className="hero-note">网站首版以研究报告、制度矩阵、43条来源记录和8组职位映射案例为内容底座。所有候选均标注相似度、证据等级和不可比之处。</p></section>
        <div className="content"><ResearchConsole /></div>
      </main>
    </PublicShell>
  );
}

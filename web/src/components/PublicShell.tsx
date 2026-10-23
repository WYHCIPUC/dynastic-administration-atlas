import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/#match', key: 'match', label: '职位匹配' },
  { href: '/periods', key: 'periods', label: '制度浏览' },
  { href: '/sources', key: 'sources', label: '来源索引' },
  { href: '/about', key: 'about', label: '研究方法' },
  { href: '/admin', key: 'admin', label: '后台' },
];

export default function PublicShell({ active, children }: { active?: string; children: ReactNode }) {
  return (
    <div className="site-shell">
      <header className="topbar">
        <Link className="brand" href="/"><span className="brand-mark">史</span><span><span className="brand-title">历代行政</span><span className="brand-caption">制度 · 官职 · 生活百科</span></span></Link>
        <nav className="nav">
          {NAV.map((item) => <a key={item.key} href={item.href} aria-current={active === item.key ? 'page' : undefined}>{item.label}</a>)}
        </nav>
      </header>
      {children}
      <footer className="footer">历代行政 · 研究型大众历史产品原型。古代官职与现代职位只作功能类比；史料不足的生活细节会明确标注。</footer>
    </div>
  );
}

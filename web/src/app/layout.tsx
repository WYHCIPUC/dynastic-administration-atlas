import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '历代行政 · 中国制度与穿越百科',
  description: '基于原典、档案与学术研究的中国历代行政体系与现代职位映射。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

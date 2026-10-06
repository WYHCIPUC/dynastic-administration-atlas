import ResearchConsole from '@/components/ResearchConsole';
import PublicShell from '@/components/PublicShell';

export default function MatchPage() {
  return (
    <PublicShell active="match">
      <main className="content"><ResearchConsole /></main>
    </PublicShell>
  );
}

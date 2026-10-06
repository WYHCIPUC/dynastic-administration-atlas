import { loadMatrix, loadSources } from '@/lib/content';

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const rows = await loadMatrix();
  const decoded = decodeURIComponent(slug);
  const matched = rows.filter((row) => {
    const period = String(row.period ?? '');
    return period === decoded || period.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-') === decoded;
  });
  if (!matched.length) return Response.json({ error: '时期不存在' }, { status: 404 });
  const sourceRows = await loadSources();
  const ids = new Set(matched.flatMap((row) => String(row.source_ids ?? '').split(';').filter(Boolean)));
  return Response.json({ period: matched[0].period, rows: matched, sources: sourceRows.filter((source) => ids.has(source.source_id)) });
}

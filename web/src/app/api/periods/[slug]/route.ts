import { findPublishedPeriod, loadPublishedSources } from '@/lib/published-content';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const found = await findPublishedPeriod(decodeURIComponent(slug));
  if (!found) return Response.json({ error: '时期不存在' }, { status: 404 });
  const sourceRows = await loadPublishedSources();
  const ids = new Set(found.rows.flatMap((row) => String(row.source_ids ?? '').split(';').filter(Boolean)));
  return Response.json({ period: found.name, rows: found.rows, sources: sourceRows.filter((source) => ids.has(source.source_id)) });
}

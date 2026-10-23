import { NextResponse } from 'next/server';
import { loadPublishedSources } from '@/lib/published-content';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim().toLowerCase();
  const level = searchParams.get('level') ?? '';
  const rows = await loadPublishedSources();
  const filtered = rows.filter((row) => {
    const haystack = Object.values(row).join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (!level || row.authority_grade === level);
  });
  return NextResponse.json({ rows: filtered, total: filtered.length });
}

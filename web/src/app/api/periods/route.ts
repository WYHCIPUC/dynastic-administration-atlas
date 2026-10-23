import { NextResponse } from 'next/server';
import { loadPublishedMatrix } from '@/lib/published-content';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim().toLowerCase();
  const dimension = searchParams.get('dimension') ?? '';
  const rows = await loadPublishedMatrix();
  const filtered = rows.filter((row) => {
    const haystack = Object.values(row).join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (!dimension || row.dimension === dimension);
  });
  return NextResponse.json({ rows: filtered, total: filtered.length });
}

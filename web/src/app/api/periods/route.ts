import { NextResponse } from 'next/server';
import { loadMatrix } from '@/lib/content';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim().toLowerCase();
  const dimension = searchParams.get('dimension') ?? '';
  const rows = await loadMatrix();
  const filtered = rows.filter((row) => {
    const haystack = Object.values(row).join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (!dimension || row.dimension === dimension);
  });
  return NextResponse.json({ rows: filtered, total: filtered.length });
}

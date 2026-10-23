import { findPublishedOfficeBySlug } from '@/lib/published-content';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const found = await findPublishedOfficeBySlug(decodeURIComponent(slug));
  if (!found) return Response.json({ error: '官职不存在' }, { status: 404 });
  return Response.json(found);
}

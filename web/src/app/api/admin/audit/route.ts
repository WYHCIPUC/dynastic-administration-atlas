import { requireAdmin } from '@/lib/admin-auth';
import { parsePagination } from '@/lib/admin-list';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const auth = await requireAdmin(request); if ('error' in auth) return auth.error;
  const { limit, offset } = parsePagination(request);
  const [items, total] = await Promise.all([
    prisma.adminAuditLog.findMany({ orderBy: [{ createdAt: 'desc' }], take: limit, skip: offset }),
    prisma.adminAuditLog.count(),
  ]);
  return Response.json({ items, total });
}

import { requireAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request); if ('error' in auth) return auth.error;
  const { id } = await context.params; const body = await request.json().catch(() => ({}));
  const before = await prisma.period.findUnique({ where: { id } }); if (!before) return Response.json({ error: '内容不存在' }, { status: 404 });
  const updated = await prisma.period.update({ where: { id }, data: { ...('name' in body ? { name: body.name } : {}), ...('summary' in body ? { summary: body.summary } : {}), ...('regimeGroup' in body ? { regimeGroup: body.regimeGroup } : {}), ...('startYear' in body ? { startYear: body.startYear } : {}), ...('endYear' in body ? { endYear: body.endYear } : {}) } });
  await prisma.adminAuditLog.create({ data: { adminId: auth.session.email ?? '', entityType: 'period', entityId: id, action: 'update', beforeSnapshot: JSON.parse(JSON.stringify(before)), afterSnapshot: JSON.parse(JSON.stringify(updated)), reason: body.reason } });
  return Response.json(updated);
}

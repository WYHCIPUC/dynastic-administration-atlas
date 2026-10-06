import { ContentStatus } from '@prisma/client';
import { requireAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const auth = await requireAdmin(request); if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  if (!body.slug || !body.name) return Response.json({ error: 'slug 和 name 必填' }, { status: 400 });
  const status = Object.values(ContentStatus).includes(body.status) ? body.status : ContentStatus.DRAFT;
  const created = await prisma.period.create({ data: { slug: body.slug, name: body.name, startYear: body.startYear ?? null, endYear: body.endYear ?? null, regimeGroup: body.regimeGroup ?? body.name, summary: body.summary ?? '', status } });
  await prisma.adminAuditLog.create({ data: { adminId: auth.session.email ?? '', entityType: 'period', entityId: created.id, action: 'create', afterSnapshot: JSON.parse(JSON.stringify(created)), reason: body.reason } });
  return Response.json(created, { status: 201 });
}

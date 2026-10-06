import { ContentStatus } from '@prisma/client';
import { requireAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const auth = await requireAdmin(request); if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  if (!body.slug || !body.name || !body.periodId) return Response.json({ error: 'slug、name 和 periodId 必填' }, { status: 400 });
  const status = Object.values(ContentStatus).includes(body.status) ? body.status : ContentStatus.DRAFT;
  const created = await prisma.office.create({ data: { slug: body.slug, name: body.name, aliases: body.aliases ?? [], institutionLevel: body.institutionLevel ?? '中央', functionDomains: body.functionDomains ?? [], legalDuties: body.legalDuties ?? [], authorityBoundaries: body.authorityBoundaries ?? [], actualOperation: body.actualOperation ?? [], appointmentAndCareer: body.appointmentAndCareer ?? [], rankOrGrade: body.rankOrGrade ?? null, rankComparability: body.rankComparability ?? '不可直接换算', periodId: body.periodId, status } });
  await prisma.adminAuditLog.create({ data: { adminId: auth.session.email ?? '', entityType: 'office', entityId: created.id, action: 'create', afterSnapshot: JSON.parse(JSON.stringify(created)), reason: body.reason } });
  return Response.json(created, { status: 201 });
}

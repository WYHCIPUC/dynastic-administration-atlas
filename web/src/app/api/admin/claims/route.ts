import { EvidenceLevel } from '@prisma/client';
import { requireAdmin } from '@/lib/admin-auth';
import { parsePagination } from '@/lib/admin-list';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const auth = await requireAdmin(request); if ('error' in auth) return auth.error;
  const { limit, offset } = parsePagination(request);
  const [items, total] = await Promise.all([
    prisma.evidenceClaim.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip: offset,
      include: { source: { select: { id: true, title: true } }, period: { select: { id: true, name: true } }, office: { select: { id: true, name: true } } },
    }),
    prisma.evidenceClaim.count(),
  ]);
  return Response.json({ items, total });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request); if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  if (!body.entityType || !body.claimText || !body.sourceId) return Response.json({ error: 'entityType、claimText 和 sourceId 必填' }, { status: 400 });
  const level = Object.values(EvidenceLevel).includes(body.evidenceLevel) ? body.evidenceLevel : EvidenceLevel.E;
  const created = await prisma.evidenceClaim.create({ data: { entityType: body.entityType, claimText: body.claimText, sourceId: body.sourceId, citationLocator: body.citationLocator ?? null, evidenceLevel: level, uncertaintyType: body.uncertaintyType ?? '学术解释', periodId: body.periodId ?? null, officeId: body.officeId ?? null } });
  await prisma.adminAuditLog.create({ data: { adminId: auth.session.email ?? '', entityType: 'claim', entityId: created.id, action: 'create', afterSnapshot: JSON.parse(JSON.stringify(created)), reason: body.reason } });
  return Response.json(created, { status: 201 });
}

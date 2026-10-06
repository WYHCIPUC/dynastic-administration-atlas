import { EvidenceLevel } from '@prisma/client';
import { requireAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const auth = await requireAdmin(request); if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  if (!body.id || !body.title) return Response.json({ error: 'id 和 title 必填' }, { status: 400 });
  const grade = Object.values(EvidenceLevel).includes(body.authorityGrade) ? body.authorityGrade : EvidenceLevel.E;
  const created = await prisma.source.create({ data: { id: body.id, title: body.title, authorOrInstitution: body.authorOrInstitution ?? null, year: body.year ?? null, sourceType: body.sourceType ?? '学术专著', authorityGrade: grade, locator: body.locator ?? null, url: body.url ?? null, coverage: body.coverage ?? null, notes: body.notes ?? null } });
  await prisma.adminAuditLog.create({ data: { adminId: auth.session.email ?? '', entityType: 'source', entityId: created.id, action: 'create', afterSnapshot: JSON.parse(JSON.stringify(created)), reason: body.reason } });
  return Response.json(created, { status: 201 });
}

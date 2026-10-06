import { ContentStatus } from '@prisma/client';
import { requireAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

const actions: Record<string, ContentStatus> = {
  'submit-review': ContentStatus.REVIEW,
  publish: ContentStatus.PUBLISHED,
  archive: ContentStatus.ARCHIVED,
};

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;
  const { id, action } = await context.params;
  const body = await request.json().catch(() => ({})) as { entityType?: string; reason?: string };
  const entityType = body.entityType;
  if (!entityType) return Response.json({ error: '缺少 entityType' }, { status: 400 });
  if (action === 'rollback') {
    const previous = await prisma.adminAuditLog.findFirst({ where: { entityId: id, entityType }, orderBy: { createdAt: 'desc' } });
    const snapshot = previous?.beforeSnapshot as { status?: ContentStatus } | null;
    if (!snapshot?.status) return Response.json({ error: '没有可回滚版本' }, { status: 404 });
    return updateStatus(id, entityType, snapshot.status, auth.session.email ?? '', body.reason ?? '回滚上一版本');
  }
  const status = actions[action];
  if (!status) return Response.json({ error: '未知内容操作' }, { status: 400 });
  return updateStatus(id, entityType, status, auth.session.email ?? '', body.reason);
}

async function updateStatus(id: string, entityType: string, status: ContentStatus, adminId: string, reason?: string) {
  const delegates: Record<string, any> = { period: prisma.period, office: prisma.office, lifestyle: prisma.lifestyleProfile, source: prisma.source, claim: prisma.evidenceClaim, mappingRule: prisma.mappingRule };
  const model = delegates[entityType];
  if (!model) return Response.json({ error: '不支持的内容类型' }, { status: 400 });
  const before = await model.findUnique({ where: { id } });
  if (!before) return Response.json({ error: '内容不存在' }, { status: 404 });
  const after = await model.update({ where: { id }, data: { status } });
  const beforeSnapshot = JSON.parse(JSON.stringify(before));
  const afterSnapshot = JSON.parse(JSON.stringify(after));
  await prisma.adminAuditLog.create({ data: { adminId, entityType, entityId: id, action: status, beforeSnapshot, afterSnapshot, reason } });
  return Response.json({ ok: true, status });
}

import { ContentStatus, Prisma, type PrismaClient } from '@prisma/client';
import { requireAdmin } from '@/lib/admin-auth';
import { asContentStatus, assertTransitionLegal, IllegalTransitionError, type ContentAction } from '@/lib/content-status';
import { prisma } from '@/lib/prisma';

const actions: Record<string, ContentStatus> = {
  'submit-review': ContentStatus.REVIEW,
  publish: ContentStatus.PUBLISHED,
  archive: ContentStatus.ARCHIVED,
};

type Snapshot = Record<string, unknown>;
type Client = PrismaClient | Prisma.TransactionClient;

interface EntityHandler {
  findById(id: string): Promise<Snapshot | null>;
  updateById(id: string, data: Snapshot): Promise<unknown>;
}

function entityHandlers(client: Client): Record<string, EntityHandler> {
  return {
    period: {
      findById: async (id) => client.period.findUnique({ where: { id } }),
      updateById: (id, data) => client.period.update({ where: { id }, data: data as Prisma.PeriodUpdateInput }),
    },
    office: {
      findById: async (id) => client.office.findUnique({ where: { id } }),
      updateById: (id, data) => client.office.update({ where: { id }, data: data as Prisma.OfficeUpdateInput }),
    },
    lifestyle: {
      findById: async (id) => client.lifestyleProfile.findUnique({ where: { id } }),
      updateById: (id, data) => client.lifestyleProfile.update({ where: { id }, data: data as Prisma.LifestyleProfileUpdateInput }),
    },
    source: {
      findById: async (id) => client.source.findUnique({ where: { id } }),
      updateById: (id, data) => client.source.update({ where: { id }, data: data as Prisma.SourceUpdateInput }),
    },
    claim: {
      findById: async (id) => client.evidenceClaim.findUnique({ where: { id } }),
      updateById: (id, data) => client.evidenceClaim.update({ where: { id }, data: data as Prisma.EvidenceClaimUpdateInput }),
    },
    mappingRule: {
      findById: async (id) => client.mappingRule.findUnique({ where: { id } }),
      updateById: (id, data) => client.mappingRule.update({ where: { id }, data: data as Prisma.MappingRuleUpdateInput }),
    },
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;
  const { id, action } = await context.params;
  const body = await request.json().catch(() => ({})) as { entityType?: string; reason?: string };
  const entityType = body.entityType;
  if (!entityType) return Response.json({ error: '缺少 entityType' }, { status: 400 });
  const handler = entityHandlers(prisma)[entityType];
  if (!handler) return Response.json({ error: '不支持的内容类型' }, { status: 400 });
  const adminId = auth.session.email ?? '';
  if (action === 'rollback') return rollback(handler, id, entityType, adminId, body.reason);
  const status = actions[action];
  if (!status) return Response.json({ error: '未知内容操作' }, { status: 400 });
  const before = await handler.findById(id);
  if (!before) return Response.json({ error: '内容不存在' }, { status: 404 });
  const currentStatus = asContentStatus(before.status);
  if (!currentStatus) return Response.json({ error: '内容当前状态数据异常' }, { status: 500 });
  try {
    assertTransitionLegal(currentStatus, action as ContentAction);
  } catch (error) {
    if (error instanceof IllegalTransitionError) return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
  await prisma.$transaction(async (tx) => {
    const txHandler = entityHandlers(tx)[entityType];
    const updated = await txHandler.updateById(id, { status });
    await tx.adminAuditLog.create({
      data: {
        adminId,
        entityType,
        entityId: id,
        action: status,
        beforeSnapshot: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue,
        afterSnapshot: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue,
        reason: body.reason,
      },
    });
  });
  return Response.json({ ok: true, status });
}

async function rollback(handler: EntityHandler, id: string, entityType: string, adminId: string, reason?: string) {
  const previous = await prisma.adminAuditLog.findFirst({
    where: { entityId: id, entityType, NOT: { action: 'rollback' } },
    orderBy: { createdAt: 'desc' },
  });
  const snapshot = previous?.beforeSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return Response.json({ error: '没有可回滚版本' }, { status: 404 });
  }
  const record = snapshot as Snapshot;
  const data: Snapshot = { ...record };
  delete data.id;
  const restored = await prisma.$transaction(async (tx) => {
    const txHandler = entityHandlers(tx)[entityType];
    const current = await txHandler.findById(id);
    if (!current) return null;
    const updated = await txHandler.updateById(id, data);
    await tx.adminAuditLog.create({
      data: {
        adminId,
        entityType,
        entityId: id,
        action: 'rollback',
        beforeSnapshot: JSON.parse(JSON.stringify(current)) as Prisma.InputJsonValue,
        afterSnapshot: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue,
        reason: reason ?? '回滚上一版本',
      },
    });
    return updated;
  });
  if (!restored) return Response.json({ error: '内容不存在' }, { status: 404 });
  return Response.json({ ok: true, status: asContentStatus(record.status) });
}

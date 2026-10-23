import { ContentStatus } from '@prisma/client';
import { requireAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

type StatusCounts = Record<ContentStatus, number> & { total: number };

function summarize(rows: Array<{ status: ContentStatus; _count: { _all: number } }>): StatusCounts {
  const counts: StatusCounts = { total: 0, DRAFT: 0, REVIEW: 0, PUBLISHED: 0, ARCHIVED: 0 };
  for (const row of rows) {
    counts[row.status] += row._count._all;
    counts.total += row._count._all;
  }
  return counts;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request); if ('error' in auth) return auth.error;
  const [period, office, lifestyle, source, claim, audit] = await Promise.all([
    prisma.period.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.office.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.lifestyleProfile.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.source.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.evidenceClaim.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.adminAuditLog.count(),
  ]);
  return Response.json({
    period: summarize(period),
    office: summarize(office),
    lifestyle: summarize(lifestyle),
    source: summarize(source),
    claim: summarize(claim),
    audit: { total: audit },
  });
}

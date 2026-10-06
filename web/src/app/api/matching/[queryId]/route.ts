import { prisma } from '@/lib/prisma';
import { readQuery } from '@/lib/query-store';

export async function GET(_request: Request, context: { params: Promise<{ queryId: string }> }) {
  const { queryId } = await context.params;
  try {
    const query = await prisma.matchQuery.findUnique({ where: { id: queryId } });
    if (query) return Response.json({ queryId: query.id, input: query.input, ...(query.result as object) });
    const memory = readQuery(queryId);
    if (memory) return Response.json({ queryId, input: memory.input, ...(memory.result as object) });
    return Response.json({ error: '匹配结果不存在或已过期' }, { status: 404 });
  } catch {
    const memory = readQuery(queryId);
    if (memory) return Response.json({ queryId, input: memory.input, ...(memory.result as object) });
    return Response.json({ error: '结果存储暂不可用' }, { status: 503 });
  }
}

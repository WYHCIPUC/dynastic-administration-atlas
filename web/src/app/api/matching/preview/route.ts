import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { matchRole } from '@/lib/matcher';
import { prisma } from '@/lib/prisma';
import { rememberQuery } from '@/lib/query-store';
import { allowRequest } from '@/lib/rate-limit';

const requestSchema = z.object({
  rawText: z.string().min(2).max(200),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (!allowRequest(`matching:${ip}`)) return NextResponse.json({ error: '请求过于频繁，请稍后再试。' }, { status: 429 });
    const payload = requestSchema.parse(await request.json());
    const result = await matchRole(payload.rawText, 3);
    const fallbackId = randomUUID();
    let queryId: string = fallbackId;
    try {
      const saved = await prisma.matchQuery.create({ data: { rawText: payload.rawText, input: payload, result } });
      queryId = saved.id;
    } catch {
      // Public matching remains usable when the optional persistence database is unavailable.
    }
    rememberQuery(queryId, payload, result);
    return NextResponse.json({ queryId, input: payload, ...result });
  } catch (error) {
    const message = error instanceof z.ZodError ? '请输入至少两个字的单位或职位。' : '匹配服务暂时不可用。';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

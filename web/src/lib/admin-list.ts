export function parsePagination(request: Request, defaultLimit = 50, maxLimit = 200) {
  const url = new URL(request.url);
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  const rawOffset = Number.parseInt(url.searchParams.get('offset') ?? '', 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;
  return { limit, offset };
}

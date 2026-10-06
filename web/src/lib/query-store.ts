type StoredQuery = { input: unknown; result: unknown; createdAt: number };
const store = new Map<string, StoredQuery>();
export function rememberQuery(id: string, input: unknown, result: unknown) { store.set(id, { input, result, createdAt: Date.now() }); }
export function readQuery(id: string) {
  const value = store.get(id);
  if (!value) return null;
  if (Date.now() - value.createdAt > 24 * 60 * 60 * 1000) { store.delete(id); return null; }
  return value;
}

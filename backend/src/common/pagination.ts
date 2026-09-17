/** Clamp list query size so unbounded findMany cannot load entire tables. */
export function listTake(limit?: number, fallback = 100, max = 200): number {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

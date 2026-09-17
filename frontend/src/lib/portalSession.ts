/**
 * Soft browser refresh: restore last page + cached GETs.
 * 3+ reloads in a short window: wipe caches and force a full reload of data.
 */

const REFRESH_COUNT_KEY = 'school:refreshCount';
const REFRESH_AT_KEY = 'school:refreshAt';
const REFRESH_WINDOW_MS = 45_000;
const FULL_REFRESH_AFTER = 3;
const API_CACHE_KEY = 'school:apiCache';
const LAST_PAGE_PREFIX = 'school:lastPage:';

export type PortalKind = 'admin' | 'staff' | 'student';

let skipCacheHydrate = false;
let bootstrapped = false;

function navigationType(): string {
  const entries = performance.getEntriesByType?.(
    'navigation',
  ) as PerformanceNavigationTiming[] | undefined;
  const nav = entries?.[0];
  if (nav?.type) return nav.type;
  // Legacy fallback
  const legacy = (
    performance as Performance & { navigation?: { type?: number } }
  ).navigation;
  if (legacy?.type === 1) return 'reload';
  return 'navigate';
}

/** Call once at app start (before portals mount). */
export function bootstrapPortalSession() {
  if (bootstrapped || typeof window === 'undefined') return;
  bootstrapped = true;

  const isReload = navigationType() === 'reload';
  const now = Date.now();
  const lastAt = Number(sessionStorage.getItem(REFRESH_AT_KEY) || '0');
  let count = Number(sessionStorage.getItem(REFRESH_COUNT_KEY) || '0');

  if (isReload) {
    if (now - lastAt > REFRESH_WINDOW_MS) count = 0;
    count += 1;
    sessionStorage.setItem(REFRESH_COUNT_KEY, String(count));
    sessionStorage.setItem(REFRESH_AT_KEY, String(now));
    skipCacheHydrate = count >= FULL_REFRESH_AFTER;
    if (skipCacheHydrate) {
      sessionStorage.setItem(REFRESH_COUNT_KEY, '0');
      sessionStorage.removeItem(API_CACHE_KEY);
    }
  } else {
    sessionStorage.setItem(REFRESH_COUNT_KEY, '0');
    skipCacheHydrate = false;
  }
}

/** True only for this boot after 3+ rapid reloads — do not restore GET cache. */
export function isForceFullRefresh() {
  return skipCacheHydrate;
}

export function readLastPage<T extends string>(
  portal: PortalKind,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const raw = sessionStorage.getItem(`${LAST_PAGE_PREFIX}${portal}`);
    if (raw && (allowed as readonly string[]).includes(raw)) {
      return raw as T;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeLastPage(portal: PortalKind, page: string) {
  try {
    sessionStorage.setItem(`${LAST_PAGE_PREFIX}${portal}`, page);
  } catch {
    /* ignore */
  }
}

export function readPersistedApiCache(): [string, unknown][] | null {
  if (skipCacheHydrate) return null;
  try {
    const raw = sessionStorage.getItem(API_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as [string, unknown][];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writePersistedApiCache(entries: [string, unknown][]) {
  try {
    sessionStorage.setItem(API_CACHE_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode */
  }
}

export function clearPersistedApiCache() {
  try {
    sessionStorage.removeItem(API_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

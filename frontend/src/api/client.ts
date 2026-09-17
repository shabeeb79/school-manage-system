import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import {
  bootstrapPortalSession,
  clearPersistedApiCache,
  readPersistedApiCache,
  writePersistedApiCache,
} from '../lib/portalSession';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipCache?: boolean;
  }
}

bootstrapPortalSession();

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

type CacheEntry = {
  data: unknown;
  status: number;
  statusText: string;
  headers: unknown;
};

const getCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<AxiosResponse>>();

const hydrated = readPersistedApiCache();
if (hydrated) {
  for (const [key, value] of hydrated) {
    if (value && typeof value === 'object' && 'data' in (value as object)) {
      getCache.set(key, value as CacheEntry);
    }
  }
}

type CacheableConfig = AxiosRequestConfig & {
  /** Force a network request and refresh the cache entry. */
  skipCache?: boolean;
};

function cacheKey(url: string, params?: unknown) {
  return `${url}::${JSON.stringify(params ?? null)}`;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersistCache() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    writePersistedApiCache([...getCache.entries()]);
  }, 250);
}

/** Paths that must always hit the network (badges / live messaging). */
function shouldBypassCache(url: string, config?: CacheableConfig) {
  if (config?.skipCache) return true;
  const path = url.split('?')[0];
  if (path.includes('unread-count')) return true;
  if (
    /\/messages\/(conversations|with|inbox|sent|contacts)(\/|$)/.test(path)
  ) {
    return true;
  }
  return false;
}

export function clearApiCache() {
  getCache.clear();
  inflight.clear();
  clearPersistedApiCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('school:api-cache-cleared'));
  }
}

export function subscribeApiCacheCleared(handler: () => void) {
  window.addEventListener('school:api-cache-cleared', handler);
  return () => window.removeEventListener('school:api-cache-cleared', handler);
}

/** Drop cached GETs that match a URL prefix (e.g. `/posts`). */
export function invalidateApiCache(urlPrefix?: string) {
  if (!urlPrefix) {
    clearApiCache();
    return;
  }
  for (const key of getCache.keys()) {
    if (key.startsWith(`${urlPrefix}::`) || key.startsWith(urlPrefix)) {
      getCache.delete(key);
    }
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(`${urlPrefix}::`) || key.startsWith(urlPrefix)) {
      inflight.delete(key);
    }
  }
  schedulePersistCache();
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function mutationClearsCache(url = '', method = 'get') {
  const m = method.toLowerCase();
  if (m === 'get' || m === 'head') return false;
  const path = url.split('?')[0];
  // Read-receipt style updates should not wipe list caches / remount pages.
  if (/\/feed\/read$/.test(path)) return false;
  if (/\/read-all$/.test(path)) return false;
  if (/\/[^/]+\/read$/.test(path)) return false;
  return true;
}

api.interceptors.response.use(
  (res) => {
    const method = (res.config.method || 'get').toLowerCase();
    const url = `${res.config.baseURL || ''}${res.config.url || ''}`;
    if (mutationClearsCache(url, method)) {
      clearApiCache();
    }
    return res;
  },
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = Boolean(localStorage.getItem('token'));
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      clearApiCache();
      if (hadToken) {
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        } else {
          window.location.reload();
        }
      }
    }
    return Promise.reject(error);
  },
);

const originalGet = api.get.bind(api);

api.get = ((url: string, config?: CacheableConfig) => {
  if (shouldBypassCache(url, config)) {
    return originalGet(url, config);
  }

  const key = cacheKey(url, config?.params);
  const hit = getCache.get(key);
  if (hit) {
    return Promise.resolve({
      data: hit.data,
      status: hit.status,
      statusText: hit.statusText,
      headers: hit.headers,
      config: config ?? {},
    }) as ReturnType<typeof originalGet>;
  }

  const pending = inflight.get(key);
  if (pending) {
    return pending as ReturnType<typeof originalGet>;
  }

  const request = originalGet(url, config)
    .then((res) => {
      getCache.set(key, {
        data: res.data,
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
      schedulePersistCache();
      return res;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}) as typeof api.get;

export default api;

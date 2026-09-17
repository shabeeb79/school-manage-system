import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

const GET_CACHE_TTL_MS = 30_000;
type CacheEntry = { expiry: number; data: unknown; status: number; statusText: string; headers: unknown };
const getCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function cacheKey(url: string, params?: unknown) {
  return `${url}::${JSON.stringify(params ?? null)}`;
}

export function clearApiCache() {
  getCache.clear();
  inflight.clear();
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    // Mutations invalidate short-lived GET cache so lists stay fresh.
    const method = (res.config.method || 'get').toLowerCase();
    if (method !== 'get' && method !== 'head') {
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
      // Only bounce after an expired/invalid session — not on a failed login attempt.
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

api.get = ((url: string, config?: Parameters<typeof originalGet>[1]) => {
  const skipCache = Boolean(
    (config as { skipCache?: boolean } | undefined)?.skipCache,
  );
  if (skipCache) {
    return originalGet(url, config);
  }

  const key = cacheKey(url, config?.params);
  const hit = getCache.get(key);
  if (hit && hit.expiry > Date.now()) {
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
        expiry: Date.now() + GET_CACHE_TTL_MS,
        data: res.data,
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
      return res;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}) as typeof api.get;

export default api;

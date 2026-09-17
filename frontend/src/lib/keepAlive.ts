import { useEffect, useState } from 'react';
import { subscribeApiCacheCleared } from '../api/client';

/**
 * Keeps visited pages mounted (hidden when inactive) so clicks don't reload.
 * After any API mutation clears the cache, visited pages reset and remount fresh.
 */
export function useKeepAlivePages<T extends string>(active: T, initial: T) {
  const [visited, setVisited] = useState(() => new Set<T>([initial]));
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    setVisited((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
  }, [active]);

  useEffect(
    () =>
      subscribeApiCacheCleared(() => {
        setEpoch((n) => n + 1);
        setVisited(new Set([active]));
      }),
    [active],
  );

  return { visited, epoch };
}

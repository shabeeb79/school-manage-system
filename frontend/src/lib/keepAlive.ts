import { useEffect, useState } from 'react';
import { subscribeApiCacheCleared } from '../api/client';

/**
 * Keeps visited pages mounted so navigating away/back does not reload.
 * On browser refresh only the last-viewed page starts mounted (see portalSession).
 * After a create/update/delete (API cache clear), inactive pages remount the
 * next time you open them. The active page should call load() itself.
 */
export function useKeepAlivePages<T extends string>(active: T, initial: T) {
  const [visited, setVisited] = useState(() => new Set<T>([initial]));
  const [epoch, setEpoch] = useState(0);
  const [dirty, setDirty] = useState(() => new Set<T>());

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
        setDirty((prev) => {
          const next = new Set(prev);
          for (const id of visited) {
            if (id !== active) next.add(id);
          }
          return next;
        });
      }),
    [active, visited],
  );

  useEffect(() => {
    if (!dirty.has(active)) return;
    setEpoch((n) => n + 1);
    setDirty((prev) => {
      const next = new Set(prev);
      next.delete(active);
      return next;
    });
  }, [active, dirty]);

  return { visited, epoch };
}

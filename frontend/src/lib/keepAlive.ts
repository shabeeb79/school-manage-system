import { useEffect, useMemo, useState } from 'react';
import { subscribeApiCacheCleared } from '../api/client';

type Options<T extends string> = {
  /** Pages that stay mounted when you navigate away. Default: only the initial page. */
  keep?: readonly T[];
};

/**
 * Keep-alive for portal pages.
 * By default only the dashboard stays mounted; every other page remounts fresh
 * (fast + always up to date after creates elsewhere).
 */
export function useKeepAlivePages<T extends string>(
  active: T,
  initial: T,
  options?: Options<T>,
) {
  const keepKey = (options?.keep ?? [initial]).join('|');
  const keepSet = useMemo(
    () => new Set((keepKey ? keepKey.split('|') : [initial]) as T[]),
    [keepKey, initial],
  );

  const [visited, setVisited] = useState(() => new Set<T>([initial]));
  const [epoch, setEpoch] = useState(0);
  const [dirty, setDirty] = useState(() => new Set<T>());

  useEffect(() => {
    if (!keepSet.has(active)) return;
    setVisited((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
  }, [active, keepSet]);

  useEffect(
    () =>
      subscribeApiCacheCleared(() => {
        setDirty((prev) => {
          const next = new Set(prev);
          for (const id of visited) {
            if (id !== active && keepSet.has(id)) next.add(id);
          }
          return next;
        });
      }),
    [active, visited, keepSet],
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

  const pagesToRender = useMemo(() => {
    const kept = Array.from(visited).filter((id) => keepSet.has(id));
    if (!keepSet.has(active) && !kept.includes(active)) {
      return [...kept, active];
    }
    // Drop non-keep pages when inactive so they remount next visit.
    return kept.includes(active) ? kept : [...kept, active];
  }, [visited, active, keepSet]);

  return { visited: new Set(pagesToRender), epoch };
}

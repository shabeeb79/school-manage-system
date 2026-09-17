import { Injectable } from '@nestjs/common';

type CacheEntry<T> = { value: T; expiresAt: number };

/**
 * Short-lived in-memory cache for JWT-validated users.
 * Avoids a deep DB round-trip on every authenticated request.
 */
@Injectable()
export class AuthUserCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs = Number(process.env.AUTH_USER_CACHE_TTL_MS) || 45_000;

  get<T>(userId: string): T | null {
    const hit = this.store.get(userId);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(userId);
      return null;
    }
    return hit.value as T;
  }

  set(userId: string, value: unknown) {
    this.store.set(userId, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidate(userId: string) {
    this.store.delete(userId);
  }

  clear() {
    this.store.clear();
  }
}

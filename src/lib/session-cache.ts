/**
 * In-process LRU cache for JWT session version checks.
 *
 * Instead of querying the database on every authenticated request to verify
 * `sessionVersion`, we cache the result for a short window. This reduces
 * database load from O(requests) to O(requests / TTL) while still invalidating
 * sessions within seconds of a password reset.
 *
 * Cache is process-local and resets on cold start — both are acceptable
 * because JWTs are re-validated on the next request after restart.
 */

interface CacheEntry {
  sessionVersion: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 10_000;
const TTL_MS = 30_000; // 30 seconds

export function getCachedSessionVersion(userId: string): number | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(userId);
    return null;
  }
  return entry.sessionVersion;
}

export function setCachedSessionVersion(userId: string, sessionVersion: number): void {
  // Evict oldest entries when the cache is full.
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(userId, { sessionVersion, expiresAt: Date.now() + TTL_MS });
}

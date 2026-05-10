/**
 * In-memory sliding-window rate limiter.
 *
 * ⚠️ IMPORTANT: This implementation stores request timestamps in a plain Map,
 * which means the rate-limit state is **reset on server restart** and is **not
 * shared across multiple instances**. For production multi-instance deployments,
 * replace this with a Redis-based solution (e.g. Upstash Ratelimit, Redis + Lua
 * script) so that the limit is enforced cluster-wide and survives restarts.
 */

interface RateLimitOptions {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  retryAfter?: number;
}

// Map<key, timestamps[]>
const store = new Map<string, number[]>();

// Periodic cleanup: evict entries older than the longest configured window
// to prevent unbounded memory growth.
const CLEANUP_INTERVAL_MS = 60_000; // 1 minute

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of store.entries()) {
    const filtered = timestamps.filter((ts) => now - ts < 900_000); // 15 min max window
    if (filtered.length === 0) {
      store.delete(key);
    } else {
      store.set(key, filtered);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Check whether a given key (IP, email, etc.) is within rate limits,
 * AND record this request if allowed.
 *
 * @param key   - Identifier for the client (IP address, email, etc.)
 * @param opts  - Rate limit configuration
 * @returns     - `{ success: true }` if allowed, `{ success: false, retryAfter }` if blocked
 */
export function rateLimit(
  key: string,
  opts: RateLimitOptions = { maxRequests: 5, windowSeconds: 900 }
): RateLimitResult {
  const now = Date.now();
  const windowMs = opts.windowSeconds * 1000;

  const timestamps = store.get(key) ?? [];
  // Keep only timestamps within the sliding window
  const withinWindow = timestamps.filter((ts) => now - ts < windowMs);

  if (withinWindow.length >= opts.maxRequests) {
    // The oldest timestamp in the window determines when the window resets
    const oldestInWindow = withinWindow[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    return {
      success: false,
      retryAfter: Math.ceil(retryAfterMs / 1000),
    };
  }

  // Record this request
  withinWindow.push(now);
  store.set(key, withinWindow);

  return { success: true };
}

/**
 * Check whether a given key has exceeded rate limits WITHOUT recording
 * a new request. Useful for checking if an email is locked out before
 * attempting authentication.
 */
export function checkRateLimit(
  key: string,
  opts: RateLimitOptions = { maxRequests: 5, windowSeconds: 900 }
): RateLimitResult {
  const now = Date.now();
  const windowMs = opts.windowSeconds * 1000;

  const timestamps = store.get(key) ?? [];
  const withinWindow = timestamps.filter((ts) => now - ts < windowMs);

  if (withinWindow.length >= opts.maxRequests) {
    const oldestInWindow = withinWindow[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    return {
      success: false,
      retryAfter: Math.ceil(retryAfterMs / 1000),
    };
  }

  return { success: true };
}

/**
 * Record a single request for the given key WITHOUT checking the limit.
 * Used to record failed login attempts after the fact.
 */
export function recordRateLimitAttempt(key: string): void {
  const now = Date.now();
  const timestamps = store.get(key) ?? [];
  timestamps.push(now);
  store.set(key, timestamps);
}

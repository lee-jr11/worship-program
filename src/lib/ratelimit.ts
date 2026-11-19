/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * This is a best-effort guard against casual abuse of an endpoint that spends
 * AI credits and sends mail. On serverless hosting each instance keeps its own
 * counters, so it is not a hard global limit — pair it with hosting-layer
 * protection (e.g. Vercel Deployment Protection) for real enforcement.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Requests still permitted in the current window. */
  remaining: number;
  /** Seconds until the window resets (used for the Retry-After header). */
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  /** Max requests allowed per window per key. */
  limit?: number;
  /** Window length in milliseconds. */
  windowMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

interface WindowState {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const limit = options.limit ?? 10;
  const windowMs = options.windowMs ?? 60_000;
  const now = options.now ?? Date.now;
  const windows = new Map<string, WindowState>();

  function prune(nowMs: number) {
    for (const [key, state] of windows) {
      if (state.resetAt <= nowMs) windows.delete(key);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const nowMs = now();
      prune(nowMs);

      const existing = windows.get(key);
      if (!existing || existing.resetAt <= nowMs) {
        windows.set(key, { count: 1, resetAt: nowMs + windowMs });
        return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
      }

      existing.count += 1;
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000));
      if (existing.count > limit) {
        return { allowed: false, remaining: 0, retryAfterSeconds };
      }
      return { allowed: true, remaining: limit - existing.count, retryAfterSeconds };
    },
  };
}

/** Shared limiter for the generate route: 10 requests per minute per client. */
export const generateRateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

/** Best-effort client identifier from common proxy headers. */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

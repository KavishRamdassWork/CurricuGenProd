import { LRUCache } from 'lru-cache';

type RateLimitOptions = {
  /** Max distinct keys tracked at once (older keys are evicted first). */
  uniqueTokenPerInterval?: number;
  /** Window length in ms. */
  interval?: number;
};

/**
 * Fixed-window, in-memory rate limiter. `check(limit, key)` allows up to `limit` calls per window
 * and rejects the rest.
 *
 * LIMITATION: state lives in this process only. On a multi-instance or serverless deployment each
 * instance counts separately, so the effective limit is `limit x instances`. It is a good guard
 * against a runaway client loop, not a hard abuse barrier; for that, back it with a shared store
 * (e.g. Redis / Upstash) behind this same interface.
 */
export default function buildRateLimit(options?: RateLimitOptions) {
  const interval = options?.interval || 60000;
  const windows = new LRUCache<string, { count: number; resetAt: number }>({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: interval,
  });

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const now = Date.now();
        let entry = windows.get(token);

        // Start a new window if none exists or the previous one has ended. The window is NOT
        // extended by later calls, so a steady client cannot keep itself limited forever.
        if (!entry || entry.resetAt <= now) {
          entry = { count: 0, resetAt: now + interval };
          windows.set(token, entry, { ttl: interval });
        }

        entry.count += 1;

        if (entry.count > limit) {
          reject(new Error('Rate limit exceeded'));
        } else {
          resolve();
        }
      }),
  };
}

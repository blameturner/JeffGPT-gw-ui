import type { Context, Next } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

/**
 * Minimal in-memory fixed-window rate limiter. Suitable for a single-instance
 * LAN deployment (no Redis dep). Keyed by client IP, derived in this order:
 *   1. X-Forwarded-For (first hop) — set by reverse proxies
 *   2. X-Real-IP — also reverse-proxy convention
 *   3. The actual TCP socket remote address — for direct browser → gateway
 *      connections where no proxy is in front (the typical Docker-published
 *      port setup). Without this, every direct request shares one global
 *      bucket and a single noisy client locks everyone out.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(opts: { windowMs: number; max: number; name?: string }) {
  const buckets = new Map<string, Bucket>();
  const { windowMs, max, name = 'rate' } = opts;

  return async function rateLimitMw(c: Context, next: Next) {
    const now = Date.now();
    let ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip');
    if (!ip) {
      try {
        ip = getConnInfo(c).remote.address;
      } catch {
        // getConnInfo is only available under the @hono/node-server runtime.
        // If we ever run somewhere it isn't (tests, edge), fall through.
      }
    }
    const key = `${name}:${ip || 'unknown'}`;

    let b = buckets.get(key);
    if (!b || b.resetAt < now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count += 1;

    // Opportunistic cleanup to keep the map bounded.
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    }

    if (b.count > max) {
      const retry = Math.ceil((b.resetAt - now) / 1000);
      c.header('Retry-After', String(retry));
      return c.json({ error: 'rate_limited' }, 429);
    }
    await next();
  };
}

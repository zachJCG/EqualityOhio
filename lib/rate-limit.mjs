/* =============================================================================
 * lib/rate-limit.mjs: simple in-memory, per-instance rate limiter.
 *
 * Ported from the MVFHC platform (lib/rate-limit.ts). Each server instance
 * keeps its own buckets, so on Vercel this slows a guesser down rather than
 * stopping a distributed one; that is acceptable for a staging gate. Swap for
 * Vercel KV / Upstash if a real form ever needs a shared limit.
 * ========================================================================== */

/**
 * A limiter with separate check and record steps, so a caller can count only
 * the attempts it cares about (the gate counts failed passwords, so a
 * reviewer who logs in repeatedly is never locked out).
 *
 *   limited(key)  true once `max` hits landed inside the current window
 *   hit(key)      record one hit; returns the count in the current window
 */
export function createRateLimiter({ max = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const buckets = new Map();

  function prune(now) {
    if (buckets.size < 1000) return;
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }

  return {
    max,
    windowMs,
    limited(key, now = Date.now()) {
      const bucket = buckets.get(key);
      return Boolean(bucket) && bucket.resetAt > now && bucket.count >= max;
    },
    hit(key, now = Date.now()) {
      prune(now);
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return 1;
      }
      bucket.count += 1;
      return bucket.count;
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}

/* MVFHC-compatible one-call form: records a hit and says whether it was
 * allowed. */
const shared = new Map();
export function rateLimit(key, max = 5, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const bucket = shared.get(key);
  if (!bucket || bucket.resetAt < now) {
    shared.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

/** The caller's address as Vercel reports it (x-real-ip), else the first
 * x-forwarded-for hop, else one shared bucket. */
export function clientKey(headers) {
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

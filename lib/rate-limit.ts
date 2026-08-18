import { headers } from "next/headers";

/**
 * A fixed-window rate limiter held in process memory.
 *
 * The honest limitation: serverless means each instance keeps its own counters,
 * so the real ceiling is roughly `limit x instances`, and a cold start forgets
 * everything. That is enough to stop the thing this app actually needs stopped
 * — one script hammering one endpoint in a loop — and not enough to stop a
 * distributed attacker. Upgrading to Upstash Redis later is a swap of this
 * file's internals, not of its callers.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Bounds memory if something ever generates unbounded distinct keys. */
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfter: number };

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full of live buckets: drop the oldest insertions rather than grow.
  if (buckets.size >= MAX_TRACKED_KEYS) {
    const excess = buckets.size - Math.floor(MAX_TRACKED_KEYS / 2);
    let dropped = 0;
    for (const key of buckets.keys()) {
      if (dropped++ >= excess) break;
      buckets.delete(key);
    }
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true };
}

/**
 * Identifies the caller for limiting purposes.
 *
 * A user id is used when there is one, because it survives IP changes. Falling
 * back to the forwarded IP is weaker — it is a client-supplied header anywhere
 * that is not behind a trusted proxy — but on Vercel the platform sets it, and
 * the alternative for signed-out endpoints is no limit at all.
 */
export async function clientKey(userId?: string | null): Promise<string> {
  if (userId) return `user:${userId}`;

  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || store.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

/** Shared wording so every limited action refuses in the same voice. */
export function tooManyMessage(retryAfter: number, noun = "attempts"): string {
  const minutes = Math.ceil(retryAfter / 60);
  const wait =
    retryAfter < 60
      ? `${retryAfter} seconds`
      : `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  return `Too many ${noun}. Try again in about ${wait}.`;
}

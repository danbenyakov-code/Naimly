import { headers } from "next/headers";

/**
 * מגבלת קצב בזיכרון התהליך. ב‑Vercel כל Lambda מחזיקה מונה משלה, ולכן זו
 * הגנה מיטבית‑אך‑לא‑מוחלטת מפני הצפה, ספאם לידים וזיהום אנליטיקה.
 * לעומס גבוה יש להחליף את המימוש ב‑Upstash/Redis בלי לשנות את החתימה.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size >= MAX_KEYS) buckets.clear();
}

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

/** כתובת ה‑IP של הפונה, לפי הכותרות ש‑Vercel מציב. */
export async function clientIp() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ip = requestHeaders.get("x-real-ip") || forwarded?.split(",")[0]?.trim() || "";
  return ip || "unknown";
}

export function tooManyRequests(result: RateLimitResult, message = "יותר מדי בקשות. נסו שוב בעוד רגע.") {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: { "content-type": "application/json; charset=utf-8", "retry-after": String(result.retryAfterSeconds) },
  });
}

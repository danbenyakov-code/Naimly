import { headers } from "next/headers";

/**
 * מקור אמין לבניית כתובות חוזרות (checkout, אימות מייל, webhook).
 * כותרות Origin/Host מגיעות מהלקוח וניתנות לזיוף, ולכן משתמשים בהן
 * רק כשהן תואמות לרשימת ההיתר של הפריסה.
 */
function normalize(value: string) {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function allowedOrigins() {
  const list = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    ...(process.env.ADDITIONAL_ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()),
    process.env.NODE_ENV === "production" ? "" : "http://localhost:3000",
  ];
  return new Set(list.filter(Boolean).map((value) => normalize(String(value))).filter(Boolean));
}

export function canonicalOrigin() {
  return normalize(process.env.NEXT_PUBLIC_SITE_URL || "")
    || normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL || "")
    || normalize(process.env.VERCEL_URL || "")
    || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
}

/** מחזיר את מקור הבקשה רק אם הוא ברשימת ההיתר, אחרת את הכתובת הקנונית. */
export async function resolveOrigin() {
  const requestHeaders = await headers();
  const requested = normalize(requestHeaders.get("origin") || "");
  if (requested && allowedOrigins().has(requested)) return requested;
  return canonicalOrigin() || requested;
}

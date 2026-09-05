// שכבת הגנה יחידה לכל כתובת שמגיעה ממשתמש ומוצגת כ‑href/src.
// zod מאשר `javascript:` ו‑`data:` בתור URL תקין, ולכן אסור לסמוך עליו לבדו.

const safeSchemes = new Set(["http:", "https:"]);
const safeLinkSchemes = new Set(["http:", "https:", "mailto:", "tel:", "sms:"]);

function parse(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // תווי בקרה משמשים לעקיפת בדיקות סכימה (\u0000javascript:...)
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/** true רק עבור http/https אמיתי. משמש לוולידציה בשרת. */
export function isHttpUrl(value: string) {
  const url = parse(value);
  return Boolean(url && safeSchemes.has(url.protocol));
}

/** כתובת לתצוגה כ‑href. מחזיר "" כשהערך אינו בטוח. */
export function safeHref(value: string | undefined | null) {
  if (!value) return "";
  const url = parse(String(value));
  if (!url) return "";
  return safeLinkSchemes.has(url.protocol) ? url.toString() : "";
}

/** כתובת לתצוגה כ‑src של תמונה/מדיה. http/https בלבד. */
export function safeSrc(value: string | undefined | null) {
  if (!value) return "";
  const url = parse(String(value));
  if (!url) return "";
  return safeSchemes.has(url.protocol) ? url.toString() : "";
}

/** נתיב פנימי בטוח להפניה. חוסם //evil.com, /\evil.com וכתובות מוחלטות. */
export function safeInternalPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}

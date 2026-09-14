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

/**
 * האם המחרוזת מכילה תו בקרה.
 *
 * נכתב בלולאה ולא ברגקס: מחלקת תווים עם escapes נשברת בקלות בעריכה
 * אוטומטית, וכאן שגיאה שקטה פותחת פרצה במקום להיכשל ברעש.
 */
function hasControlChars(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * נתיב שורש מאותו מקור, למשל /samples/logo-example.jpg.
 *
 * מותר לוכסן יחיד בלבד: //evil.com היא כתובת protocol-relative
 * שמצביעה החוצה, וגם הצורה עם לוכסן הפוך מנוצלת באותו אופן.
 */
function isSameOriginPath(value: string) {
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//") || value.startsWith("/\\")) return false;
  return !hasControlChars(value);
}

/**
 * כתובת לתצוגה כ-src של תמונה/מדיה: http/https, או נתיב מאותו מקור.
 *
 * new URL זורק על נתיב יחסי, ולכן עד כה נחסמו גם הנכסים של האתר
 * עצמו — דווקא הבטוחים ביותר. כרטיס ההדגמה הציג בגלל זה רקע ריק
 * במקום התמונות שב-public/samples.
 */
export function safeSrc(value: string | undefined | null) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (isSameOriginPath(trimmed)) return trimmed;
  const url = parse(trimmed);
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

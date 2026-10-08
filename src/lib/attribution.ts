/**
 * מקור ההגעה של נרשם (utm), כדי לדעת כמה הרשמות הגיעו מתג "נבנה ב־NAIMLY"
 * שבכרטיסים, ומכל ערוץ אחר.
 *
 * בכניסה עם utm_source ה-proxy שומר עוגייה (המגע האחרון קובע). בהרשמה
 * העוגייה נקראת ונשמרת על המשתמש, ומשם על אירוע "נרשם" ביומן.
 * העוגייה מכילה רק את ערכי ה-utm, בלי שום מזהה של אדם.
 */

export const ATTRIBUTION_COOKIE = "naimly_attribution";
export const ATTRIBUTION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type Attribution = { source: string; medium: string; campaign: string; landedAt: string };

/** ערכים קצרים וצפויים בלבד: אותיות, ספרות, מקף, קו תחתון ונקודה. */
function clean(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 60);
}

export function attributionFromParams(params: URLSearchParams, now = new Date()): Attribution | null {
  const source = clean(params.get("utm_source"));
  if (!source) return null;
  return { source, medium: clean(params.get("utm_medium")), campaign: clean(params.get("utm_campaign")), landedAt: now.toISOString() };
}

export function parseAttributionCookie(value: string | undefined): Attribution | null {
  if (!value) return null;
  try {
    const data = JSON.parse(value) as Partial<Attribution>;
    const source = clean(data.source);
    if (!source) return null;
    const landed = Date.parse(String(data.landedAt || ""));
    return {
      source,
      medium: clean(data.medium),
      campaign: clean(data.campaign),
      landedAt: Number.isFinite(landed) ? new Date(landed).toISOString() : "",
    };
  } catch {
    return null;
  }
}

/** הפרמטרים של קישור התג: utm_campaign = הכתובת של הכרטיס שממנו הגיעו. */
export function badgeHref(slug: string) {
  return `/?utm_source=card_badge&utm_medium=referral&utm_campaign=${encodeURIComponent(slug)}`;
}

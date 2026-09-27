/**
 * Content-Security-Policy של האתר — כולל הכרטיסים הציבוריים של הלקוחות.
 *
 * לקח מתקלה אמיתית (Meta Pixel, 2026-09): הסקריפט של הפיקסל נטען ונרשם,
 * אבל connect-src לא התיר את www.facebook.com — ואף אירוע לא יצא, לא של
 * NAIMLY ולא של הלקוחות. תקלת CSP לא שוברת את הדף ולא מופיעה בלוגים של
 * השרת; היא נראית רק בקונסול של הדפדפן. לכן:
 *
 * 1. כל אינטגרציה מתועדת כאן בנפרד, עם *כל* ההוסטים שהיא צריכה לפי
 *    הוראות הספק — לכל directive, לא רק ל-script-src.
 * 2. tests/csp.test.mts מוודא שכל אינטגרציה מכוסה במדיניות הסופית.
 * 3. אינטגרציה חדשה = רשומה חדשה כאן + בדיקה בדפדפן שהאירועים יוצאים
 *    בפועל (לא רק שהסקריפט נטען).
 */

type Directive = "script-src" | "connect-src" | "img-src" | "frame-src";

export type Integration = {
  name: string;
  /** מקור ההוראות — כדי שמי שמעדכן ידע מאיפה הרשימה באה. */
  source: string;
  hosts: Partial<Record<Directive, string[]>>;
};

export const integrations: Integration[] = [
  {
    name: "Meta Pixel",
    source: "https://developers.facebook.com/docs/meta-pixel/advanced/#content-security-policy",
    hosts: {
      "script-src": ["https://connect.facebook.net"],
      // האירועים עצמם: fetch/sendBeacon ל-/tr. זו השורה שחסרה בתקלה.
      "connect-src": ["https://www.facebook.com", "https://connect.facebook.net"],
      // noscript ומצב גיבוי: <img src="https://www.facebook.com/tr?...">
      "img-src": ["https://www.facebook.com"],
    },
  },
  {
    name: "Google Analytics 4 (gtag.js)",
    source: "https://developers.google.com/tag-platform/security/guides/csp#google_analytics_4_google_analytics",
    hosts: {
      "script-src": ["https://*.googletagmanager.com"],
      // האירועים נשלחים לשרת אזורי (region1., region2. …) — לא לכתובת אחת קבועה.
      "connect-src": ["https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com"],
      "img-src": ["https://*.google-analytics.com", "https://*.googletagmanager.com"],
    },
  },
  {
    name: "Google Signals / קהלי רימרקטינג של GA4",
    source: "https://developers.google.com/tag-platform/security/guides/csp#google_signals_cross-device",
    hosts: {
      "connect-src": ["https://*.g.doubleclick.net", "https://*.google.com", "https://*.google.co.il"],
      "img-src": ["https://*.g.doubleclick.net", "https://*.google.com", "https://*.google.co.il"],
    },
  },
  {
    name: "Google Tag Manager",
    source: "https://developers.google.com/tag-platform/security/guides/csp#google_tag_manager",
    hosts: {
      "script-src": ["https://*.googletagmanager.com"],
      "connect-src": ["https://*.googletagmanager.com"],
      "img-src": ["https://*.googletagmanager.com"],
    },
  },
  {
    // תגיות המרה של Google Ads שמוגדרות בתוך קונטיינר GTM של הלקוח.
    name: "Google Ads (דרך GTM)",
    source: "https://developers.google.com/tag-platform/security/guides/csp#google_ads",
    hosts: {
      "script-src": ["https://www.googleadservices.com", "https://*.g.doubleclick.net"],
      "connect-src": ["https://www.googleadservices.com", "https://*.g.doubleclick.net"],
      "img-src": ["https://www.googleadservices.com", "https://*.g.doubleclick.net"],
      "frame-src": ["https://*.g.doubleclick.net"],
    },
  },
  {
    name: "YouTube (סרטונים מוטמעים בכרטיס)",
    source: "https://developers.google.com/youtube/iframe_api_reference",
    hosts: { "frame-src": ["https://www.youtube-nocookie.com", "https://www.youtube.com"] },
  },
];

function hostsFor(directive: Directive) {
  return [...new Set(integrations.flatMap((integration) => integration.hosts[directive] || []))];
}

/** בונה את כותרת ה-CSP. supabaseOrigin — אחסון התמונות והקבצים. */
export function buildContentSecurityPolicy({ supabaseOrigin, isDev }: { supabaseOrigin: string; isDev: boolean }) {
  const supabaseWs = supabaseOrigin.replace("https://", "wss://");
  return [
    "default-src 'self'",
    // הסקריפטים של GA/GTM/Pixel מוזרקים בצד הלקוח ולכן נדרש unsafe-inline.
    // Turbopack ב-dev צריך eval וחיבור HMR; שניהם לא נכנסים לפרודקשן.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${hostsFor("script-src").join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${hostsFor("img-src").join(" ")} ${supabaseOrigin}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin} ${supabaseWs} ${hostsFor("connect-src").join(" ")}${isDev ? " ws: http://localhost:*" : ""}`,
    `frame-src 'self' ${hostsFor("frame-src").join(" ")}`,
    `media-src 'self' blob: ${supabaseOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ]
    .map((directive) => directive.replace(/\s+/g, " ").trim())
    .join("; ");
}

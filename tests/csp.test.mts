import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildContentSecurityPolicy } from "../src/lib/csp.ts";

/*
 * רגרסיה לתקלת Meta Pixel (2026-09): הסקריפט נטען, אבל connect-src לא
 * התיר את www.facebook.com — ואף אירוע לא יצא, לא של NAIMLY ולא של
 * פיקסלים שלקוחות חיברו לכרטיסים. תקלת CSP לא נראית בשרת ולא שוברת את
 * הדף, ולכן היא נבדקת כאן מול הכתובות *האמיתיות* שכל כלי פונה אליהן —
 * רשימה נפרדת מ-csp.ts, כדי שמחיקה בטעות שם תיכשל כאן.
 */

const policy = buildContentSecurityPolicy({ supabaseOrigin: "https://example.supabase.co", isDev: false });

function sources(directive: string) {
  const entry = policy.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${directive} `));
  assert.ok(entry, `חסר directive: ${directive}`);
  return entry.split(/\s+/).slice(1);
}

/** האם כתובת מותרת לפי רשימת מקורות CSP (כולל *.domain). */
function allows(directive: string, url: string) {
  const { protocol, host } = new URL(url);
  return sources(directive).some((source) => {
    if (!source.startsWith("https://")) return false;
    const allowed = source.slice("https://".length).replace(/\/.*$/, "");
    if (protocol !== "https:") return false;
    if (allowed.startsWith("*.")) return host.endsWith(allowed.slice(1));
    return host === allowed;
  });
}

const required: Array<[tool: string, directive: string, url: string]> = [
  // Meta Pixel
  ["Meta Pixel — הסקריפט", "script-src", "https://connect.facebook.net/en_US/fbevents.js"],
  ["Meta Pixel — הגדרות הפיקסל", "connect-src", "https://connect.facebook.net/signals/config/2492042894608866"],
  ["Meta Pixel — שליחת אירוע (התקלה)", "connect-src", "https://www.facebook.com/tr/"],
  ["Meta Pixel — noscript", "img-src", "https://www.facebook.com/tr?id=1&ev=PageView&noscript=1"],
  // בכרום אמיתי האירוע יוצא דרך iframe נסתר + טופס POST — לא ב-fetch כמו בבדיקה אוטומטית.
  ["Meta Pixel — iframe שליחה (כרום אמיתי)", "frame-src", "https://www.facebook.com/"],
  ["Meta Pixel — טופס POST ל-/tr (כרום אמיתי)", "form-action", "https://www.facebook.com/tr/"],
  // Google Analytics 4
  ["GA4 — gtag.js", "script-src", "https://www.googletagmanager.com/gtag/js?id=G-ABC123"],
  ["GA4 — שליחת אירוע", "connect-src", "https://www.google-analytics.com/g/collect"],
  ["GA4 — שרת אזורי", "connect-src", "https://region1.google-analytics.com/g/collect"],
  ["GA4 — שרת אזורי חדש", "connect-src", "https://region1.analytics.google.com/g/collect"],
  ["GA4 — Google Signals", "connect-src", "https://stats.g.doubleclick.net/g/collect"],
  ["GA4 — קהלי רימרקטינג", "img-src", "https://www.google.com/ads/ga-audiences"],
  ["GA4 — קהלי רימרקטינג (ישראל)", "img-src", "https://www.google.co.il/ads/ga-audiences"],
  // Google Tag Manager
  ["GTM — הקונטיינר", "script-src", "https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"],
  // Google Ads דרך GTM
  ["Google Ads — סקריפט המרה", "script-src", "https://www.googleadservices.com/pagead/conversion_async.js"],
  ["Google Ads — המרה", "connect-src", "https://googleads.g.doubleclick.net/pagead/viewthroughconversion/1/"],
  ["Google Ads — פיקסל המרה", "img-src", "https://www.googleadservices.com/pagead/conversion/1/"],
  // YouTube בכרטיס
  ["YouTube מוטמע", "frame-src", "https://www.youtube-nocookie.com/embed/abc"],
];

describe("CSP — כל כלי מדידה שכרטיס או האתר מחברים באמת עובד", () => {
  for (const [tool, directive, url] of required) {
    it(`${tool}: ${directive} מתיר ${new URL(url).host}`, () => {
      assert.ok(allows(directive, url), `${directive} חוסם את ${url} — ${tool} ייטען אבל לא ישלח נתונים`);
    });
  }

  it("פרודקשן לא מתיר eval, ו-dev כן (Turbopack)", () => {
    assert.ok(!policy.includes("'unsafe-eval'"));
    assert.ok(buildContentSecurityPolicy({ supabaseOrigin: "", isDev: true }).includes("'unsafe-eval'"));
  });

  it("לא נפתח לכל העולם — אין מקור * גורף", () => {
    for (const directive of ["script-src", "connect-src", "img-src", "frame-src", "form-action"]) {
      assert.ok(!sources(directive).includes("*") && !sources(directive).includes("https:"), `${directive} פתוח לכל מקור`);
    }
  });
});

describe("GTM בכרטיס — הקונטיינר מאותחל כמו בסניפט הרשמי", () => {
  it("נדחף אירוע gtm.js ל-dataLayer לפני טעינת gtm.js", () => {
    /*
     * בלי האירוע הזה הקונטיינר נטען אבל טריגר All Pages לא מופעל, ואף
     * תגית של הלקוח לא רצה — תקלה שקטה מאותו סוג כמו תקלת ה-CSP.
     */
    const source = readFileSync("src/components/card/third-party-tracking.tsx", "utf8");
    const init = source.indexOf("event:'gtm.js'");
    const load = source.indexOf("googletagmanager.com/gtm.js");
    assert.ok(init > -1, "חסר dataLayer.push({'gtm.start', event:'gtm.js'})");
    assert.ok(init < load, "האתחול חייב לקרות לפני טעינת הקונטיינר");
  });
});

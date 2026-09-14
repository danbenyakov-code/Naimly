import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { TRIAL_DAYS, formatTrialRemaining, trialState } from "../src/lib/plan-access.ts";

const read = (path: string) => fs.readFileSync(path, "utf8");

const NOW = new Date("2026-06-15T12:00:00.000Z").getTime();
const viewer = (hoursLeft: number) => ({
  plan: "trial" as const,
  subscriptionStatus: "trialing" as const,
  trialEndsAt: new Date(NOW + hoursLeft * 3600000).toISOString(),
  trialPending: false,
  planSelectedAt: new Date(NOW).toISOString(),
});

describe("QA-019 — מקור זמן יחיד", () => {
  it("צעד השחזור: התנסות טרייה אינה מציגה 14 ליד 13", () => {
    // 14 ימים פחות דקה: הכותרת והטיימר חייבים להסכים.
    const state = trialState(viewer(TRIAL_DAYS * 24 - 0.02), NOW);
    assert.equal(state.daysLeft, 13, "floor נותן 13 ימים שלמים, כמו הטיימר");
    assert.equal(state.hoursLeft, 23);
  });

  it("הימים והשעות אינם חופפים", () => {
    const state = trialState(viewer(50), NOW);
    assert.equal(state.daysLeft, 2);
    assert.equal(state.hoursLeft, 2, "השעות הן השארית, לא הסך הכולל");
  });

  it("הניסוח מאחד את שניהם", () => {
    assert.equal(formatTrialRemaining(trialState(viewer(50), NOW)), "נותרו 2 ימים ו-2 שעות");
    assert.equal(formatTrialRemaining(trialState(viewer(26), NOW)), "נותר יום אחד ו-2 שעות");
    assert.equal(formatTrialRemaining(trialState(viewer(24), NOW)), "נותר יום אחד");
    assert.equal(formatTrialRemaining(trialState(viewer(3), NOW)), "נותרו 3 שעות");
    assert.equal(formatTrialRemaining(trialState(viewer(1), NOW)), "נותרה שעה אחת");
  });

  it("תפוגה מנוסחת אחרת ולא כאפס ימים", () => {
    assert.equal(formatTrialRemaining(trialState(viewer(-1), NOW)), "ההתנסות הסתיימה");
  });
});

describe("QA-020 — הדרכה ראשונית", () => {
  const source = read("src/components/dashboard/card-builder-v2.tsx");

  it("הסיור אינו מוגבל למצב הדגמה", () => {
    assert.doesNotMatch(source, /useEffect\(\(\) => \{\s*if \(!demo\) return;\s*const frame[\s\S]{0,120}setShowTour/,
      "סיור שרץ רק בהדגמה אינו מגיע ללקוח אמיתי");
    assert.match(source, /onboardingSeenAt/);
  });

  it("המצב נשמר בשרת ולא רק בדפדפן", () => {
    assert.match(source, /fetch\("\/api\/onboarding\/seen", \{ method: "POST" \}\)/);
    assert.ok(fs.existsSync("src/app/api/onboarding/seen/route.ts"));
  });

  it("REQ-005: קיימים הבא, הקודם, דילוג וסיום", () => {
    assert.match(source, /onPrev/);
    assert.match(source, /הקודם/);
    assert.match(source, /דילוג על ההדרכה/);
    assert.match(source, /isLast \? "סיום" : "הבא"/);
  });

  it("כשל בשמירה אינו חוסם את סגירת הסיור", () => {
    assert.ok(source.includes("setShowTour(false);"), "הסיור נסגר לפני הקריאה לשרת");
    assert.ok(source.includes(".catch(() => null)"), "כשל ברשת אינו אמור להשאיר את הסיור פתוח");
  });
});

describe("QA-022 — סטטוס תשתיות אינו מוצג ללקוח", () => {
  it("הסקשן מותנה בתפקיד מנהל", () => {
    const source = read("src/app/dashboard/settings/page.tsx");
    assert.ok(source.includes('viewer.role === "admin" &&'), "פרטי מימוש מספרים לתוקף על איזו תשתית המערכת רצה");
    assert.ok(source.includes("סטטוס חיבורי Production"), "הסקשן עדיין קיים, רק מוגבל");
  });
});

describe("QA-034 — ולידציה למזהי מדידה", () => {
  const source = read("src/components/dashboard/card-builder-v2.tsx");

  it("קיימת בדיקה בצד לקוח לשלושת המזהים", () => {
    assert.match(source, /const trackingErrors/);
    assert.match(source, /\^G-\[A-Z0-9\]\{4,20\}\$/);
    assert.match(source, /\^GTM-\[A-Z0-9\]\{4,15\}\$/);
  });

  it("השדות מסומנים ב-aria-invalid", () => {
    for (const field of ["googleAnalyticsId", "googleTagManagerId", "metaPixelId"]) {
      assert.ok(source.includes(`aria-invalid={Boolean(trackingErrors.${field})}`), `${field} ללא aria-invalid`);
    }
  });

  it("ההודעות מדגימות את הפורמט הנכון", () => {
    assert.match(source, /לדוגמה: G-ABC1234567/);
    assert.match(source, /לדוגמה: GTM-ABC1234/);
    assert.match(source, /לדוגמה: 1234567890123/);
  });

  it("השדה של Meta Pixel מקבל ספרות בלבד", () => {
    assert.match(source, /metaPixelId: e\.target\.value\.replace\(\/\[\^0-9\]\/g, ""\)/);
  });

  it("Field המקומי תומך בשגיאה ומכריז אותה", () => {
    assert.match(source, /function Field\(\{ label, wide, required, error, children \}/);
    assert.match(source, /role="alert"[\s\S]{0,80}\{error\}/);
  });
});

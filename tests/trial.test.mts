import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TRIAL_DAYS, canEdit, resolveAccess, trialState } from "../src/lib/plan-access.ts";
import type { Viewer } from "../src/lib/types.ts";

type TrialViewer = Pick<Viewer, "plan" | "subscriptionStatus" | "trialEndsAt" | "trialPending" | "planSelectedAt">;

const NOW = new Date("2026-06-15T12:00:00.000Z").getTime();
const inDays = (days: number) => new Date(NOW + days * 86400000).toISOString();

/** לקוח שכבר בחר התנסות — זה המצב הרגיל אחרי שער ההצטרפות. */
const base: TrialViewer = {
  plan: "trial",
  subscriptionStatus: "trialing",
  trialEndsAt: undefined,
  trialPending: false,
  planSelectedAt: new Date(NOW).toISOString(),
};

describe("שער ההצטרפות — בלי בחירת מסלול אין גישה", () => {
  const notChosen: TrialViewer = { ...base, planSelectedAt: undefined, trialPending: true };

  it("ההתנסות אינה פעילה וממתינה לבחירה", () => {
    const state = trialState(notChosen, NOW);
    assert.equal(state.pending, true);
    assert.equal(state.active, false, "התנסות שלא נבחרה אינה פעילה");
    assert.equal(state.expired, false);
    assert.equal(state.endsAt, null);
  });

  it("העריכה חסומה", () => {
    assert.equal(canEdit(notChosen), false);
  });

  it("הסיבה נפרדת מ'מנוי לא פעיל', כדי שההודעה תהיה מדויקת", () => {
    const access = resolveAccess(notChosen, NOW);
    assert.equal(access.locked, true);
    assert.equal(access.reason, "plan_not_selected");
  });

  it("כל היכולות סגורות — הממשק לא מרשה את מה שהמסד חוסם", () => {
    const access = resolveAccess(notChosen, NOW);
    for (const [feature, enabled] of Object.entries(access.features)) {
      assert.equal(enabled, false, `היכולת ${feature} נשארה פתוחה בלי בחירת מסלול`);
    }
  });
});

describe("התנסות — ספירה לאחור מרגע הבחירה", () => {
  it("יום ראשון: נותרו 14 ימים", () => {
    const state = trialState({ ...base, trialEndsAt: inDays(TRIAL_DAYS) }, NOW);
    assert.equal(state.active, true);
    assert.equal(state.pending, false);
    assert.equal(state.daysLeft, TRIAL_DAYS);
    assert.equal(state.percentUsed, 0);
  });

  it("אמצע התקופה: אחוז השימוש סביב 50", () => {
    const state = trialState({ ...base, trialEndsAt: inDays(7) }, NOW);
    assert.ok(state.percentUsed >= 48 && state.percentUsed <= 52, `אחוז: ${state.percentUsed}`);
  });

  it("שעה לפני הסוף: עדיין פעילה", () => {
    const state = trialState({ ...base, trialEndsAt: new Date(NOW + 3600000).toISOString() }, NOW);
    assert.equal(state.active, true);
    assert.equal(state.expired, false);
    assert.equal(state.hoursLeft, 1);
  });

  it("שנייה אחרי הסוף: פגה", () => {
    const state = trialState({ ...base, trialEndsAt: new Date(NOW - 1000).toISOString() }, NOW);
    assert.equal(state.expired, true);
    assert.equal(state.active, false);
    assert.equal(state.percentUsed, 100);
  });

  it("בחר התנסות אך התאריך טרם נקבע — עדיין פתוח, לא נעול", () => {
    const state = trialState(base, NOW);
    assert.equal(state.active, true, "בחירה קיימת, ולכן אין לחסום בגלל תאריך חסר");
    assert.equal(state.pending, false);
  });
});

describe("תפוגה — חסימה מלאה", () => {
  const expired: TrialViewer = { ...base, trialEndsAt: new Date(NOW - 86400000).toISOString() };

  it("העריכה נחסמת", () => {
    assert.equal(canEdit(expired), false);
  });

  it("כל היכולות נסגרות", () => {
    const access = resolveAccess(expired, NOW);
    assert.equal(access.locked, true);
    assert.equal(access.reason, "trial_expired");
    for (const [feature, enabled] of Object.entries(access.features)) {
      assert.equal(enabled, false, `היכולת ${feature} נשארה פתוחה אחרי תפוגה`);
    }
  });
});

describe("התנסות פעילה — כל היכולות פתוחות", () => {
  it("מכסות של פרימיום", () => {
    const access = resolveAccess({ ...base, trialEndsAt: inDays(10) }, NOW);
    assert.equal(access.locked, false);
    assert.equal(access.plan, "trial");
    assert.equal(access.features.tracking, true);
    assert.equal(access.features.leadExport, true);
  });
});

describe("מנוי פעיל", () => {
  it("מנוי בתשלום מבטל את מצב ההתנסות", () => {
    const viewer: TrialViewer = { plan: "pro", subscriptionStatus: "active", trialEndsAt: inDays(-30), trialPending: false, planSelectedAt: inDays(-40) };
    const state = trialState(viewer, NOW);
    assert.equal(state.active, false);
    assert.equal(state.expired, false);

    const access = resolveAccess(viewer, NOW);
    assert.equal(access.locked, false);
    assert.equal(access.plan, "pro");
    assert.equal(access.features.tracking, true, "מקצועי כולל מדידה");
    assert.equal(access.features.leadExport, false, "ייצוא לידים הוא פרימיום בלבד");
  });

  it("מנוי פעיל אינו נחסם גם בלי plan_selected_at, כדי לא לנעול לקוח משלם", () => {
    const access = resolveAccess({ plan: "premium", subscriptionStatus: "active", trialEndsAt: undefined, trialPending: false, planSelectedAt: undefined }, NOW);
    assert.equal(access.locked, false);
    assert.equal(access.plan, "premium");
  });

  it("מנוי שבוטל חוסם", () => {
    const access = resolveAccess({ plan: "pro", subscriptionStatus: "canceled", trialEndsAt: undefined, trialPending: false, planSelectedAt: inDays(-40) }, NOW);
    assert.equal(access.locked, true);
    assert.equal(access.reason, "inactive");
  });

  it("תשלום שממתין לאישור חוסם עם סיבה נפרדת", () => {
    const access = resolveAccess({ plan: "pro", subscriptionStatus: "past_due", trialEndsAt: undefined, trialPending: false, planSelectedAt: inDays(-1) }, NOW);
    assert.equal(access.locked, true);
    assert.equal(access.reason, "payment_pending");
  });
});

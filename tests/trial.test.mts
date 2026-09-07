import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TRIAL_DAYS, canEdit, resolveAccess, trialState } from "../src/lib/plan-access.ts";
import type { Viewer } from "../src/lib/types.ts";

/** בסיס Viewer לבדיקות, עם תאריכים מבוקרים. */
const base: Pick<Viewer, "plan" | "subscriptionStatus" | "trialEndsAt" | "trialPending"> = {
  plan: "trial",
  subscriptionStatus: "trialing",
  trialEndsAt: undefined,
  trialPending: false,
};

const NOW = new Date("2026-06-15T12:00:00.000Z").getTime();
const inDays = (days: number) => new Date(NOW + days * 86400000).toISOString();

describe("התנסות — התחלה בפרסום הראשון", () => {
  it("לפני פרסום: פעילה, ממתינה, בלי תאריך תפוגה", () => {
    const state = trialState({ ...base, trialPending: true }, NOW);
    assert.equal(state.pending, true);
    assert.equal(state.active, true);
    assert.equal(state.expired, false);
    assert.equal(state.endsAt, null, "לא אמור להיות תאריך תפוגה לפני הפרסום");
  });

  it("לפני פרסום: העריכה פתוחה", () => {
    assert.equal(canEdit({ ...base, trialPending: true }), true);
  });

  it("לפני פרסום: כל היכולות פתוחות", () => {
    const access = resolveAccess({ ...base, trialPending: true }, NOW);
    assert.equal(access.locked, false);
    assert.equal(access.plan, "trial");
    assert.equal(access.features.tracking, true);
    assert.equal(access.features.leadExport, true);
  });
});

describe("התנסות — ספירה לאחור", () => {
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
});

describe("תפוגה — חסימה מלאה", () => {
  const expired = { ...base, trialEndsAt: new Date(NOW - 86400000).toISOString() };

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

describe("מנוי פעיל", () => {
  it("מנוי בתשלום מבטל את מצב ההתנסות", () => {
    const viewer = { plan: "pro" as const, subscriptionStatus: "active" as const, trialEndsAt: inDays(-30), trialPending: false };
    const state = trialState(viewer, NOW);
    assert.equal(state.active, false);
    assert.equal(state.expired, false);

    const access = resolveAccess(viewer, NOW);
    assert.equal(access.locked, false);
    assert.equal(access.plan, "pro");
    assert.equal(access.features.tracking, true, "מקצועי כולל מדידה");
    assert.equal(access.features.leadExport, false, "ייצוא לידים הוא פרימיום בלבד");
  });

  it("מנוי שבוטל חוסם", () => {
    const access = resolveAccess({ plan: "pro", subscriptionStatus: "canceled", trialEndsAt: undefined, trialPending: false }, NOW);
    assert.equal(access.locked, true);
    assert.equal(access.reason, "inactive");
  });

  it("תשלום שממתין לאישור חוסם עם סיבה נפרדת", () => {
    const access = resolveAccess({ plan: "pro", subscriptionStatus: "past_due", trialEndsAt: undefined, trialPending: false }, NOW);
    assert.equal(access.locked, true);
    assert.equal(access.reason, "payment_pending");
  });
});

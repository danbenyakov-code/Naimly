import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarDaysBetween, decideTrialEmail, decideWeeklyReport, israelHourOf, isIsraelSunday, weekKey } from "../src/lib/lifecycle-emails.ts";
import type { UserOverviewRow } from "../src/lib/user-control.ts";

// יום חמישי, 8 באוקטובר 2026, 09:00 שעון ישראל (קיץ, UTC+3).
const NOW = Date.parse("2026-10-08T06:00:00.000Z");
const HOUR = 3600000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString();

function row(overrides: Partial<UserOverviewRow> = {}): UserOverviewRow {
  return {
    user_id: "u1", full_name: "דנה כהן", email: "dana@example.com", role: "customer", created_by_admin: false,
    profile_phone: "", signed_up_at: iso(NOW - 12 * DAY), email_confirmed_at: iso(NOW - 12 * DAY), last_sign_in_at: null,
    plan_id: "trial", subscription_status: "trialing", plan_selected_at: iso(NOW - 11 * DAY),
    trial_started_at: iso(NOW - 11 * DAY), trial_ends_at: iso(NOW + 3 * DAY + 5 * HOUR), current_period_end: iso(NOW + 3 * DAY + 5 * HOUR),
    admin_locked: false, card_count: 1, published_count: 1, primary_card_slug: "dana", primary_business_name: "סטודיו דנה",
    primary_card_published: true, card_phone: "", card_whatsapp: "", payment_phone: "", open_payment_status: null,
    first_payment_at: null, views: 10, clicks: 2, leads: 1, last_activity_type: null, last_activity_at: null, last_app_visit_at: null,
    ...overrides,
  };
}

const none = new Set<string>();
const endsIn = (ms: number) => ({ trial_ends_at: iso(NOW + ms), current_period_end: iso(NOW + ms) });

describe("שעון ישראל", () => {
  it("06:00 UTC בקיץ = 09:00 בישראל, 07:00 UTC בחורף = 09:00", () => {
    assert.equal(israelHourOf(NOW), 9);
    assert.equal(israelHourOf(Date.parse("2026-12-10T07:00:00.000Z")), 9);
    assert.equal(israelHourOf(Date.parse("2026-12-10T06:00:00.000Z")), 8);
  });
  it("ימי לוח, לא 24 שעות", () => {
    assert.equal(calendarDaysBetween(NOW, Date.parse("2026-10-09T20:30:00.000Z")), 1, "מחר בערב = יום אחד");
    assert.equal(calendarDaysBetween(NOW, Date.parse("2026-10-08T21:30:00.000Z")), 1, "00:30 בלילה בישראל כבר מחר");
  });
  it("יום ראשון בישראל", () => {
    assert.equal(isIsraelSunday(Date.parse("2026-10-11T06:00:00.000Z")), true);
    assert.equal(isIsraelSunday(NOW), false);
  });
});

describe("מיילי סיום ניסיון", () => {
  it("3 ימים לפני", () => assert.deepEqual(decideTrialEmail(row(), none, NOW), { kind: "trial_ending_3d", daysLeft: 3 }));
  it("יום לפני", () => assert.deepEqual(decideTrialEmail(row(endsIn(DAY + 4 * HOUR)), none, NOW), { kind: "trial_ending_1d", daysLeft: 1 }));
  it("ביום הסיום, אחרי שהסתיים", () => assert.deepEqual(decideTrialEmail(row(endsIn(-2 * HOUR)), none, NOW), { kind: "trial_ended", daysLeft: 0 }));
  it("4 ימים לפני: עוד לא", () => assert.equal(decideTrialEmail(row(endsIn(4 * DAY + 5 * HOUR)), none, NOW).kind, null));
  it("לא שולחים פעמיים", () => {
    assert.equal(decideTrialEmail(row(), new Set(["trial_ending_3d"]), NOW).kind, null);
    assert.equal(decideTrialEmail(row(endsIn(-HOUR)), new Set(["trial_ended"]), NOW).kind, null);
  });
  it("אחרי 'יום לפני' כבר לא שולחים '3 ימים'", () =>
    assert.equal(decideTrialEmail(row(endsIn(2 * DAY)), new Set(["trial_ending_1d"]), NOW).kind, null));
  it("לא למי ששילם", () => assert.equal(decideTrialEmail(row({ first_payment_at: iso(NOW - DAY) }), none, NOW).kind, null));
  it("לא למי שכבר ביקש לשלם", () => assert.equal(decideTrialEmail(row({ open_payment_status: "payment_link_sent" }), none, NOW).kind, null));
  it("לא למנהלים", () => assert.equal(decideTrialEmail(row({ role: "admin" }), none, NOW).kind, null));
  it("ניסיון שהסתיים מזמן (לפני שהפיצ'ר עלה) לא מקבל מייל", () =>
    assert.equal(decideTrialEmail(row(endsIn(-10 * DAY)), none, NOW).kind, null));
});

describe("דוח שבועי", () => {
  const sunday = Date.parse("2026-10-11T06:00:00.000Z");
  it("ניסיון פעיל עם כרטיס מפורסם", () => assert.deepEqual(decideWeeklyReport(row(), none, sunday), { send: true }));
  it("בלי כרטיס מפורסם: לא", () => assert.equal(decideWeeklyReport(row({ published_count: 0 }), none, sunday).send, false));
  it("פעם אחת בשבוע", () => assert.equal(decideWeeklyReport(row(), new Set([weekKey(sunday)]), sunday).send, false));
  it("משלם (לא בניסיון): לא", () =>
    assert.equal(decideWeeklyReport(row({ subscription_status: "active", current_period_end: iso(sunday + 20 * DAY) }), none, sunday).send, false));
});

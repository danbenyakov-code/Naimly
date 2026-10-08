import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contactPhone,
  controlSummary,
  funnelStage,
  planState,
  trialDaysLeft,
  whatsappLink,
  type UserOverviewRow,
} from "../src/lib/user-control.ts";

const NOW = new Date("2026-10-08T09:00:00.000Z").getTime();
const at = (days: number) => new Date(NOW + days * 86400000).toISOString();

function row(overrides: Partial<UserOverviewRow> = {}): UserOverviewRow {
  return {
    user_id: "00000000-0000-0000-0000-000000000001",
    full_name: "רונית כהן",
    email: "ronit@example.com",
    role: "customer",
    created_by_admin: false,
    profile_phone: "",
    signed_up_at: at(-5),
    email_confirmed_at: null,
    last_sign_in_at: null,
    plan_id: "trial",
    subscription_status: "trialing",
    plan_selected_at: null,
    trial_started_at: null,
    trial_ends_at: null,
    current_period_end: at(360),
    admin_locked: false,
    card_count: 0,
    published_count: 0,
    primary_card_slug: null,
    primary_business_name: null,
    primary_card_published: null,
    card_phone: "",
    card_whatsapp: "",
    payment_phone: "",
    open_payment_status: null,
    first_payment_at: null,
    views: 0,
    clicks: 0,
    leads: 0,
    last_activity_type: null,
    last_activity_at: null,
    last_app_visit_at: null,
    ...overrides,
  };
}

const verified = { email_confirmed_at: at(-5) };
const inTrial = { ...verified, plan_selected_at: at(-4), trial_started_at: at(-4), trial_ends_at: at(10), current_period_end: at(10) };

describe("שלב במשפך", () => {
  it("נרשם ולא אימת", () => assert.equal(funnelStage(row(), NOW), "registered"));
  it("אימת ולא בחר מסלול", () => assert.equal(funnelStage(row(verified), NOW), "verified"));
  it("בחר מסלול ואין כרטיס", () => assert.equal(funnelStage(row(inTrial), NOW), "plan_selected"));
  it("יצר כרטיס ולא פרסם", () => assert.equal(funnelStage(row({ ...inTrial, card_count: 1 }), NOW), "card_draft"));
  it("פרסם ואין צפיות", () => assert.equal(funnelStage(row({ ...inTrial, card_count: 1, published_count: 1 }), NOW), "published"));
  it("יש צפיות ואין פניות (גם כשהמספרים מגיעים כמחרוזת מ-bigint)", () =>
    assert.equal(funnelStage(row({ ...inTrial, card_count: 1, published_count: 1, views: "12" }), NOW), "viewed"));
  it("קיבל פנייה", () => assert.equal(funnelStage(row({ ...inTrial, card_count: 1, published_count: 1, views: 3, leads: 1 }), NOW), "lead"));
  it("בקשת תשלום פתוחה גוברת על שלבי הכרטיס", () =>
    assert.equal(funnelStage(row({ ...inTrial, card_count: 1, open_payment_status: "payment_link_sent" }), NOW), "payment_requested"));
  it("משלם", () =>
    assert.equal(funnelStage(row({ ...inTrial, subscription_status: "active", plan_id: "pro", current_period_end: at(20) }), NOW), "paying"));
  it("ניסיון שהסתיים בלי תשלום", () =>
    assert.equal(funnelStage(row({ ...inTrial, card_count: 1, trial_ends_at: at(-1), current_period_end: at(-1) }), NOW), "expired"));
  it("ניסיון שהסתיים אבל יש בקשת תשלום פתוחה: ביקש תשלום", () =>
    assert.equal(funnelStage(row({ ...inTrial, trial_ends_at: at(-1), current_period_end: at(-1), open_payment_status: "pending_admin_review" }), NOW), "payment_requested"));
});

describe("מצב מסלול", () => {
  it("בחר מסלול בתשלום ועוד לא שילם: לא נספר כניסיון", () => {
    const pending = row({ ...verified, plan_selected_at: at(-1), current_period_end: at(360) });
    assert.equal(planState(pending, NOW), "pending_payment");
    assert.equal(trialDaysLeft(pending, NOW), null);
  });
  it("מנוי פעיל שתוקפו עבר: פג תוקף", () =>
    assert.equal(planState(row({ ...inTrial, subscription_status: "active", current_period_end: at(-2) }), NOW), "expired"));
  it("נעילת מנהל גוברת", () => assert.equal(planState(row({ ...inTrial, admin_locked: true }), NOW), "locked"));
  it("ימים שנותרו מעוגלים למעלה", () => assert.equal(trialDaysLeft(row({ ...inTrial, trial_ends_at: at(2.2) }), NOW), 3));
});

describe("טלפון לפנייה", () => {
  it("פרופיל קודם לכרטיס", () =>
    assert.deepEqual(contactPhone(row({ profile_phone: "050-1111111", card_whatsapp: "052-2222222" })), { phone: "050-1111111", source: "profile" }));
  it("בלי פרופיל: וואטסאפ מהכרטיס", () =>
    assert.deepEqual(contactPhone(row({ card_whatsapp: "052-2222222", card_phone: "03-1234567" })), { phone: "052-2222222", source: "card_whatsapp" }));
  it("מספר קצר מדי אינו מספר", () => assert.equal(contactPhone(row({ profile_phone: "123" })), null));
  it("קישור וואטסאפ ממיר 05x לקידומת 972", () => assert.equal(whatsappLink("050-123-4567"), "https://wa.me/972501234567"));
  it("מספר בינלאומי נשמר", () => assert.equal(whatsappLink("+972 50 1234567"), "https://wa.me/972501234567"));
});

describe("מדדי סיכום", () => {
  it("מנהלים וחשבונות בדיקה לא נספרים, וההמרה מניסיון נמדדת רק על ניסיונות שהוכרעו", () => {
    const rows = [
      row({ role: "admin", ...inTrial }),
      // חשבון בדיקה "משלם": מסומן, ולכן אינו נספר באף מדד.
      row({ is_test_account: true, ...inTrial, signed_up_at: at(-1), subscription_status: "active", current_period_end: at(20), first_payment_at: at(-1), published_count: 1, card_count: 1 }),
      row({ ...inTrial, signed_up_at: at(-2), card_count: 1, published_count: 1 }),
      row({ ...inTrial, trial_ends_at: at(1), current_period_end: at(1) }),
      row({ ...inTrial, signed_up_at: at(-30), trial_ends_at: at(-10), current_period_end: at(-10) }),
      row({ ...inTrial, signed_up_at: at(-30), trial_ends_at: at(-10), subscription_status: "active", current_period_end: at(20), first_payment_at: at(-11), published_count: 1, card_count: 1 }),
    ];
    const summary = controlSummary(rows, NOW);
    assert.equal(summary.total, 4);
    assert.equal(summary.signedUpThisWeek, 2);
    assert.equal(summary.activeTrials, 2);
    assert.equal(summary.trialsEndingSoon, 1);
    assert.equal(summary.paying, 1);
    assert.equal(summary.signupToPublishedPercent, 50);
    assert.equal(summary.trialsFinished, 2);
    assert.equal(summary.trialsConverted, 1);
    assert.equal(summary.trialToPaidPercent, 50);
  });
});

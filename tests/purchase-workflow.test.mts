import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PURCHASE_STATUSES,
  buildPriceSnapshot,
  canTransition,
  customerStatusMessage,
  isPurchaseStatus,
  paymentLinkExpiry,
  purchaseStatusLabels,
} from "../src/lib/purchase-workflow.ts";
import { PRICING_VERSION, cycleAmount, plans } from "../src/lib/config.ts";

describe("state machine — מעברי סטטוס מותרים", () => {
  it("pending_admin_review יכול לעבור רק ל-awaiting_payment_link, rejected או cancelled", () => {
    assert.ok(canTransition("pending_admin_review", "awaiting_payment_link"));
    assert.ok(canTransition("pending_admin_review", "rejected"));
    assert.ok(canTransition("pending_admin_review", "cancelled"));
    assert.ok(!canTransition("pending_admin_review", "active"), "אסור לדלג ישירות מבקשה חדשה להפעלה");
    assert.ok(!canTransition("pending_admin_review", "paid_pending_activation"));
  });

  it("אי אפשר להפעיל בלי לעבור דרך paid_pending_activation", () => {
    assert.ok(!canTransition("customer_reported_paid", "active"));
    assert.ok(!canTransition("payment_verification", "active"));
    assert.ok(canTransition("paid_pending_activation", "active"));
  });

  it("סטטוסים סופיים אינם מאפשרים שום מעבר החוצה", () => {
    for (const terminal of ["rejected", "cancelled", "refunded"] as const) {
      for (const target of PURCHASE_STATUSES) {
        if (target === terminal) continue;
        assert.ok(!canTransition(terminal, target), `${terminal} -> ${target} לא אמור להיות מותר`);
      }
    }
  });

  it("expired מאפשר שליחת קישור חדש, לא הפעלה ישירה", () => {
    assert.ok(canTransition("expired", "awaiting_payment_link"));
    assert.ok(!canTransition("expired", "active"));
    assert.ok(!canTransition("expired", "paid_pending_activation"));
  });

  it("מעבר לאותו סטטוס תמיד מותר (idempotent no-op)", () => {
    for (const status of PURCHASE_STATUSES) {
      assert.ok(canTransition(status, status));
    }
  });

  it("active יכול לעבור רק ל-refunded", () => {
    assert.ok(canTransition("active", "refunded"));
    assert.ok(!canTransition("active", "cancelled"));
    assert.ok(!canTransition("active", "rejected"));
  });

  it("כל סטטוס מוגדר גם ב-purchaseStatusLabels וגם ב-customerStatusMessage", () => {
    for (const status of PURCHASE_STATUSES) {
      assert.ok(purchaseStatusLabels[status], `חסרה תווית עברית ל-${status}`);
      assert.ok(customerStatusMessage[status], `חסרה הודעת לקוח ל-${status}`);
    }
  });

  it("isPurchaseStatus דוחה ערכים לא מוכרים (למשל 'pending' הישן)", () => {
    assert.ok(!isPurchaseStatus("pending"));
    assert.ok(!isPurchaseStatus("approved"));
    assert.ok(!isPurchaseStatus(""));
    assert.ok(!isPurchaseStatus(undefined));
    assert.ok(isPurchaseStatus("pending_admin_review"));
  });
});

describe("buildPriceSnapshot — מקור המחיר תמיד מ-config.ts", () => {
  it("snapshot חודשי תואם בדיוק ל-cycleAmount", () => {
    const pro = plans.find((plan) => plan.id === "pro")!;
    const snapshot = buildPriceSnapshot("pro", "monthly");
    assert.equal(snapshot.totalAmount, cycleAmount(pro.price, "monthly"));
    assert.equal(snapshot.totalAmount, pro.price);
    assert.equal(snapshot.discountAmount, 0, "בחיוב חודשי אין הנחה");
    assert.equal(snapshot.planNameSnapshot, pro.name);
    assert.equal(snapshot.cardsIncluded, pro.limits.cards);
    assert.equal(snapshot.pricingVersion, PRICING_VERSION);
  });

  it("snapshot שנתי כולל הנחה חיובית ותואם ל-cycleAmount", () => {
    const premium = plans.find((plan) => plan.id === "premium")!;
    const snapshot = buildPriceSnapshot("premium", "annual");
    assert.equal(snapshot.totalAmount, cycleAmount(premium.price, "annual"));
    assert.equal(snapshot.priceBeforeDiscount, premium.price * 12);
    assert.equal(snapshot.discountAmount, premium.price * 12 - snapshot.totalAmount);
    assert.ok(snapshot.discountAmount > 0, "תשלום שנתי מראש חייב לכלול הנחה");
    assert.equal(snapshot.cardsIncluded, 2);
  });

  it("features_snapshot הוא עותק של הפיצ'רים באותו רגע — שינוי עתידי במחירון לא נוגע ב-snapshot ישן", () => {
    const basic = plans.find((plan) => plan.id === "basic")!;
    const snapshot = buildPriceSnapshot("basic", "monthly");
    assert.deepEqual(snapshot.featuresSnapshot, basic.features);
    snapshot.featuresSnapshot.push("פיצ'ר שהומצא בבדיקה");
    assert.notDeepEqual(basic.features, snapshot.featuresSnapshot, "מוטציה על ה-snapshot לא אמורה לדלוף חזרה למחירון המקורי");
  });

  it("כרטיס נוסף מקבל snapshot משלו, נפרד מהמסלולים", () => {
    const snapshot = buildPriceSnapshot("extra_card", "monthly");
    assert.equal(snapshot.planId, "extra_card");
    assert.equal(snapshot.cardsIncluded, 1);
    assert.equal(snapshot.billingCycle, "monthly", "כרטיס נוסף מתומחר חודשי בלבד, גם אם נשלח מחזור שנתי");
  });

  it("מסלול לא מוכר זורק שגיאה ברורה, לא מחזיר מחיר שרירותי", () => {
    assert.throws(() => buildPriceSnapshot("unknown_plan" as never, "monthly"));
  });
});

describe("paymentLinkExpiry — תוקף קישור תשלום", () => {
  it("מחזיר תאריך עתידי, כברירת מחדל כשבוע קדימה", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiry = new Date(paymentLinkExpiry(now));
    const diffDays = (expiry.getTime() - now.getTime()) / 86400000;
    assert.equal(diffDays, 7);
  });
});

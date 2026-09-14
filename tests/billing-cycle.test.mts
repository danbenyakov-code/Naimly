import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import {
  ANNUAL_DISCOUNT_PERCENT,
  ANNUAL_MONTHS_CHARGED,
  annualPrice,
  annualSaving,
  billingCycleLabel,
  cycleAmount,
  cycleMonths,
  plans,
  toBillingCycle,
} from "../src/lib/config.ts";
import { paymentMessage } from "../src/lib/payments.ts";

const read = (path: string) => fs.readFileSync(path, "utf8");

const viewer = { email: "test@example.com", fullName: "לקוח בדיקה" };
const pro = plans.find((plan) => plan.id === "pro")!;

describe("REQ-010 — חישוב התמחור השנתי", () => {
  it("תשלום על עשרה חודשים, קבלת שנים־עשר", () => {
    assert.equal(ANNUAL_MONTHS_CHARGED, 10);
    assert.equal(annualPrice(49), 490);
    assert.equal(annualSaving(49), 98);
    assert.equal(cycleMonths("annual"), 12);
  });

  it("אחוז ההנחה נגזר מהמספרים ואינו נכתב ידנית", () => {
    /*
     * זו הבדיקה שמונעת את התקלה החמורה בתמחור: מחירון שמבטיח אחוז
     * הנחה שאינו תואם את הסכום שנגבה בפועל. אם מישהו ישנה את מספר
     * החודשים, האחוז חייב לזוז איתו.
     */
    for (const plan of plans.filter((item) => item.price > 0)) {
      const actual = (1 - annualPrice(plan.price) / (plan.price * 12)) * 100;
      assert.equal(Math.round(actual), ANNUAL_DISCOUNT_PERCENT);
    }
  });

  it("cycleAmount מחזיר את הסכום שייגבה בפועל", () => {
    assert.equal(cycleAmount(29, "monthly"), 29);
    assert.equal(cycleAmount(29, "annual"), 290);
    assert.equal(cycleAmount(79, "annual"), 790);
  });

  it("המחיר החודשי בפועל נמוך מהמחיר החודשי הרגיל", () => {
    for (const plan of plans.filter((item) => item.price > 0)) {
      assert.ok(annualPrice(plan.price) / 12 < plan.price);
    }
  });
});

describe("REQ-010 — קלט שאינו אמין", () => {
  it("כל ערך שאינו 'annual' נופל לחודשי", () => {
    // ברירת המחדל היא הזולה: קלט פגום לא יגרור חיוב גבוה מהצפוי.
    assert.equal(toBillingCycle("annual"), "annual");
    assert.equal(toBillingCycle("monthly"), "monthly");
    assert.equal(toBillingCycle("ANNUAL"), "monthly");
    assert.equal(toBillingCycle(undefined), "monthly");
    assert.equal(toBillingCycle(null), "monthly");
    assert.equal(toBillingCycle(12), "monthly");
    assert.equal(toBillingCycle({}), "monthly");
  });
});

describe("REQ-010 — ההודעה ללקוח תואמת לחיוב", () => {
  it("הודעת וואטסאפ שנתית נוקבת בסכום השנתי", () => {
    const message = paymentMessage({ plan: pro, viewer, reference: "PR-ABC123", cycle: "annual" });
    assert.ok(message.includes("490"), message);
    assert.ok(message.includes("לשנה"), message);
    assert.ok(!message.includes("49 ש״ח לחודש"), message);
  });

  it("הודעה חודשית נשארת כשהייתה", () => {
    const message = paymentMessage({ plan: pro, viewer, reference: "PR-ABC123", cycle: "monthly" });
    assert.ok(message.includes("49 ש״ח לחודש"), message);
  });

  it("ללא ציון מחזור — חודשי", () => {
    const message = paymentMessage({ plan: pro, viewer, reference: "PR-ABC123" });
    assert.ok(message.includes("49 ש״ח לחודש"), message);
  });
});

describe("REQ-010 — מחזור החיוב עובר את כל השרשרת", () => {
  it("הסכום הנשמר במסד נגזר בשרת ולא מתקבל מהלקוח", () => {
    const route = read("src/app/api/payments/request/route.ts");
    assert.ok(route.includes("cycleAmount(plan.price, cycle)"), "הסכום חייב להיגזר בשרת");
    assert.ok(route.includes("billing_cycle: cycle"), "מחזור החיוב חייב להישמר ברשומה");
    assert.ok(!route.includes("amount: plan.price"), "אסור לשמור את המחיר החודשי כסכום החיוב");
  });

  it("מספר החודשים באישור נגזר ממחזור החיוב", () => {
    const route = read("src/app/api/admin/payment-requests/[id]/route.ts");
    assert.ok(route.includes("cycleMonths(toBillingCycle(paymentRequest.billing_cycle))"));

    // הלוח לא שולח months קבוע — אחרת הוא היה דורס את הגזירה בשרת.
    const board = read("src/components/admin/approvals-board.tsx");
    assert.ok(!board.includes("{ action, months: 1 }"), "אסור לשלוח months קבוע מהלוח");
  });

  it("מחזור החיוב שורד את ההרשמה בדרך לתשלום", () => {
    assert.ok(read("src/components/auth/auth-form.tsx").includes("cycle=${cycle}"));
    assert.ok(read("src/app/(auth)/actions.ts").includes("cycle=${selectedCycle}"));
    assert.ok(read("src/app/checkout/page.tsx").includes("toBillingCycle(params.cycle)"));
  });

  it("המיגרציה מוסיפה את העמודה עם ברירת מחדל בטוחה", () => {
    const migration = read("supabase/migrations/015_billing_cycle.sql");
    assert.ok(migration.includes("billing_cycle"));
    assert.ok(migration.includes("default 'monthly'"));
    assert.ok(migration.includes("check (billing_cycle in ('monthly', 'annual'))"));
    assert.ok(migration.includes("Rollback"));
  });
});

describe("REQ-010 — גילוי המע״מ", () => {
  /*
   * המסמכים המשפטיים קובעים שהמחירים אינם כוללים מע״מ. מסך שמציג מחיר
   * ושותק בנקודה הזו יוצר פער בין מה שהלקוח ראה למה שייגבה ממנו.
   */
  it("כל מסך שמציג מחיר מציין שהמע״מ יתווסף", () => {
    for (const path of [
      "src/components/marketing/billing-toggle.tsx",
      "src/components/onboarding/plan-choice.tsx",
      "src/app/checkout/page.tsx",
    ]) {
      assert.ok(read(path).includes("מע״מ"), `${path} אינו מציין מע״מ`);
    }
  });

  it("המחירים כוללים מע״מ — באותו נוסח בתקנון ובמחירון", () => {
    /*
     * זו הבדיקה שמונעת את הסתירה המסוכנת ביותר בין מסמך למסך: תקנון
     * שאומר "כולל" ומחירון שאומר "לא כולל". במחלוקת, הנוסח שהלקוח ראה
     * במסך הרכישה הוא שמכריע — ולכן השניים חייבים להיות זהים.
     */
    const terms = read("src/components/legal/documents/terms-body.tsx");
    assert.ok(terms.includes("כל המחירים כוללים מע״מ כדין"), "תנאי השימוש שינו נוסח");
    assert.ok(!terms.includes("אינם כוללים מע״מ"), "נשארה בתקנון הצהרה סותרת");

    const pricing = read("src/components/marketing/billing-toggle.tsx");
    assert.ok(pricing.includes("כל המחירים כוללים מע״מ כדין"));

    // אף מסך שמציג מחיר אינו רשאי לומר את ההפך.
    for (const path of [
      "src/components/marketing/billing-toggle.tsx",
      "src/components/onboarding/plan-choice.tsx",
      "src/app/checkout/page.tsx",
      "src/components/legal/documents/refund-body.tsx",
    ]) {
      assert.ok(!read(path).includes("אינם כוללים מע״מ"), `${path} סותר את התקנון`);
    }
  });
});

describe("REQ-010 — תוויות מחזור החיוב", () => {
  it("לכל מחזור יש תיאור בעברית", () => {
    assert.equal(billingCycleLabel.monthly, "חיוב חודשי מתחדש");
    assert.equal(billingCycleLabel.annual, "תשלום שנתי מראש");
  });
});

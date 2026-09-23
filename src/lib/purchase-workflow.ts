import { type BillingCycle, EXTRA_CARD_PRICE, PRICING_VERSION, cycleAmount, cycleMonths, extraCardProduct, isExtraCard, plans } from "@/lib/config";
import type { PlanId } from "@/lib/types";

/**
 * State machine של תהליך רכישה ותשלום ידני.
 *
 * מקור אמת כפול בכוונה: אותם מעברים נאכפים גם כאן (לצורך ה-UI ובדיקות
 * מהירות בקוד) וגם ב-trigger בפוסטגרס (migration 029). קריאת API
 * ישירה שמנסה לעקוף את מה שכתוב כאן עדיין נחסמת בשרת — זו לא ההגנה
 * האמיתית, רק שכבה ראשונה שנותנת משוב מהיר וברור.
 */
export const PURCHASE_STATUSES = [
  "pending_admin_review",
  "awaiting_payment_link",
  "payment_link_sent",
  "customer_reported_paid",
  "payment_verification",
  "paid_pending_activation",
  "active",
  "rejected",
  "cancelled",
  "expired",
  "refunded",
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export function isPurchaseStatus(value: unknown): value is PurchaseStatus {
  return typeof value === "string" && (PURCHASE_STATUSES as readonly string[]).includes(value);
}

const ALLOWED_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  pending_admin_review: ["awaiting_payment_link", "rejected", "cancelled"],
  awaiting_payment_link: ["payment_link_sent", "rejected", "cancelled"],
  payment_link_sent: ["customer_reported_paid", "expired", "cancelled"],
  customer_reported_paid: ["payment_verification", "cancelled"],
  payment_verification: ["paid_pending_activation", "payment_link_sent", "rejected", "cancelled"],
  paid_pending_activation: ["active", "cancelled"],
  active: ["refunded"],
  rejected: [],
  cancelled: [],
  expired: ["awaiting_payment_link", "cancelled"],
  refunded: [],
};

export function canTransition(from: PurchaseStatus, to: PurchaseStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** תוויות בעברית לתצוגה — בדשבורד האדמין ובמסך "ההזמנה שלי". */
export const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  pending_admin_review: "ממתין לבדיקת מנהל",
  awaiting_payment_link: "אושר עקרונית — ממתין לשליחת קישור",
  payment_link_sent: "קישור תשלום נשלח",
  customer_reported_paid: "הלקוח דיווח על תשלום",
  payment_verification: "התשלום בבדיקה",
  paid_pending_activation: "תשלום אומת — ממתין להפעלה",
  active: "פעיל",
  rejected: "נדחה",
  cancelled: "בוטל",
  expired: "פג תוקף",
  refunded: "הוחזר",
};

/** הטקסט המדויק שהלקוח רואה במסך "ההזמנה שלי", לפי סטטוס. */
export const customerStatusMessage: Record<PurchaseStatus, string> = {
  pending_admin_review:
    "בקשת הרכישה התקבלה בהצלחה. אנחנו בודקים את הפרטים ונשלח אליך קישור לתשלום בהקדם. בשלב זה החבילה עדיין אינה פעילה.",
  awaiting_payment_link:
    "הבקשה אושרה עקרונית. אנחנו מכינים עבורך קישור תשלום — הוא יישלח בהקדם.",
  payment_link_sent:
    "קישור התשלום מוכן. לאחר ביצוע התשלום ניתן ללחוץ על ‘שילמתי’ כדי להעביר את העסקה לבדיקה. החבילה תופעל לאחר אימות התשלום.",
  customer_reported_paid:
    "קיבלנו את הדיווח שלך והתשלום נמצא בבדיקה. תהליך האימות צפוי להימשך מספר רגעים. נעדכן אותך במייל מיד לאחר הפעלת החבילה.",
  payment_verification:
    "קיבלנו את הדיווח שלך והתשלום נמצא בבדיקה. תהליך האימות צפוי להימשך מספר רגעים. נעדכן אותך במייל מיד לאחר הפעלת החבילה.",
  paid_pending_activation:
    "התשלום אומת. החבילה בתהליך הפעלה ותהיה זמינה בחשבונך בקרוב.",
  active:
    "התשלום אושר והחבילה הופעלה בהצלחה. ניתן להתחיל להשתמש בכל היכולות הכלולות בחבילה.",
  rejected:
    "בקשת הרכישה נדחתה. לפרטים נוספים אפשר לפנות לתמיכה.",
  cancelled:
    "בקשת הרכישה בוטלה.",
  expired:
    "קישור התשלום פג תוקף. יש לפנות לתמיכה או להמתין לקישור חדש.",
  refunded:
    "בוצע החזר עבור העסקה הזו.",
};

export type PriceSnapshot = {
  planId: PlanId | "extra_card";
  planNameSnapshot: string;
  billingCycle: BillingCycle;
  priceBeforeDiscount: number;
  discountAmount: number;
  totalAmount: number;
  currency: "ILS";
  vatIncluded: true;
  cardsIncluded: number;
  featuresSnapshot: string[];
  pricingVersion: string;
};

/**
 * גזירת ה-snapshot המלא של הזמנה מהמחירון המרכזי (config.ts) — פעם
 * אחת, ברגע היצירה. שום מקום אחר (מייל, מסך אדמין, מסך לקוח, קישור
 * תשלום) לא מחשב את המחיר בעצמו — כולם קוראים לשדות ששמורים כאן.
 */
export function buildPriceSnapshot(planId: PlanId | "extra_card", cycle: BillingCycle): PriceSnapshot {
  if (isExtraCard(planId)) {
    return {
      planId: "extra_card",
      planNameSnapshot: extraCardProduct.name,
      billingCycle: "monthly",
      priceBeforeDiscount: EXTRA_CARD_PRICE,
      discountAmount: 0,
      totalAmount: EXTRA_CARD_PRICE,
      currency: "ILS",
      vatIncluded: true,
      cardsIncluded: 1,
      // עותק, לא הפניה — snapshot לא אמור לזוז אם המחירון ישתנה בהמשך.
      featuresSnapshot: [...extraCardProduct.features],
      pricingVersion: PRICING_VERSION,
    };
  }

  const plan = plans.find((item) => item.id === planId);
  if (!plan) throw new Error(`מסלול לא מוכר: ${planId}`);

  const monthlyTotal = plan.price * (cycle === "annual" ? 12 : 1);
  const total = cycleAmount(plan.price, cycle);
  const discount = Math.max(0, monthlyTotal - total);

  return {
    planId: plan.id,
    planNameSnapshot: plan.name,
    billingCycle: cycle,
    priceBeforeDiscount: monthlyTotal,
    discountAmount: discount,
    totalAmount: total,
    currency: "ILS",
    vatIncluded: true,
    cardsIncluded: plan.limits.cards,
    featuresSnapshot: [...plan.features],
    pricingVersion: PRICING_VERSION,
  };
}

/** חודשי ההפעלה בפועל למחזור החיוב שנשמר בבקשה. */
export function purchaseRequestMonths(cycle: BillingCycle): number {
  return cycleMonths(cycle);
}

/** תוקף ברירת מחדל לקישור תשלום — 7 ימים מרגע השליחה. */
export const PAYMENT_LINK_VALIDITY_DAYS = 7;

export function paymentLinkExpiry(from = new Date()): string {
  return new Date(from.getTime() + PAYMENT_LINK_VALIDITY_DAYS * 86400000).toISOString();
}

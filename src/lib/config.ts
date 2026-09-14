import type { Plan } from "@/lib/types";

/**
 * מספר הוואטסאפ של העסק, בפורמט בינלאומי.
 * ניתן לדריסה במשתני סביבה לכל סביבה בנפרד.
 */
const DEFAULT_WHATSAPP = "972552951664";

export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "NAIMLY",
  hebrewName: process.env.NEXT_PUBLIC_BRAND_HEBREW_NAME || "נעיםלי",
  shortName: process.env.NEXT_PUBLIC_BRAND_SHORT_NAME || "N",
  tagline: "נעים להכיר. קל לסגור.",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "info.naimly@gmail.com",
  supportWhatsapp: (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || DEFAULT_WHATSAPP).replace(/\D/g, ""),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://naimly.co.il",
};

/**
 * תשלום בפועל מתבצע בביט, מול המספר הזה, דרך שיחת וואטסאפ.
 * המספר בפורמט בינלאומי ללא סימנים: 9725XXXXXXXX.
 */
export const billing = {
  whatsappNumber: (process.env.NEXT_PUBLIC_BILLING_WHATSAPP || process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || DEFAULT_WHATSAPP).replace(/\D/g, ""),
  bitPhone: process.env.NEXT_PUBLIC_BIT_PHONE || "055-295-1664",
  bitDisplayName: process.env.NEXT_PUBLIC_BIT_NAME || process.env.NEXT_PUBLIC_BRAND_NAME || "NAIMLY",
};

export const isBillingConfigured = Boolean(billing.whatsappNumber);

/** הכתובת שאליה מגיעות התראות מערכת (בקשות תשלום, פניות). */
export const adminNotificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL || brand.supportEmail;

// המחירים מרוכזים כאן כדי שניתן יהיה לעדכן אותם לפני ההשקה ללא שינוי במסכים.
/**
 * תמחור שנתי.
 *
 * REQ-010: הנוהג המקובל ב-SaaS הוא "חודשיים מתנה" — תשלום על עשרה
 * חודשים מראש. זה מסר שקל להבין, בניגוד לאחוז הנחה שדורש חישוב, והוא
 * לא נראה כמו מבצע נואש.
 *
 * החיסכון מחושב מהמחירים בפועל ולא נקבע ידנית, כדי שלא ייווצר מצב שבו
 * המחירון מבטיח הנחה שאינה תואמת את מה שנגבה.
 */
export const ANNUAL_MONTHS_CHARGED = 10;

export function annualPrice(monthly: number) {
  return monthly * ANNUAL_MONTHS_CHARGED;
}

export function annualSaving(monthly: number) {
  return monthly * 12 - annualPrice(monthly);
}

/** אחוז ההנחה, מעוגל. נגזר מהמספרים ולא נכתב ידנית. */
export const ANNUAL_DISCOUNT_PERCENT = Math.round((1 - ANNUAL_MONTHS_CHARGED / 12) * 100);

export type BillingCycle = "monthly" | "annual";

/** מספר החודשים שמופעלים בפועל לכל מחזור חיוב. */
export const ANNUAL_MONTHS_GRANTED = 12;

export function cycleMonths(cycle: BillingCycle) {
  return cycle === "annual" ? ANNUAL_MONTHS_GRANTED : 1;
}

/**
 * הסכום שייגבה בפועל עבור מסלול ומחזור חיוב.
 *
 * כל מסך שמציג מחיר וכל נתיב שגובה אותו קוראים לפונקציה הזו. אילו כל
 * אחד היה מחשב בעצמו, מסך אחד היה מציג סכום אחד והשרת היה רושם אחר.
 */
export function cycleAmount(monthly: number, cycle: BillingCycle) {
  return cycle === "annual" ? annualPrice(monthly) : monthly;
}

/** קריאת מחזור חיוב מקלט שאינו אמין (query string, גוף בקשה). */
export function toBillingCycle(value: unknown): BillingCycle {
  return value === "annual" ? "annual" : "monthly";
}

/** תיאור מחזור החיוב בעברית — למסכים, להודעות ולמיילים. */
export const billingCycleLabel: Record<BillingCycle, string> = {
  monthly: "חיוב חודשי מתחדש",
  annual: "תשלום שנתי מראש",
};

export const plans: Plan[] = [
  {
    id: "trial",
    name: "התנסות",
    price: 0,
    interval: "month",
    description: "14 יום עם כל היכולות פתוחות, בלי כרטיס אשראי.",
    features: [
      "כל היכולות של פרימיום פתוחות",
      "9 פעולות מהירות ועד 100 תמונות",
      "Meta Pixel, Google Analytics ו‑SEO מתקדם",
      "קבצים, קרוסלה, וידאו וייצוא לידים",
      "בסיום בוחרים מסלול — והכרטיס ממשיך",
    ],
    limits: { cards: 1, galleryItems: 100, analyticsDays: 730, quickActions: 9, tracking: true, files: 100 },
  },
  {
    id: "basic",
    name: "בסיסי",
    price: 29,
    interval: "month",
    description: "לבעלי עסקים שרוצים נוכחות מקצועית.",
    features: ["כרטיס דיגיטלי מלא", "3 פעולות מהירות", "גלריה, שירותים וטופס פניות", "כפתורים חכמים וסרטון", "נתונים ל‑30 ימים"],
    limits: { cards: 1, galleryItems: 10, analyticsDays: 30, quickActions: 3, tracking: false, files: 0 },
  },
  {
    id: "pro",
    name: "מקצועי",
    price: 49,
    interval: "month",
    description: "לעסק שרוצה להפוך צפיות ללקוחות.",
    badge: "הבחירה הפופולרית",
    features: ["כל מה שבבסיסי", "6 פעולות מהירות", "קרוסלה, קבצים וכל הווידג׳טים", "Meta Pixel ו‑Google Analytics", "SEO מתקדם ונתונים לשנה", "עד 30 תמונות"],
    limits: { cards: 1, galleryItems: 30, analyticsDays: 365, quickActions: 6, tracking: true, files: 10 },
  },
  {
    id: "premium",
    name: "פרימיום",
    price: 79,
    interval: "month",
    description: "לעסקים שרוצים יותר מידע, מדיה ושירות.",
    features: ["כל מה שבמקצועי", "9 פעולות מהירות", "עד 100 תמונות", "נתונים לשנתיים", "ייצוא לידים ל‑CSV", "תמיכה מועדפת"],
    limits: { cards: 1, galleryItems: 100, analyticsDays: 730, quickActions: 9, tracking: true, files: 30 },
  },
];

export const marketingNav = [
  { label: "איך זה עובד", href: "/#how-it-works" },
  { label: "דוגמה חיה", href: "/noa-design" },
  { label: "מחירים", href: "/pricing" },
  { label: "שאלות נפוצות", href: "/#faq" },
  { label: "צרו קשר", href: "/contact" },
];

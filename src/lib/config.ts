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
    description: "כל היכולות של פרימיום פתוחות, בלי כרטיס אשראי.",
    features: [
      "כל מה שכלול בפרימיום, פתוח מהרגע הראשון",
      "24 תמונות, 9 פעולות מהירות ו‑2 סרטונים",
      "Google Analytics, Meta Pixel ו‑SEO מתקדם",
      "קבצים להורדה וייצוא הפניות ל‑Excel",
      "בסיום בוחרים מסלול — והכרטיס שבנית נשאר",
    ],
    limits: { cards: 1, galleryItems: 24, analyticsDays: 730, quickActions: 9, tracking: true, files: 10, videos: 2 },
  },
  {
    id: "basic",
    name: "בסיסי",
    price: 29,
    interval: "month",
    description: "במקום כרטיס ביקור מודפס — קישור אחד שתמיד מעודכן.",
    features: [
      "כרטיס דיגיטלי מלא עם קישור אישי וקוד QR",
      "3 פעולות מהירות: חיוג, וואטסאפ וניווט",
      "6 תמונות בגלריה",
      "טופס פניות שמגיע ישירות למייל שלך",
      "המלצות לקוחות וכפתורי פעולה חכמים",
      "דוח צפיות ולחיצות ל‑30 הימים האחרונים",
    ],
    limits: { cards: 1, galleryItems: 6, analyticsDays: 30, quickActions: 3, tracking: false, files: 0, videos: 0 },
  },
  {
    id: "pro",
    name: "מקצועי",
    price: 49,
    interval: "month",
    badge: "הבחירה הפופולרית",
    description: "לעסק שרוצה שהכרטיס יביא פניות, לא רק ייראה טוב.",
    features: [
      "כל מה שבבסיסי, ובנוסף:",
      "6 פעולות מהירות ו‑12 תמונות בגלריה",
      "סרטון תדמית וגלריית קרוסלה",
      "3 קבצים להורדה — מחירון, תפריט או קטלוג",
      "Google Analytics, Tag Manager ו‑Meta Pixel",
      "SEO מתקדם: אזור שירות ותמונת שיתוף מותאמת",
      "היסטוריית נתונים לשנה שלמה",
    ],
    limits: { cards: 1, galleryItems: 12, analyticsDays: 365, quickActions: 6, tracking: true, files: 3, videos: 1 },
  },
  {
    id: "premium",
    name: "פרימיום",
    price: 79,
    interval: "month",
    description: "שני כרטיסים תחת חשבון אחד, וכל הנתונים שמאחורי ההחלטות.",
    features: [
      "כל מה שבמקצועי, ובנוסף:",
      "2 כרטיסים בחשבון אחד — למשל עסק ומותג משני",
      "9 פעולות מהירות ו‑24 תמונות בגלריה",
      "2 סרטונים ו‑10 קבצים להורדה",
      "ייצוא כל הפניות לקובץ Excel",
      "היסטוריית נתונים לשנתיים אחורה",
    ],
    limits: { cards: 2, galleryItems: 24, analyticsDays: 730, quickActions: 9, tracking: true, files: 10, videos: 2 },
  },
];

/**
 * מחיר כרטיס נוסף, לחודש (REQ-011).
 *
 * מתומחר כמו מסלול בסיסי: כרטיס שני הוא כרטיס מלא לכל דבר, ותמחור
 * נמוך ממנו היה הופך אותו לדרך זולה לעקוף את המסלול.
 */
export const EXTRA_CARD_PRICE = 29;

/**
 * "כרטיס נוסף" כפריט לרכישה.
 *
 * אינו מסלול ואינו מופיע ב-plans — לקוח לא אמור לראות אותו בעמוד
 * המחירים כאילו היה חלופה למסלול. הוא עובר באותו צינור תשלום כדי לא
 * להכפיל את הלוגיקה ואת מקומות הכשל.
 */
export const extraCardProduct = {
  id: "extra_card" as const,
  name: "כרטיס נוסף",
  price: EXTRA_CARD_PRICE,
  description: "כרטיס דיגיטלי נוסף תחת אותו חשבון, עם כתובת, QR ופניות משלו.",
  features: [
    "כרטיס מלא נוסף עם כתובת וקוד QR משלו",
    "פניות ונתונים נפרדים לכל כרטיס",
    "מעבר בין הכרטיסים מכל מסך באזור האישי",
    "מכסות התוכן נגזרות מהמסלול שלך",
  ],
};

export function isExtraCard(value: unknown): boolean {
  return value === extraCardProduct.id;
}

export const marketingNav = [
  { label: "איך זה עובד", href: "/#how-it-works" },
  { label: "דוגמה חיה", href: "/noa-design" },
  { label: "מחירים", href: "/pricing" },
  { label: "שאלות נפוצות", href: "/#faq" },
  { label: "צרו קשר", href: "/contact" },
];

/**
 * תמונת השיתוף הגלובלית.
 *
 * QA-011: תמונת opengraph-image לפי קונבנציית הקבצים חלה על מקטע הנתיב
 * בלבד, ועמוד שמגדיר openGraph משלו דורס אותה יחד עם התמונה. לכן היא
 * מוגדרת כאן במפורש ומשותפת לכל עמוד — אחרת שיתוף של עמוד המחירים יוצא
 * בלי תמונה בכלל.
 */
export const ogImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${brand.name} — ${brand.tagline}`,
};

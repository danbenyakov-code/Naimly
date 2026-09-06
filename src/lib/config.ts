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
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "hello@naimly.co.il",
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

// המחירים מרוכזים כאן כדי שניתן יהיה לעדכן אותם לפני ההשקה ללא שינוי במסכים.
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
    limits: { cards: 1, galleryItems: 100, analyticsDays: 730, quickActions: 9, tracking: true },
  },
  {
    id: "basic",
    name: "בסיסי",
    price: 29,
    interval: "month",
    description: "לבעלי עסקים שרוצים נוכחות מקצועית.",
    features: ["כרטיס דיגיטלי מלא", "3 פעולות מהירות", "גלריה, שירותים וטופס פניות", "כפתורים חכמים וסרטון", "נתונים ל‑30 ימים"],
    limits: { cards: 1, galleryItems: 10, analyticsDays: 30, quickActions: 3, tracking: false },
  },
  {
    id: "pro",
    name: "מקצועי",
    price: 49,
    interval: "month",
    description: "לעסק שרוצה להפוך צפיות ללקוחות.",
    badge: "הבחירה הפופולרית",
    features: ["כל מה שבבסיסי", "6 פעולות מהירות", "קרוסלה, קבצים וכל הווידג׳טים", "Meta Pixel ו‑Google Analytics", "SEO מתקדם ונתונים לשנה", "עד 30 תמונות"],
    limits: { cards: 1, galleryItems: 30, analyticsDays: 365, quickActions: 6, tracking: true },
  },
  {
    id: "premium",
    name: "פרימיום",
    price: 79,
    interval: "month",
    description: "לעסקים שרוצים יותר מידע, מדיה ושירות.",
    features: ["כל מה שבמקצועי", "9 פעולות מהירות", "עד 100 תמונות", "נתונים לשנתיים", "ייצוא לידים ל‑CSV", "תמיכה מועדפת"],
    limits: { cards: 1, galleryItems: 100, analyticsDays: 730, quickActions: 9, tracking: true },
  },
];

export const marketingNav = [
  { label: "איך זה עובד", href: "/#how-it-works" },
  { label: "דוגמה חיה", href: "/noa-design" },
  { label: "מחירים", href: "/pricing" },
  { label: "שאלות נפוצות", href: "/#faq" },
  { label: "צרו קשר", href: "/contact" },
];

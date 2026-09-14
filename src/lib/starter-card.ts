import type { CardData, Viewer } from "@/lib/types";
import { resolveAccess } from "@/lib/plan-access";

/**
 * כרטיס פתיחה למשתמש חדש — ריק, ושייך לו בלבד.
 *
 * QA-015/QA-016: עד כה הפונקציה עשתה `...demoCard` ודרסה רק מעט שדות,
 * ולכן כל חשבון חדש נפתח עם הטלפון, הוואטסאפ, הכתובת, ה-SEO, ה-alt
 * והפעולות של NOA Studio — כולל example.com ו-cal.com. מד המוכנות הציג
 * 100% כי כל השדות היו מלאים בנתונים של עסק אחר.
 *
 * מאז שכרטיס ההדגמה קיבל תמונות אמיתיות, ההורשה גם שתלה דיוקן של אדם
 * מזוהה בכרטיס של כל לקוח חדש — שימוש בדמות ללא הסכמה.
 *
 * הכרטיס נבנה עכשיו מאפס. המכסות עדיין נגזרות מהמסלול, אחרת השמירה
 * הראשונה הייתה נחסמת על ידי אכיפת המסלול בשרת ובמסד.
 */
export function starterCard(viewer: Viewer): CardData {
  const access = resolveAccess(viewer);
  const limits = access.limits;

  const ownerName = viewer.fullName?.trim() || "";

  return {
    id: "",
    userId: viewer.id,
    slug: `card-${viewer.id.slice(0, 6)}`,
    businessName: "",
    ownerName,
    roleTitle: "",
    slogan: "",
    bio: "",
    ctaLabel: "",
    phone: "",
    whatsapp: "",
    email: viewer.email || "",
    website: "",
    address: "",
    avatarUrl: "",
    coverUrl: "",
    logoUrl: "",
    logoShape: "rounded",
    videoUrl: "",
    gallery: [],
    files: [],
    primaryColor: "#6d4aff",
    accentColor: "#14d9c4",
    buttonColor: "#6d4aff",
    headingColor: "#111b3b",
    bodyTextColor: "#4a5871",
    backgroundPreset: "aurora",
    template: "spotlight",
    isPublished: false,
    allowIndexing: true,
    // SEO ו-alt נשארים ריקים במכוון. ערך שנגזר מעסק אחר גרוע מערך חסר:
    // הוא נראה תקין, עובר את מד המוכנות, ומתפרסם בלי שאיש שם לב.
    seoTitle: "",
    seoDescription: "",
    socialImageUrl: "",
    areaServed: "",
    coverAlt: "",
    logoAlt: "",
    avatarAlt: "",
    socialLinks: [],
    quickActions: [],
    quickActionsLimit: Math.min(3, limits.quickActions) as CardData["quickActionsLimit"],
    smartButtons: [],
    widgets: starterWidgets(access.features),
    contactFormTitle: "נשמח לשמוע ממך",
    contactFormSuccessMessage: "קיבלנו את הפנייה ונחזור אליך בהקדם.",
    contactFormFields: [
      { id: "name", label: "שם מלא", type: "text", required: true },
      { id: "phone", label: "טלפון", type: "tel", required: true },
      { id: "email", label: "אימייל", type: "email", required: false },
      { id: "message", label: "במה נוכל לעזור?", type: "textarea", required: false },
    ],
    galleryStyle: "grid",
    tracking: { googleAnalyticsId: "", googleTagManagerId: "", metaPixelId: "" },
    // ה-vCard נשאר ריק; הוא מתמלא מפרטי הכרטיס בעת הבנייה (QA-027).
    vcard: {
      fullName: "", firstName: "", lastName: "", organization: "", title: "",
      phone: "", phoneSecondary: "", email: "", website: "", address: "", note: "",
      includePhoto: false,
    },
    cardAddress: { country: "ישראל", city: "", street: "", houseNumber: "", postalCode: "", latitude: "", longitude: "", note: "" },
    services: [],
    testimonials: [],
    businessHours: [],
    updatedAt: new Date().toISOString(),
  };
}

/** הווידג׳טים שמופעלים כברירת מחדל, בכפוף ליכולות המסלול. */
function starterWidgets(features: ReturnType<typeof resolveAccess>["features"]): CardData["widgets"] {
  const all: CardData["widgets"] = [
    { id: "w-actions", type: "smart_buttons", title: "פעולות", enabled: false },
    { id: "w-services", type: "services", title: "השירותים שלי", enabled: true },
    { id: "w-gallery", type: "gallery", title: "גלריה", enabled: true },
    { id: "w-video", type: "video", title: "סרטון", enabled: false },
    { id: "w-testimonials", type: "testimonials", title: "המלצות", enabled: false },
    { id: "w-hours", type: "hours", title: "שעות פעילות", enabled: false },
    { id: "w-files", type: "files", title: "קבצים להורדה", enabled: false },
    { id: "w-contact", type: "contact_form", title: "נשמח לשמוע ממך", enabled: true },
  ];
  return all.map((widget) =>
    (widget.type === "video" && !features.video) || (widget.type === "files" && !features.files)
      ? { ...widget, enabled: false }
      : widget,
  );
}

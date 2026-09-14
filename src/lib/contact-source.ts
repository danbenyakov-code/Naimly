import type { CardData, QuickAction, VCardSettings } from "@/lib/types";

/**
 * מקור אמת יחיד לפרטי ההתקשרות של הכרטיס.
 *
 * QA-024: הפעולות המהירות, ה-vCard והכפתורים החזיקו כל אחד עותק משלו
 * של הטלפון, הוואטסאפ, המייל והכתובת. שינוי בלשונית "תוכן" לא הגיע
 * אליהם, ולכן הכרטיס הציג מספרים ישנים אחרי עריכה.
 *
 * QA-025: `wa.me` מחייב E.164 בלי סימן פלוס. מספר ישראלי שהוזן כ-
 * 050-123-4567 הפך ל-wa.me/0501234567 — קישור שנראה תקין ולא נפתח.
 */

/** קידומת בינלאומית ברירת מחדל. */
export const DEFAULT_COUNTRY_CODE = "972";

/**
 * נרמול מספר לפורמט E.164 בלי הפלוס, כפי ש-wa.me דורש.
 *
 * מחזיר "" כשהמספר אינו ניתן לנרמול — כדי שלא ייווצר קישור שבור.
 */
export function toE164(value: string, countryCode = DEFAULT_COUNTRY_CODE): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // תווי עיצוב נפוצים: מקפים, רווחים, סוגריים ונקודות.
  let digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return "";

  // 00 בתחילת מספר הוא הצורה הבינלאומית הישנה של +.
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;

  if (digits.startsWith("+")) {
    const international = digits.slice(1).replace(/\D/g, "");
    return international.length >= 8 && international.length <= 15 ? international : "";
  }

  digits = digits.replace(/\D/g, "");

  // כבר בפורמט בינלאומי של אותה מדינה.
  if (digits.startsWith(countryCode) && digits.length >= countryCode.length + 8) return digits;

  // מספר מקומי: האפס המוביל מוחלף בקידומת המדינה.
  if (digits.startsWith("0")) {
    const local = digits.slice(1);
    return local.length >= 8 && local.length <= 11 ? `${countryCode}${local}` : "";
  }

  // מספר בלי אפס מוביל ובלי קידומת — מניחים מקומי.
  if (digits.length >= 8 && digits.length <= 10) return `${countryCode}${digits}`;

  return "";
}

/** תצוגה קריאה למספר ישראלי: 050-123-4567. */
export function formatIsraeliPhone(value: string): string {
  const e164 = toE164(value);
  if (!e164.startsWith(DEFAULT_COUNTRY_CODE)) return value;
  const local = `0${e164.slice(DEFAULT_COUNTRY_CODE.length)}`;
  if (local.length === 10) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  if (local.length === 9) return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
  return local;
}

/** קישור WhatsApp תקין, או "" כשאין מספר שניתן לנרמל. */
export function whatsappLink(value: string, message?: string): string {
  const phone = toE164(value);
  if (!phone) return "";
  return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// רשתות חברתיות
// ─────────────────────────────────────────────────────────────────────────────

/**
 * QA-026: הזנת שם משתמש יצרה קישור `#` בלי שום הודעה. עכשיו שם משתמש
 * נבנה לכתובת מלאה, וכתובת מלאה מתקבלת כמות שהיא.
 */
const socialBases: Record<string, string> = {
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  linkedin: "https://linkedin.com/in/",
  tiktok: "https://tiktok.com/@",
  youtube: "https://youtube.com/@",
  x: "https://x.com/",
  threads: "https://threads.net/@",
};

export const socialNetworks = Object.keys(socialBases);

/** האם הערך נראה ככתובת מלאה ולא כשם משתמש. */
function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value) || /^[a-z0-9-]+\.[a-z]{2,}\//i.test(value);
}

/**
 * בונה כתובת מלאה לרשת חברתית משם משתמש או מכתובת.
 * מחזיר "" כשאי אפשר — עדיף פעולה שלא מוצגת מקישור `#`.
 */
export function socialUrl(network: string, value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const base = socialBases[network];
  if (!base) return looksLikeUrl(raw) ? (raw.startsWith("http") ? raw : `https://${raw}`) : "";

  if (looksLikeUrl(raw)) return raw.startsWith("http") ? raw : `https://${raw}`;

  // שם משתמש: מסירים @ מוביל ותווים שאינם חוקיים בשם.
  const handle = raw.replace(/^@+/, "").replace(/[^\w.\-]/g, "");
  return handle ? `${base}${handle}` : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// גזירת פעולות ו-vCard מפרטי הכרטיס
// ─────────────────────────────────────────────────────────────────────────────

type ContactFields = Pick<CardData, "phone" | "whatsapp" | "email" | "website" | "address" | "ownerName" | "businessName" | "roleTitle">;

/**
 * הערך האפקטיבי של פעולה: מה שהוגדר ידנית, ואם ריק — מפרטי הכרטיס.
 *
 * זו הנקודה שפתרה את QA-024. הפעולה אינה מחזיקה עותק; היא נגזרת.
 */
export function resolveActionValue(action: Pick<QuickAction, "type" | "value">, card: ContactFields): string {
  const manual = String(action.value || "").trim();
  if (manual) return manual;

  switch (action.type) {
    case "phone": return card.phone || "";
    case "whatsapp": return card.whatsapp || card.phone || "";
    case "email": return card.email || "";
    case "website": return card.website || "";
    case "waze":
    case "google_maps": return card.address || "";
    default: return "";
  }
}

/** האם לפעולה יש יעד תקין. פעולה בלי יעד לא תוצג. */
export function isActionUsable(action: Pick<QuickAction, "type" | "value">, card: ContactFields): boolean {
  if (action.type === "save_contact") return true;
  const value = resolveActionValue(action, card);
  if (!value) return false;
  if (action.type === "whatsapp") return Boolean(toE164(value));
  if (socialBases[action.type]) return Boolean(socialUrl(action.type, value));
  return true;
}

/** הפעולות שיוצגו בפועל בכרטיס הציבורי. */
export function usableActions(card: CardData): QuickAction[] {
  return card.quickActions.filter((action) => isActionUsable(action, card));
}

/**
 * vCard שנגזר מפרטי הכרטיס.
 *
 * QA-027: ה-vCard החזיק ערכים משלו שלא התעדכנו, ולכן הציג שם של עסק
 * אחר ושדות ריקים אף שבכרטיס היו ערכים. ערך שהוגדר ידנית מנצח; ריק
 * נגזר מהכרטיס.
 */
export function resolveVCard(card: CardData): VCardSettings {
  const manual = card.vcard;
  const nameParts = (card.ownerName || "").trim().split(/\s+/);

  const pick = (value: string, fallback: string) => (String(value || "").trim() || fallback);

  return {
    ...manual,
    fullName: pick(manual.fullName, card.ownerName || ""),
    firstName: pick(manual.firstName, nameParts[0] || ""),
    lastName: pick(manual.lastName, nameParts.slice(1).join(" ")),
    organization: pick(manual.organization, card.businessName || ""),
    title: pick(manual.title, card.roleTitle || ""),
    phone: pick(manual.phone, card.phone || card.whatsapp || ""),
    email: pick(manual.email, card.email || ""),
    website: pick(manual.website, card.website || ""),
    address: pick(manual.address, card.address || ""),
  };
}

/** מה חסר ל-vCard כדי שיהיה שימושי. משמש אזהרה לפני פרסום. */
export function missingVCardFields(card: CardData): string[] {
  const vcard = resolveVCard(card);
  const missing: string[] = [];
  if (!vcard.fullName.trim() && !vcard.firstName.trim()) missing.push("שם");
  if (!vcard.phone.trim()) missing.push("טלפון");
  if (!vcard.email.trim()) missing.push("אימייל");
  return missing;
}

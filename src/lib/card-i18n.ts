/**
 * מילון הכרטיס הציבורי (QA-035 / REQ-025).
 *
 * השפה נבחרת ברמת הכרטיס ולא ברמת המשתמש: מי שמנהל את המערכת בעברית
 * עשוי לפרסם כרטיס באנגלית, ולהפך.
 *
 * המילון מכסה רק את מה שהמערכת כותבת — תוויות, הודעות ומצבי טופס.
 * התוכן שבעל הכרטיס הזין נשאר כפי שהוא: תרגום אוטומטי של שם עסק או
 * תיאור שירות היה משנה את המסר שלו בלי רשות.
 */

export type CardLanguage = "he" | "en";

export const cardLanguages: Array<{ id: CardLanguage; label: string; nativeLabel: string; dir: "rtl" | "ltr" }> = [
  { id: "he", label: "עברית", nativeLabel: "עברית", dir: "rtl" },
  { id: "en", label: "אנגלית", nativeLabel: "English", dir: "ltr" },
];

/** קריאת שפה מקלט שאינו אמין. */
export function toCardLanguage(value: unknown): CardLanguage {
  return value === "en" ? "en" : "he";
}

/** כיוון הכתיבה של השפה. */
export function cardDir(language: CardLanguage): "rtl" | "ltr" {
  return language === "en" ? "ltr" : "rtl";
}

/** קוד השפה לתגי HTML ול-SEO. */
export function cardLocale(language: CardLanguage): string {
  return language === "en" ? "en_US" : "he_IL";
}

export type CardStrings = {
  qr: string;
  qrAria: string;
  share: string;
  shareAria: string;
  qrTitle: string;
  qrSubtitle: string;
  qrDownload: string;
  qrAlt: (name: string) => string;
  close: string;
  builtWith: string;
  contactFab: string;
  contactFabOpen: string;
  contactFabClose: string;
  contactFabCloseLabel: string;
  formIntro: (business: string) => string;
  requiredMark: string;
  requiredField: (label: string) => string;
  invalidEmail: (label: string) => string;
  invalidPhone: (label: string) => string;
  privacyConsent: string;
  privacyConsentLink: string;
  privacyConsentText: (business: string) => string;
  sending: string;
  submit: string;
  sentTitle: string;
  genericError: string;
  selectPlaceholder: string;
};

const dictionaries: Record<CardLanguage, CardStrings> = {
  he: {
    qr: "QR",
    qrAria: "הצגת QR",
    share: "שיתוף",
    shareAria: "שיתוף הכרטיס",
    qrTitle: "סרקו ושמרו את הכרטיס",
    qrSubtitle: "הקישור נשאר קבוע גם אחרי עדכון התוכן.",
    qrDownload: "הורדת QR",
    qrAlt: (name) => `QR לכרטיס של ${name}`,
    close: "סגירה",
    builtWith: "נבנה באמצעות",
    contactFab: "צור קשר",
    contactFabOpen: "פתיחת תפריט יצירת קשר",
    contactFabClose: "סגירה",
    contactFabCloseLabel: "סגירת תפריט יצירת הקשר",
    formIntro: (business) => `הפרטים יגיעו ישירות ל־${business}. שדות המסומנים „חובה” נדרשים לשליחה.`,
    requiredMark: "חובה",
    requiredField: (label) => `${label}: שדה חובה`,
    invalidEmail: (label) => `${label}: כתובת אימייל אינה תקינה. לדוגמה: name@example.com`,
    invalidPhone: (label) => `${label}: מספר טלפון אינו תקין. יש להזין מספר מלא`,
    privacyConsent: "יש לאשר את מדיניות הפרטיות כדי לשלוח את הפנייה",
    privacyConsentLink: "מדיניות הפרטיות",
    privacyConsentText: (business) =>
      `אני מאשר/ת להעביר את הפרטים ל־${business} לצורך מענה לפנייה, בהתאם ל`,
    sending: "שולחים...",
    submit: "שליחת פנייה",
    sentTitle: "הפנייה נשלחה",
    genericError:
      "לא הצלחנו לשלוח כרגע. הפרטים שהזנת נשארו בטופס — אפשר לנסות שוב, או ליצור קשר באמצעות הכפתורים למעלה.",
    selectPlaceholder: "בחירה",
  },
  en: {
    qr: "QR",
    qrAria: "Show QR code",
    share: "Share",
    shareAria: "Share this card",
    qrTitle: "Scan and save this card",
    qrSubtitle: "The link stays the same even after the content is updated.",
    qrDownload: "Download QR",
    qrAlt: (name) => `QR code for ${name}`,
    close: "Close",
    builtWith: "Built with",
    contactFab: "Contact",
    contactFabOpen: "Open contact menu",
    contactFabClose: "Close",
    contactFabCloseLabel: "Close contact menu",
    formIntro: (business) => `Your details go straight to ${business}. Fields marked “required” must be filled in.`,
    requiredMark: "required",
    requiredField: (label) => `${label}: this field is required`,
    invalidEmail: (label) => `${label}: that email address is not valid. For example: name@example.com`,
    invalidPhone: (label) => `${label}: that phone number is not valid. Please enter the full number`,
    privacyConsent: "Please accept the privacy policy to send your message",
    privacyConsentLink: "privacy policy",
    privacyConsentText: (business) =>
      `I agree to share my details with ${business} so they can respond, in line with the `,
    sending: "Sending…",
    submit: "Send message",
    sentTitle: "Message sent",
    genericError:
      "We couldn’t send it just now. What you typed is still here — you can try again, or use the buttons above to get in touch.",
    selectPlaceholder: "Select",
  },
};

export function cardStrings(language: CardLanguage): CardStrings {
  return dictionaries[language] || dictionaries.he;
}

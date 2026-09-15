/**
 * מקור אמת יחיד למסמכים המשפטיים.
 *
 * הגרסה נשמרת יחד עם כל הסכמה של לקוח. עדכון LEGAL_VERSION מסמן שכל
 * ההסכמות הקודמות ניתנו לנוסח אחר — כך אפשר להוכיח למה בדיוק הלקוח
 * הסכים, ולדעת ממי צריך לבקש אישור מחדש.
 *
 * ⚠️ הנוסח נכתב כטיוטה מקצועית ואינו תחליף לייעוץ משפטי. לפני השקה
 *    מסחרית יש להעביר את כל המסמכים לעורך דין ישראלי, בעיקר בשל
 *    חוק החוזים האחידים, חוק הגנת הצרכן והוראות הגנת הפרטיות.
 */

/**
 * מזהה הנוסח. יש להעלות בכל שינוי מהותי.
 *
 * העלאת הגרסה חוסמת את המערכת לכל מי שאישר נוסח קודם, עד לאישור מחדש
 * (ראו requiresLegalReAcceptance). זו התנהגות מכוונת: הסכמה לנוסח ישן
 * אינה הסכמה לנוסח החדש.
 */
export const LEGAL_VERSION = "2026-09-14";

/** תאריך תחילת התוקף, כפי שמוצג בראש כל מסמך. */
export const LEGAL_EFFECTIVE_DATE = "14 בספטמבר 2026";

/**
 * זהות הספק כפי שהיא מוצגת במסמכים.
 *
 * בכוונה ללא שם משפטי, מספר רישום, כתובת פיזית וטלפון: מה שאינו מוצג
 * אינו יכול להיות מוצג בטעות כלא מדויק. ערוץ הקשר הרשמי הוא הדוא״ל.
 */
export const legalEntity = {
  displayName: "NAIMLY – נעים לי",
};

export type LegalDocId = "terms" | "privacy" | "acceptable-use" | "refund" | "cookies" | "accessibility";

export const legalDocuments: Array<{ id: LegalDocId; title: string; href: string; summary: string }> = [
  { id: "terms", title: "תנאי שימוש", href: "/legal/terms", summary: "ההסכם המחייב בין הספק למנוי, לרבות עילות השעיה וסיום." },
  { id: "privacy", title: "מדיניות פרטיות", href: "/legal/privacy", summary: "אילו נתונים נאספים, לאיזו מטרה, למי הם נמסרים וכמה זמן הם נשמרים." },
  { id: "acceptable-use", title: "מדיניות שימוש מותר", href: "/legal/acceptable-use", summary: "התוכן וההתנהגות האסורים, ומה קורה בהפרה." },
  { id: "refund", title: "ביטול והחזרים", href: "/legal/refund", summary: "זכות הביטול לפי חוק הגנת הצרכן ואופן ההשבה." },
  { id: "cookies", title: "מדיניות עוגיות", href: "/legal/cookies", summary: "עוגיות הכרחיות מול עוגיות מדידה, וניהול ההסכמה." },
];

/** המסמכים שהלקוח מאשר בעת פתיחת חשבון ובעת בחירת מסלול. */
export const bindingDocumentIds: LegalDocId[] = ["terms", "privacy", "acceptable-use", "refund", "cookies"];

/**
 * האם המשתמש חייב לאשר מחדש את המסמכים.
 *
 * הסכמה לנוסח קודם אינה הסכמה לנוסח הנוכחי. משתמש שאישר גרסה ישנה —
 * או שלא אישר כלל — נחסם עד לאישור מחדש, ולא רק מקבל תזכורת שאפשר
 * לסגור. זו הנקודה שמבדילה בין תיעוד הסכמה לבין אכיפתה.
 */
export function requiresLegalReAcceptance(acceptedVersion?: string | null): boolean {
  return String(acceptedVersion || "").trim() !== LEGAL_VERSION;
}

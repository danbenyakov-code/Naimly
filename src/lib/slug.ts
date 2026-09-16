/**
 * נרמול כתובת הכרטיס והצעת חלופות (NEW-006).
 *
 * הבדיקה חייבת לרוץ על אותה צורה בשני הצדדים. אם הממשק בודק `My-Card`
 * והמסד שומר `my-card`, הבדיקה תאמר "פנוי" והשמירה תיכשל — והמשתמש
 * יקבל שגיאה על כתובת שהוא בדיוק נבדק עליה.
 */

/** תווים שמופו לצורתם הבסיסית לפני הניקוי. */
const lookalikes: Record<string, string> = { "_": "-", " ": "-", "–": "-", "—": "-", ".": "-" };

/**
 * הצורה הקנונית של כתובת.
 *
 * נכתב כסריקת תווים ולא ברגקס: מחלקות תווים עם escapes נשברו בפרויקט
 * הזה יותר מפעם אחת, ושגיאה כאן פותחת פתח לשתי כתובות שנראות שונות
 * ומצביעות לאותו מקום.
 */
export function normalizeSlug(value: string): string {
  const source = String(value || "")
    // NFKD מפריד סימני ניקוד, כדי שאותיות מוטעמות ייחתכו לבסיס שלהן.
    .normalize("NFKD")
    .toLowerCase()
    .trim();

  let out = "";
  for (const char of source) {
    const mapped = lookalikes[char] ?? char;
    const code = mapped.charCodeAt(0);
    const isLatin = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    if (isLatin || isDigit || mapped === "-") out += mapped;
  }

  // כיווץ מקפים רצופים.
  let collapsed = "";
  for (const char of out) {
    if (char === "-" && collapsed.endsWith("-")) continue;
    collapsed += char;
  }

  // מקף בתחילת או בסוף הכתובת אינו נושא משמעות.
  while (collapsed.startsWith("-")) collapsed = collapsed.slice(1);
  while (collapsed.endsWith("-")) collapsed = collapsed.slice(0, -1);

  return collapsed.slice(0, 60);
}

export type SlugState = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

/** האם הכתובת עומדת בכללי המבנה, לפני בדיקת זמינות. */
export function isSlugShapeValid(value: string): boolean {
  const normalized = normalizeSlug(value);
  return normalized.length >= 3 && normalized.length <= 60;
}

/**
 * חלופות בטוחות, כששם הכתובת תפוס.
 *
 * מבוססות על שם העסק ולא על מספרים רצים בלבד: "my-card-2" אינו אומר
 * דבר ללקוח, ו-"studio-tel-aviv" כן.
 */
export function suggestSlugs(businessName: string, current: string): string[] {
  const base = normalizeSlug(businessName) || normalizeSlug(current) || "card";
  const suffixes = ["il", "co", "biz", String(new Date().getFullYear()), "2"];

  const list = suffixes
    .map((suffix) => normalizeSlug(`${base}-${suffix}`))
    .filter((slug) => slug.length >= 3 && slug !== normalizeSlug(current));

  return [...new Set(list)].slice(0, 3);
}

/** ההודעה שמוצגת לכל מצב. */
export const slugStateMessages: Record<SlugState, string> = {
  idle: "",
  checking: "בודקים זמינות…",
  available: "הכתובת פנויה",
  taken: "הכתובת הזו כבר תפוסה. יש לבחור כתובת אחרת.",
  invalid: "הכתובת יכולה לכלול אותיות באנגלית, מספרים ומקף, ולפחות 3 תווים.",
  error: "לא הצלחנו לבדוק כרגע. הבדיקה תתבצע שוב בשמירה.",
};

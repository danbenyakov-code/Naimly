/**
 * בדיקת מבנה כתובת דוא״ל — מקור אמת יחיד.
 *
 * היו כאן שלושה עותקים של אותה בדיקה, ואחד מהם היה פגום:
 * `[^s@]` במקום `[^\s@]`. כלומר הוא פסל כל כתובת שמכילה את האות s.
 * "israel@gmail.com" ו-"moshe@walla.co.il" נדחו בטופס הפניות של הכרטיס
 * הציבורי — כלומר לידים אמיתיים אבדו, בלי שום שגיאה בלוג.
 *
 * נכתב כסריקת תווים ולא כרגקס: מחלקות תווים עם escapes נשברו בפרויקט
 * הזה כמה פעמים בעריכה אוטומטית, ושגיאה כזו עוברת בשקט — הקוד ממשיך
 * לרוץ, רק עם משמעות אחרת לגמרי.
 *
 * הבדיקה מכוונת למבנה בלבד. אימות אמיתי של כתובת נעשה בשליחת הודעה
 * אליה, ולא בניתוח המחרוזת.
 */

/** תו שאינו רווח ואינו שטרודל — כלומר תקין בתוך שם או בדומיין. */
function isPlainChar(char: string): boolean {
  if (char === "@") return false;
  const code = char.charCodeAt(0);
  // רווח, טאב, שורה חדשה, CR, form feed, vertical tab.
  if (code === 32 || (code >= 9 && code <= 13)) return false;
  return true;
}

/**
 * האם המחרוזת נראית ככתובת דוא״ל.
 *
 * דורש: חלק מקומי לא ריק, שטרודל אחד בדיוק, דומיין עם נקודה, וסיומת
 * של שני תווים לפחות אחרי הנקודה האחרונה.
 */
export function isEmailLike(value: unknown): boolean {
  const raw = String(value ?? "").trim();
  if (!raw) return false;

  // שטרודל אחד בדיוק.
  let atIndex = -1;
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== "@") continue;
    if (atIndex !== -1) return false;
    atIndex = index;
  }
  if (atIndex <= 0 || atIndex === raw.length - 1) return false;

  const local = raw.slice(0, atIndex);
  const domain = raw.slice(atIndex + 1);

  for (const char of local) if (!isPlainChar(char)) return false;
  for (const char of domain) if (!isPlainChar(char)) return false;

  // הדומיין חייב נקודה שאינה בתחילתו ואינה בסופו.
  const dotIndex = domain.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === domain.length - 1) return false;

  // סיומת של שני תווים לפחות.
  if (domain.length - dotIndex - 1 < 2) return false;

  // נקודות צמודות אינן חוקיות בדומיין.
  if (domain.includes("..")) return false;

  return true;
}

/** ההודעה האחידה שמוצגת כשכתובת אינה תקינה. */
export const invalidEmailMessage = "כתובת האימייל אינה תקינה. לדוגמה: name@example.com";

/**
 * ספירת ספרות במחרוזת.
 *
 * נכתב כסריקה ולא כ-replace עם מחלקת תווים, מאותה סיבה: `/D/` במקום
 * `/\D/` מחק את האות D בלבד וספר מקפים ורווחים כספרות, כך ש-"1-2-3-4-5"
 * עבר כמספר טלפון תקין.
 */
export function countDigits(value: unknown): number {
  const raw = String(value ?? "");
  let count = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    if (code >= 48 && code <= 57) count += 1;
  }
  return count;
}

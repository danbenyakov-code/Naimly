/**
 * חסימת כתובות כרטיס פוגעניות.
 *
 * REQ-019: הבדיקה חייבת להיות בצד השרת. חסימה בממשק בלבד היא הצגה,
 * לא אכיפה — כל בקשה ישירה ל-API עוקפת אותה.
 *
 * הקושי האמיתי אינו הרשימה אלא העקיפות: מקפים, כפילות אותיות, החלפת
 * אות באות דומה, וסימני Unicode בלתי נראים. הנרמול מטפל בכל אלה לפני
 * ההשוואה, ולכן `s-e-x`, `ss3xx` ו-`se​x` נתפסים כולם.
 */

/** תווי Unicode שאינם נראים ומשמשים לעקיפת סינון. */
const INVISIBLE = /[​-‍﻿­⁠]/g;

/** אותיות שמוחלפות בקלות בסימנים דומים. */
const LOOKALIKES: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g",
  "@": "a", "$": "s", "!": "i", "|": "i", "+": "t",
};

/**
 * מצמצם מחרוזת לצורה שאי אפשר להתחמק ממנה:
 * מסיר תווים בלתי נראים ומפרידים, מחליף סימנים דומים, ומכווץ כפילויות.
 */
export function normalizeForPolicy(value: string): string {
  const lowered = String(value || "")
    .normalize("NFKD")
    .replace(INVISIBLE, "")
    .toLowerCase();

  const mapped = Array.from(lowered)
    .map((char) => LOOKALIKES[char] ?? char)
    .join("");

  // מסירים כל מה שאינו אות לטינית או עברית, ואז מכווצים כפילויות.
  return mapped
    .replace(/[^a-z֐-׿]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/*
 * הרשימה מכוונת לתוכן שאסור לפרסם לפי מדיניות השימוש המותר: מין,
 * פורנוגרפיה, סמים, נשק ואלימות. היא אינה מתיימרת להיות ממצה —
 * מודרציה של תוכן וקבצים היא שכבה נפרדת, כפי שמצוין ב-REQ-020.
 */
const blockedTerms = [
  // מין ופורנוגרפיה
  "sex", "porn", "xxx", "escort", "nude", "naked", "erotic", "fetish",
  "hentai", "camgirl", "onlyfans", "strip", "brothel", "hooker", "whore",
  "זין", "כוס", "זיון", "פורנו", "סקס", "עירום", "זונה", "ליווי", "בזנות",
  // סמים
  "cocaine", "heroin", "meth", "weed", "cannabis", "lsd", "mdma", "drugs",
  "קוקאין", "הרואין", "קנאביס", "סמים", "גראס", "אקסטזי",
  // נשק ואלימות
  "gun", "rifle", "pistol", "ammo", "explosive", "bomb", "terror", "isis",
  "נשק", "אקדח", "רובה", "פצצה", "טרור", "חומרנפץ",
  // שנאה
  "nazi", "hitler", "kkk", "genocide",
  "נאצי", "היטלר", "רצחעם",
  // הונאה
  "phishing", "carding", "hack", "crack", "warez", "torrent",
  "הונאה", "זיוף",
];

/** הצורה המנורמלת של כל מונח, מחושבת פעם אחת. */
const normalizedTerms = blockedTerms.map(normalizeForPolicy).filter(Boolean);

/*
 * "בעיית Scunthorpe": מילים תמימות שמכילות מונח חסום כתת-מחרוזת.
 * Essex, Sussex ו-Middlesex הם שמות מקומות אמיתיים, ועסק בשם
 * "Essex Law" חייב להצליח להירשם. חסימה נאיבית הייתה פוסלת אותו,
 * והלקוח לא היה מבין למה.
 */
const innocentContainers = [
  "essex", "sussex", "middlesex", "wessex", "unisex", "sexton",
  "analysis", "analyst", "analytic", "cockburn", "scunthorpe",
  "assassin", "classic", "grassland", "bassist", "shiitake",
  "therapist", "specialist", "penistone",
].map(normalizeForPolicy);

/** האם המונח שנמצא הוא חלק ממילה תמימה מוכרת. */
function isInnocentMatch(normalized: string, term: string): boolean {
  return innocentContainers.some((word) => word.includes(term) && normalized.includes(word));
}

/**
 * האם הכתובת מכילה מונח אסור.
 *
 * מחזיר את המונח שנתפס לצורך תיעוד בצד השרת בלבד. אסור להציג אותו
 * למשתמש: החזרת המילה הפוגענית לממשק גם חושפת את הרשימה וגם מציגה
 * את התוכן שאותו רצינו למנוע.
 */
/**
 * פיצול לרכיבי מילים.
 *
 * נכתב בלולאה ולא ברגקס: מחלקת תווים עם escapes נשברה כאן בעריכה
 * אוטומטית ל-[-_.s], כלומר פיצול גם על האות s. בקוד שחוסם תוכן,
 * שגיאה כזו עוברת בשקט ומשנה את ההתנהגות בלי להיכשל.
 */
function splitWords(value: string): string[] {
  const words: string[] = [];
  let current = "";
  for (const char of String(value || "").toLowerCase()) {
    const code = char.charCodeAt(0);
    const isLatin = code >= 97 && code <= 122;
    const isHebrew = code >= 0x05d0 && code <= 0x05ea;
    const isDigit = code >= 48 && code <= 57;
    if (isLatin || isHebrew || isDigit) current += char;
    else if (current) { words.push(current); current = ""; }
  }
  if (current) words.push(current);
  return words;
}

export function findBlockedTerm(slug: string): string | null {
  const whole = normalizeForPolicy(slug);
  if (!whole) return null;

  /*
   * שלוש רמות, מהמחמיר למקל:
   *   1. מקטע שלם (בין מקפים) ששווה למונח — "sex-shop".
   *   2. המחרוזת כולה שווה למונח — "s-e-x", "sssexxx".
   *   3. תת-מחרוזת, אך ורק כשאינה חלק ממילה תמימה מוכרת — "sexshop".
   */
  const segments = splitWords(slug).map(normalizeForPolicy).filter(Boolean);

  for (const term of normalizedTerms) {
    if (term.length < 3) continue;
    if (segments.includes(term)) return term;
    if (whole === term) return term;
    if (whole.includes(term) && !isInnocentMatch(whole, term)) return term;
  }
  return null;
}

export function isSlugAllowed(slug: string): boolean {
  return findBlockedTerm(slug) === null;
}

/** ההודעה שמוצגת למשתמש. ניטרלית במכוון. */
export const blockedSlugMessage =
  "הכתובת שנבחרה אינה זמינה לשימוש. יש לבחור כתובת אחרת שמתארת את העסק.";

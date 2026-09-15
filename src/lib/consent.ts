/**
 * הסכמת עוגיות לפי קטגוריות.
 *
 * REQ-004: עד כה ההסכמה הייתה בינארית — "אישור מדידה" או "רק הכרחי" —
 * ושני כלים שונים לחלוטין (אנליטיקה של האתר ופיקסל שיווקי) נטענו יחד
 * על סמך אותה לחיצה. מבחינת הדין ומבחינת הלקוח אלה שתי מטרות נפרדות,
 * ומי שהסכים למדידה לא בהכרח הסכים לשיווק.
 *
 * "הכרחי" אינו קטגוריה שאפשר לכבות: בלעדיו אין התחברות ואין שמירת
 * ההעדפה עצמה. הוא מוצג כדי שיהיה שקוף, לא כדי שייבחר.
 */

export type ConsentCategory = "analytics" | "marketing";

export type ConsentState = {
  analytics: boolean;
  marketing: boolean;
  /** מתי ניתנה ההחלטה, כראיה. */
  decidedAt: string;
  /** גרסת הנוסח שהוצג. שינוי מהותי מחייב בחירה מחדש. */
  version: string;
};

/** גרסת חלונית ההסכמה. העלאה מציגה אותה שוב לכולם. */
export const CONSENT_VERSION = "2";

const STORAGE_KEY = "naimly-consent";
const LEGACY_KEY = "cookie-consent";

/** שם האירוע שמודיע על שינוי בהסכמה, לכל מי שמאזין. */
export const CONSENT_EVENT = "naimly-consent";

export const consentCategories: Array<{
  id: ConsentCategory;
  title: string;
  description: string;
}> = [
  {
    id: "analytics",
    title: "מדידה וסטטיסטיקה",
    description:
      "עוזר להבין אילו עמודים נצפים וכמה פניות מתקבלות. משמש לשיפור השירות, לא לפרסום.",
  },
  {
    id: "marketing",
    title: "שיווק ופרסום",
    description:
      "מאפשר למדוד קמפיינים ולהתאים מודעות, לרבות פיקסלים של רשתות חברתיות.",
  },
];

/**
 * קריאה בטוחה מ-localStorage.
 *
 * גישה לאחסון זורקת בדפדפן שחוסם אותו, בגלישה פרטית מסוימת ובתוך
 * iframe — ושם קריסה הייתה מורידה את כל העמוד בגלל באנר עוגיות.
 */
function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * ההחלטה השמורה, או null כשטרם הוחלט.
 *
 * מהגרת את המפתח הישן: מי שכבר בחר בעבר לא יישאל שוב סתם, אבל
 * "accepted" הישן מכסה מדידה ושיווק כאחד — כי זה מה שהוא הפעיל בפועל.
 */
export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;

  const raw = readRaw();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<ConsentState>;
      if (parsed && parsed.version === CONSENT_VERSION) {
        return {
          analytics: parsed.analytics === true,
          marketing: parsed.marketing === true,
          decidedAt: String(parsed.decidedAt || ""),
          version: CONSENT_VERSION,
        };
      }
      // גרסה ישנה של הנוסח: יש לשאול מחדש.
      return null;
    } catch {
      return null;
    }
  }

  let legacy: string | null = null;
  try {
    legacy = window.localStorage.getItem(LEGACY_KEY);
  } catch {
    legacy = null;
  }
  if (legacy === "accepted" || legacy === "rejected") {
    const accepted = legacy === "accepted";
    return { analytics: accepted, marketing: accepted, decidedAt: "", version: CONSENT_VERSION };
  }

  return null;
}

/** האם קטגוריה מסוימת אושרה. */
export function hasConsent(category: ConsentCategory): boolean {
  const state = readConsent();
  return state ? state[category] === true : false;
}

/**
 * שמירת ההחלטה והודעה למאזינים.
 *
 * האירוע נשלח גם כשההחלטה שלילית, כדי שרכיב שכבר טען משהו יוכל
 * להגיב — לא רק כדי להתחיל לטעון.
 */
export function writeConsent(choice: { analytics: boolean; marketing: boolean }): ConsentState {
  const state: ConsentState = {
    analytics: choice.analytics === true,
    marketing: choice.marketing === true,
    decidedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // המפתח הישן מנוקה כדי שלא יישאר מקור אמת שני.
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // אחסון חסום: הבחירה תקפה לביקור הנוכחי בלבד.
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: state }));
  }
  return state;
}

/** מחיקת ההחלטה, כדי להציג את החלונית מחדש. */
export function clearConsent() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // אין מה לנקות כשאין אחסון.
  }
}

/**
 * מדיניות סיסמה. משותפת לשרת וללקוח כדי שהחיווי בממשק יהיה זהה למה שנאכף
 * בפועל — משתמש לא אמור לראות "סיסמה חזקה" ואז לקבל דחייה מהשרת.
 */

export const PASSWORD_MIN_LENGTH = 10;

export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const passwordRules: PasswordRule[] = [
  { id: "length", label: `לפחות ${PASSWORD_MIN_LENGTH} תווים`, test: (value) => value.length >= PASSWORD_MIN_LENGTH },
  { id: "lower", label: "אות קטנה באנגלית (a-z)", test: (value) => /[a-z]/.test(value) },
  { id: "upper", label: "אות גדולה באנגלית (A-Z)", test: (value) => /[A-Z]/.test(value) },
  { id: "digit", label: "ספרה אחת לפחות", test: (value) => /\d/.test(value) },
  { id: "symbol", label: "תו מיוחד (!@#$ ועוד)", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

/** סיסמאות נפוצות שנחסמות גם אם הן עומדות בכללים הטכניים. */
const blockedPatterns = [
  /^password/i,
  /^123456/,
  /^qwerty/i,
  /^abc123/i,
  /^naimly/i,
  /^letmein/i,
  /^admin/i,
];

export type PasswordStrength = {
  /** כמה כללים עברו. */
  passed: number;
  total: number;
  /** 0–4. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** האם מותר להשתמש בסיסמה. */
  valid: boolean;
  failedRules: PasswordRule[];
  /** סיבה מדויקת לכישלון, לתצוגה למשתמש. */
  error: string;
};

const labels = ["חלשה מאוד", "חלשה", "בינונית", "טובה", "חזקה"] as const;

export function evaluatePassword(value: string): PasswordStrength {
  const failedRules = passwordRules.filter((rule) => !rule.test(value));
  const passed = passwordRules.length - failedRules.length;

  const blocked = blockedPatterns.some((pattern) => pattern.test(value));
  const repeated = /(.)\1{3,}/.test(value);

  let score: PasswordStrength["score"] = 0;
  if (value.length > 0) {
    // הציון נגזר ממספר הכללים שעברו, עם בונוס לאורך ממשי.
    const base = Math.max(0, passed - 1);
    const lengthBonus = value.length >= 16 ? 1 : 0;
    score = Math.min(4, base + lengthBonus) as PasswordStrength["score"];
  }
  if (blocked || repeated) score = Math.min(score, 1) as PasswordStrength["score"];

  let error = "";
  if (!value) error = "יש להזין סיסמה";
  else if (failedRules.length) error = `הסיסמה חייבת לכלול: ${failedRules.map((rule) => rule.label).join(", ")}`;
  else if (blocked) error = "הסיסמה נפוצה מדי. יש לבחור צירוף ייחודי יותר";
  else if (repeated) error = "יש להימנע מרצף של אותו תו";

  return {
    passed,
    total: passwordRules.length,
    score,
    label: labels[score],
    valid: !error,
    failedRules,
    error,
  };
}

/** בדיקה קצרה לשרת. */
export function isStrongPassword(value: string) {
  return evaluatePassword(value).valid;
}

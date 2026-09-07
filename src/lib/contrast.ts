/**
 * חישוב ניגודיות לפי WCAG 2.2.
 *
 * משמש לאזהרות בבונה: צבע טקסט על רקע, וצבע טקסט על כפתור. המטרה היא
 * שלא יפורסם כרטיס שאי אפשר לקרוא, ושהמשתמש יקבל הצעה קונקרטית לתיקון.
 */

/** רמות הדרישה של WCAG 2.2 AA. */
export const CONTRAST_AA_NORMAL = 4.5;
export const CONTRAST_AA_LARGE = 3;
export const CONTRAST_AA_UI = 3;

function parseHex(value: string) {
  const hex = String(value || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const full = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** לומינציה יחסית לפי הנוסחה של WCAG. */
export function relativeLuminance(color: string) {
  const rgb = parseHex(color);
  if (!rgb) return 0;
  const channel = (raw: number) => {
    const value = raw / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** יחס ניגודיות בין שני צבעים. 1 = זהים, 21 = שחור מול לבן. */
export function contrastRatio(foreground: string, background: string) {
  if (!parseHex(foreground) || !parseHex(background)) return 0;
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** צבע טקסט קריא — שחור או לבן — לפי הרקע שנבחר. */
export function readableTextColor(mode: "dark" | "light" | string) {
  // mode "light" פירושו שהרקע כהה, ולכן הטקסט צריך להיות בהיר.
  if (mode === "light") return "#ffffff";
  if (mode === "dark") return "#101223";
  // כשמתקבל צבע hex — בוחרים את הניגוד הטוב יותר.
  const onWhite = contrastRatio(mode, "#ffffff");
  const onBlack = contrastRatio(mode, "#101223");
  return onBlack >= onWhite ? "#101223" : "#ffffff";
}

export type ContrastVerdict = {
  ratio: number;
  /** עובר את הדרישה שנבדקה. */
  passes: boolean;
  level: "AA" | "AA-large" | "fail";
  /** צבע חלופי מוצע כשנכשל. */
  suggestion: string;
  message: string;
};

/**
 * בודק צבע טקסט מול רקע ומחזיר פסק דין עם הצעה קונקרטית.
 * `large` לטקסט גדול (18pt ומעלה, או 14pt מודגש).
 */
export function checkContrast(foreground: string, background: string, options?: { large?: boolean }): ContrastVerdict {
  const ratio = contrastRatio(foreground, background);
  const required = options?.large ? CONTRAST_AA_LARGE : CONTRAST_AA_NORMAL;
  const passes = ratio >= required;
  const suggestion = readableTextColor(background);

  return {
    ratio,
    passes,
    level: ratio >= CONTRAST_AA_NORMAL ? "AA" : ratio >= CONTRAST_AA_LARGE ? "AA-large" : "fail",
    suggestion,
    message: passes
      ? `הניגודיות תקינה (${ratio.toFixed(1)}:1)`
      : `הניגודיות נמוכה מדי: ${ratio.toFixed(1)}:1 במקום ${required}:1 לפחות. מומלץ להשתמש ב-${suggestion}.`,
  };
}

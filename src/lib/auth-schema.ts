import { z } from "zod";

/**
 * סכמות אימות משותפות לשרת וללקוח. הודעות השגיאה נכתבות פעם אחת כאן,
 * כדי שהמשתמש יראה בדיוק את אותו נוסח בשני הצדדים.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
/** זמן המתנה בין בקשות קוד, בשניות. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export const emailSchema = z
  .string()
  .min(1, "יש להזין כתובת אימייל.")
  .max(160, "כתובת האימייל ארוכה מדי.")
  .refine(
    (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value),
    "כתובת האימייל אינה תקינה. יש להזין כתובת במבנה name@example.com.",
  );

export const otpSchema = z
  .string()
  .refine((value) => value.length > 0, "יש להזין את קוד האימות שנשלח אליך במייל.")
  .refine((value) => value.length === OTP_LENGTH, `קוד האימות מורכב מ‑${OTP_LENGTH} ספרות. יש להשלים את כל הספרות.`);

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "יש להזין שם מלא כדי שנוכל לפנות אליך בשמך.")
  .max(80, "השם ארוך מדי. ניתן להזין עד 80 תווים.");

/**
 * טלפון ישראלי או בינלאומי. מקבל רווחים, מקפים וסוגריים ומנקה אותם.
 */
export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .refine(
    (value) => value === "" || /^(\+\d{9,15}|0\d{8,9})$/.test(value),
    "מספר הטלפון אינו תקין. ניתן להזין מספר ישראלי (050-1234567) או מספר בינלאומי עם קידומת מדינה.",
  );

export function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, "");
}

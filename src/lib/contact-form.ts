import type { ContactFormField } from "@/lib/types";

/**
 * שדות טופס הפניות — מקור אמת יחיד.
 *
 * QA-008/QA-013 · סיבת השורש: `normalizeCard` נפל לברירת מחדל רק כאשר
 * `contact_form_fields` **אינו מערך**. ברירת המחדל בעמודה היא `'[]'::jsonb`
 * — ומערך ריק הוא מערך. כלומר כל כרטיס שנוצר בלי שדות מפורשים קיבל
 * רשימה ריקה, ו-`.map()` על ריק אינו זורק אלא פשוט אינו מרנדר דבר.
 *
 * התוצאה: טופס ציבורי עם תיבת פרטיות, honeypot וכפתור שליחה — בלי שום
 * שדה למלא. **הכשל היה שקט לחלוטין**: אין שגיאה, אין לוג, והבדיקות
 * האוטומטיות עברו כי הן בדקו שהטופס קיים ולא שיש בו מה למלא.
 *
 * הלקח: "ריק" ו"לא הוגדר" חייבים להיות מובחנים, או — כשאי אפשר — להיות
 * מטופלים אותו דבר. טופס פניות בלי שדות אינו מצב תקין בשום תרחיש.
 */

/** ברירת המחדל שכל כרטיס מקבל כשלא הוגדרו שדות. */
export function defaultContactFormFields(): ContactFormField[] {
  return [
    { id: "name", label: "שם מלא", type: "text", required: true, enabled: true, placeholder: "" },
    { id: "phone", label: "טלפון", type: "tel", required: true, enabled: true, placeholder: "050-0000000" },
    { id: "email", label: "אימייל", type: "email", required: false, enabled: true, placeholder: "name@example.com" },
    { id: "message", label: "במה נוכל לעזור?", type: "textarea", required: true, enabled: true, placeholder: "" },
  ];
}

/**
 * נרמול שדה בודד.
 *
 * שדות שנוספו מאוחר יותר (`enabled`, `placeholder`) נגזרים כך שכרטיס
 * ותיק ימשיך לעבוד: היעדר `enabled` פירושו מוצג, לא מוסתר.
 */
export function normalizeField(raw: unknown, index: number): ContactFormField | null {
  if (!raw || typeof raw !== "object") return null;
  const field = raw as Partial<ContactFormField>;

  const type = (["text", "email", "tel", "textarea", "select", "checkbox"] as const).includes(
    field.type as ContactFormField["type"],
  )
    ? (field.type as ContactFormField["type"])
    : "text";

  const label = String(field.label || "").trim();
  if (!label) return null;

  return {
    id: String(field.id || `field-${index}`),
    label,
    type,
    required: field.required === true,
    // היעדר הערך = מוצג. כך כרטיס שנשמר לפני התוספת אינו מאבד שדות.
    enabled: field.enabled !== false,
    placeholder: String(field.placeholder || ""),
    options: Array.isArray(field.options) ? field.options.map(String) : undefined,
  };
}

/**
 * הרשימה שתישמר ותוצג.
 *
 * רשימה ריקה — או רשימה שכל שדותיה פסולים — נופלת לברירת המחדל. זו
 * הנקודה המדויקת שנשברה: מערך ריק עבר כאילו היה בחירה מודעת.
 */
export function normalizeContactFormFields(raw: unknown): ContactFormField[] {
  const list = Array.isArray(raw) ? raw : [];
  const normalized = list.map(normalizeField).filter(Boolean) as ContactFormField[];
  return normalized.length ? normalized : defaultContactFormFields();
}

/** השדות שמוצגים בפועל בטופס הציבורי. */
export function visibleFields(fields: ContactFormField[]): ContactFormField[] {
  return fields.filter((field) => field.enabled !== false);
}

/**
 * האם הטופס שמיש.
 *
 * טופס עם תיבת סימון בלבד אינו טופס פניות — אי אפשר להשאיר בו פרטים.
 * לכן נדרש לפחות שדה אחד שאפשר להקליד בו.
 */
export function hasUsableContactForm(fields: ContactFormField[]): boolean {
  return visibleFields(fields).some((field) => field.type !== "checkbox");
}

/** ההסבר שמוצג לבעל הכרטיס כשהטופס אינו שמיש. */
export const unusableFormMessage =
  "טופס הפניות אינו כולל שדה למילוי. יש להציג לפחות שדה אחד (שם, טלפון, אימייל או הודעה) כדי שאפשר יהיה להשאיר פרטים.";

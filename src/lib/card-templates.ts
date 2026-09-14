import type { CardWidgetType } from "@/lib/types";

/**
 * ספריית התבניות של הכרטיס (BENCH-007).
 *
 * `template` נשמר במסד ועבר ולידציה מאז ההתחלה — אבל שום דבר לא קרא
 * אותו. שדה שמתחזה ליכולת גרוע משדה שאינו קיים, כי הוא נראה בעורך
 * ואינו עושה דבר.
 *
 * תבנית היא **תצורה, לא רכיב**. כך החלפת תבנית אינה יכולה למחוק תוכן:
 * היא משנה גבהים, יישור וסדר מוצע בלבד, והנתונים אינם נוגעים בה.
 *
 * העיצוב מקורי ל-NAIMLY. cardDBee שימש נקודת ייחוס לאיכות התוצאה
 * ולמסע המשתמש — לא למראה.
 */

export type CardTemplateId = "spotlight" | "clean" | "bold" | "services" | "portfolio" | "local";

export type CardTemplate = {
  id: CardTemplateId;
  name: string;
  /** לאיזה עסק היא מתאימה, בשפה של בעל העסק ולא של מעצב. */
  audience: string;
  /** גובה הקאבר בפיקסלים. 0 = בלי קאבר. */
  coverHeight: number;
  /** מיקום הזהות ביחס לקאבר. */
  identity: "overlap" | "below" | "inline";
  /** יישור גוש הזהות. */
  align: "start" | "center";
  /** גודל הלוגו בפיקסלים. */
  logoSize: number;
  /** סדר מוצע למקטעים. תוכן שאינו ברשימה נשאר בסדר שהוגדר. */
  order: CardWidgetType[];
};

export const cardTemplates: CardTemplate[] = [
  {
    id: "spotlight",
    name: "זרקור",
    audience: "ברירת המחדל — מתאימה כמעט לכל עסק",
    coverHeight: 144,
    identity: "overlap",
    align: "start",
    logoSize: 88,
    order: ["smart_buttons", "services", "gallery", "video", "testimonials", "hours", "files", "contact_form"],
  },
  {
    id: "clean",
    name: "נקייה",
    audience: "יועצים, מטפלים ובעלי מקצוע שהטקסט אצלם חשוב מהתמונה",
    coverHeight: 0,
    identity: "below",
    align: "center",
    logoSize: 96,
    order: ["services", "testimonials", "hours", "files", "smart_buttons", "gallery", "video", "contact_form"],
  },
  {
    id: "bold",
    name: "נועזת",
    audience: "מותגים שרוצים נוכחות חזותית חזקה מהשנייה הראשונה",
    coverHeight: 220,
    identity: "overlap",
    align: "start",
    logoSize: 96,
    order: ["gallery", "video", "smart_buttons", "services", "testimonials", "hours", "files", "contact_form"],
  },
  {
    id: "services",
    name: "שירותים ומחירים",
    audience: "מספרות, קליניקות, מוסכים — מי שנשאל קודם כל 'כמה זה עולה'",
    coverHeight: 120,
    identity: "overlap",
    align: "start",
    logoSize: 80,
    order: ["services", "hours", "smart_buttons", "gallery", "testimonials", "video", "files", "contact_form"],
  },
  {
    id: "portfolio",
    name: "תיק עבודות",
    audience: "צלמים, מעצבים, קבלני שיפוצים — מי שהתוצר שלו ויזואלי",
    coverHeight: 200,
    identity: "overlap",
    align: "start",
    logoSize: 84,
    order: ["gallery", "video", "testimonials", "services", "smart_buttons", "files", "hours", "contact_form"],
  },
  {
    id: "local",
    name: "עסק מקומי",
    audience: "בתי קפה, חנויות ומסעדות — מי שצריך שיגיעו אליו פיזית",
    coverHeight: 168,
    identity: "overlap",
    align: "start",
    logoSize: 84,
    order: ["hours", "gallery", "services", "smart_buttons", "testimonials", "files", "video", "contact_form"],
  },
];

const fallback = cardTemplates[0];

export function cardTemplate(id: string | undefined): CardTemplate {
  return cardTemplates.find((template) => template.id === id) || fallback;
}

export const cardTemplateIds = cardTemplates.map((template) => template.id);

/**
 * סידור המקטעים לפי התבנית.
 *
 * מקטע שאינו מופיע בסדר המוצע נשאר במקומו היחסי בסוף, ולכן תבנית
 * חדשה לעולם לא מעלימה מקטע — היא רק מזיזה.
 */
export function orderWidgets<T extends { type: CardWidgetType }>(widgets: T[], id: string | undefined): T[] {
  const order = cardTemplate(id).order;
  const rank = (type: CardWidgetType) => {
    const index = order.indexOf(type);
    return index === -1 ? order.length : index;
  };
  return [...widgets].sort((a, b) => rank(a.type) - rank(b.type));
}

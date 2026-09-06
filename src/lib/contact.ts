import { Bug, GraduationCap, HelpCircle, Lightbulb, ShoppingCart } from "lucide-react";

/** נושאי הפנייה בטופס "צרו קשר". הסדר הוא סדר התצוגה. */
export const contactTopics = [
  {
    id: "improvement",
    label: "המלצות ייעול ושיפור",
    description: "רעיון שיהפוך את המערכת לטובה יותר",
    icon: Lightbulb,
    placeholder: "מה הייתם משנים? מה חסר לכם בעבודה היומיומית?",
  },
  {
    id: "sales",
    label: "מכירות",
    description: "מסלולים, מחירים והתאמה לעסק",
    icon: ShoppingCart,
    placeholder: "כמה כרטיסים אתם צריכים? יש דרישות מיוחדות?",
  },
  {
    id: "training",
    label: "הדרכה",
    description: "ליווי והדרכה על השימוש במערכת",
    icon: GraduationCap,
    placeholder: "על מה תרצו הדרכה? כמה משתמשים ישתתפו?",
  },
  {
    id: "technical",
    label: "תקלה טכנית",
    description: "משהו לא עובד כמו שצריך",
    icon: Bug,
    placeholder: "מה קרה? באיזה מסך? מה ציפיתם שיקרה?",
  },
  {
    id: "general",
    label: "שאלה כללית",
    description: "כל דבר אחר",
    icon: HelpCircle,
    placeholder: "במה נוכל לעזור?",
  },
] as const;

export type ContactTopicId = (typeof contactTopics)[number]["id"];

export const contactTopicIds = contactTopics.map((topic) => topic.id) as [ContactTopicId, ...ContactTopicId[]];

export function topicLabel(id: string) {
  return contactTopics.find((topic) => topic.id === id)?.label || "שאלה כללית";
}

/** תקלה טכנית מקבלת עדיפות גבוהה יותר בתור. */
export function topicPriority(id: string) {
  return id === "technical" ? "high" : id === "sales" ? "normal" : "low";
}

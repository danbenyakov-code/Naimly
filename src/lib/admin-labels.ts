import { LEGAL_VERSION } from "@/lib/legal";
import { cycleMonths as configCycleMonths, type BillingCycle } from "@/lib/config";

/**
 * תוויות למסכי הניהול.
 *
 * מופרד מ-config ומ-legal כדי שרכיב לקוח יוכל לייבא אותן בלי לגרור
 * לדפדפן מודולים של שרת.
 */

export const cycleMonths = (cycle: BillingCycle) => configCycleMonths(cycle);

/**
 * גרסת המסמכים שאושרה, עם סימון כשהיא אינה הנוסח הנוכחי.
 *
 * מנהל שרואה רק מספר גרסה אינו יודע אם הוא עדכני. לקוח שאישר נוסח ישן
 * אינו חסום מתשלום, אבל זו עובדה שצריכה להיראות לפני אישור ההפעלה.
 */
export function LEGAL_VERSION_LABEL(version: string) {
  if (!version) return "לא תועדה גרסה";
  return version === LEGAL_VERSION ? `גרסה ${version}` : `גרסה ${version} (ישנה)`;
}

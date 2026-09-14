"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

/**
 * כפתור חזרה חכם (REQ-017).
 *
 * הכפתור אינו נשען על history.back בלבד. משתמש שהגיע בכניסה ישירה —
 * מקישור, מסריקת QR, מהודעה או מלשונית חדשה — אין לו היסטוריה לחזור
 * אליה, ו-back היה מוציא אותו מהאתר או לא עושה כלום. לכן:
 *
 *   1. אם העמוד הקודם הוא מאותו מקור — חוזרים אליו, וכך נשמר המקום
 *      שבו המשתמש היה (גלילה, לשונית פתוחה).
 *   2. אחרת — ניווט אל היעד ההגיוני שהוגדר לעמוד הזה.
 *
 * החץ הוא ArrowRight ולא ArrowLeft: בממשק ימין-לשמאל, "אחורה" הוא ימינה.
 */
export function BackButton({
  fallback,
  label = "חזרה",
  ariaLabel,
  className = "",
  beforeNavigate,
}: {
  /** היעד ההגיוני כשאין היסטוריה מאותו מקור. */
  fallback: string;
  label?: string;
  /** תיאור מלא לקורא מסך, כשהתווית לבדה אינה מספקת הקשר. */
  ariaLabel?: string;
  className?: string;
  /**
   * רץ לפני הניווט, לשמירת טיוטה ממתינה.
   *
   * בלי זה, יציאה ממסך עם שמירה אוטומטית בהשהיה הייתה מאבדת את
   * השינויים שנעשו בשניות האחרונות — בדיוק מה ש-REQ-017 אוסר.
   */
  beforeNavigate?: () => Promise<void> | void;
}) {
  const router = useRouter();

  async function goBack() {
    if (beforeNavigate) {
      try {
        await beforeNavigate();
      } catch {
        // כשל בשמירה לא נועל את המשתמש במסך; ההודעה מוצגת על ידי המסך עצמו.
      }
    }

    let sameOrigin = false;
    try {
      // referrer ריק בכניסה ישירה, ושונה כשמגיעים מאתר אחר.
      sameOrigin = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
    } catch {
      sameOrigin = false;
    }

    if (sameOrigin && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }

  return (
    <button
      type="button"
      onClick={() => void goBack()}
      aria-label={ariaLabel || `${label} — חזרה למסך הקודם`}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#dfe4ec] bg-white px-3 text-sm font-bold text-[#5f6d83] transition hover:border-[#6d4aff] hover:text-[#4b3bad] ${className}`}
    >
      <ArrowRight size={16} aria-hidden="true" />
      {label}
    </button>
  );
}

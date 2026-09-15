"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Cookie, Settings2, X } from "lucide-react";
import {
  CONSENT_EVENT,
  consentCategories,
  readConsent,
  writeConsent,
  type ConsentCategory,
} from "@/lib/consent";

/**
 * חלונית הסכמת העוגיות.
 *
 * REQ-004: שלוש קטגוריות מוצגות במפורש, ולכל אחת אפשר לומר לא. "קבלת
 * הכול" ו"דחיית הכול" מקבלים את אותו משקל ויזואלי — כפתור דחייה שנראה
 * חלש יותר מכפתור הקבלה הוא בדיוק מה שרשויות הגנת הפרטיות פוסלות
 * כ"דפוס אפל".
 *
 * אין כפתור סגירה שמשאיר את השאלה פתוחה: X היה נספר כהיעדר הסכמה אבל
 * משאיר את המשתמש בלי מושג מה נבחר. במקומו יש בחירה מפורשת.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [managing, setManaging] = useState(false);
  const [choice, setChoice] = useState<Record<ConsentCategory, boolean>>({
    analytics: false,
    marketing: false,
  });

  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    /*
     * הבדיקה רצה אחרי ההרכבה ולא בזמן הרינדור: localStorage אינו קיים
     * בשרת, וקריאה בזמן רינדור הייתה יוצרת אי-התאמה בהידרציה.
     */
    const frame = requestAnimationFrame(() => setVisible(readConsent() === null));
    return () => cancelAnimationFrame(frame);
  }, []);

  // פתיחת ההגדרות מחדש מדף מדיניות העוגיות.
  useEffect(() => {
    const reopen = () => {
      const current = readConsent();
      setChoice({ analytics: current?.analytics === true, marketing: current?.marketing === true });
      setManaging(true);
      setVisible(true);
    };
    window.addEventListener("naimly-consent-reopen", reopen);
    return () => window.removeEventListener("naimly-consent-reopen", reopen);
  }, []);

  // המיקוד עובר לחלונית כשנפתח הניהול, אחרת משתמש מקלדת לא יגיע אליה.
  useEffect(() => {
    if (managing) panelRef.current?.focus();
  }, [managing]);

  function decide(next: Record<ConsentCategory, boolean>) {
    writeConsent(next);
    setVisible(false);
    setManaging(false);
  }

  if (!visible) return null;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      /*
       * pb מותאם ל-safe area: בנייד עם סרגל מחוות iOS החלונית הייתה
       * נחתכת, והכפתור התחתון לא היה ניתן ללחיצה.
       */
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-[#d7deea] bg-white p-4 shadow-[0_18px_60px_rgba(11,24,48,.22)] sm:p-5"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 hidden shrink-0 rounded-xl bg-[#f1efff] p-2 text-[#6d4aff] sm:block">
          <Cookie size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-extrabold text-[#142038]">
            הפרטיות שלך בשליטתך
          </h2>
          <p id={descriptionId} className="mt-1 text-sm leading-6 text-[#5f6d83]">
            אחסון הכרחי משמש להפעלת האתר ולשמירת הבחירה הזו, ואי אפשר לכבות אותו.
            כלי מדידה ושיווק נטענים רק אם תאשר/י אותם.{" "}
            <Link href="/legal/cookies" className="font-bold text-[#6d4aff] underline underline-offset-2">
              מדיניות העוגיות
            </Link>
          </p>
        </div>
      </div>

      {managing && (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="mt-4 grid gap-2 rounded-xl border border-[#e5e9f1] bg-[#f8f9fc] p-3 outline-none"
        >
          <div className="flex items-start justify-between gap-3 rounded-lg bg-white p-3">
            <div className="min-w-0">
              <strong className="block text-sm">הכרחי</strong>
              <span className="text-xs leading-5 text-[#68758a]">
                התחברות, אבטחה ושמירת ההעדפה. נדרש לתפעול השירות.
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-[#eef7f4] px-2.5 py-1 text-xs font-bold text-[#0a7f6b]">
              תמיד פעיל
            </span>
          </div>

          {consentCategories.map((category) => (
            <label
              key={category.id}
              className="flex cursor-pointer items-start justify-between gap-3 rounded-lg bg-white p-3"
            >
              <span className="min-w-0">
                <strong className="block text-sm">{category.title}</strong>
                <span className="text-xs leading-5 text-[#68758a]">{category.description}</span>
              </span>
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#6d4aff]"
                checked={choice[category.id]}
                onChange={(event) =>
                  setChoice((previous) => ({ ...previous, [category.id]: event.target.checked }))
                }
              />
            </label>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:flex sm:justify-end">
        {managing ? (
          <>
            <button
              type="button"
              className="button-secondary min-h-11 px-4 text-sm"
              onClick={() => setManaging(false)}
            >
              <X size={15} aria-hidden="true" />
              ביטול
            </button>
            <button
              type="button"
              className="button-primary min-h-11 px-4 text-sm"
              onClick={() => decide(choice)}
            >
              שמירת הבחירה
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="button-secondary min-h-11 px-4 text-sm"
              onClick={() => {
                setChoice({ analytics: false, marketing: false });
                setManaging(true);
              }}
            >
              <Settings2 size={15} aria-hidden="true" />
              ניהול מפורט
            </button>
            {/* דחייה וקבלה באותו גודל ובאותה בולטות. */}
            <button
              type="button"
              className="button-secondary min-h-11 px-4 text-sm"
              onClick={() => decide({ analytics: false, marketing: false })}
            >
              דחיית הכול
            </button>
            <button
              type="button"
              className="button-primary min-h-11 px-4 text-sm"
              onClick={() => decide({ analytics: true, marketing: true })}
            >
              קבלת הכול
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

/** משמש את דף המדיניות כדי לפתוח את החלונית מחדש. */
export const CONSENT_REOPEN_EVENT = "naimly-consent-reopen";
export { CONSENT_EVENT };

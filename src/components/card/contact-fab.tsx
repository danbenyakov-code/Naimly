"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, MessageSquareText, X } from "lucide-react";
import { actionHref, actionIcons, defaultActions, opensInSameTab } from "@/lib/card-actions";
import { usableActions } from "@/lib/contact-source";
import type { CardData, QuickAction } from "@/lib/types";
import { cardStrings, toCardLanguage } from "@/lib/card-i18n";

/**
 * כפתור צף אחד לכל דרכי ההתקשרות (REQ-024).
 *
 * במקום שורה של כפתורים צפים שמתחרים זה בזה ומכסים את התוכן, יש כפתור
 * אחד — "צור קשר" — שפותח תפריט. כך הכרטיס נשאר קריא, ויש נקודת פעולה
 * אחת ברורה שנמצאת תמיד במקום קבוע.
 *
 * הפעולות נגזרות מאותו מקור שמזין את הכרטיס עצמו, ולכן התפריט לעולם
 * לא יציג ערוץ שאין לו יעד תקין — קישור שבור גרוע מהיעדר כפתור.
 */
export function ContactFab({ card, onAction }: { card: CardData; onAction?: (type: string) => void }) {
  const t = cardStrings(toCardLanguage(card.language));
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const firstItemRef = useRef<HTMLAnchorElement | null>(null);
  const menuId = useId();

  /*
   * הפעולות שהוגדרו, ואם אין כאלה — ברירת המחדל הנגזרת מפרטי הכרטיס.
   * usableActions מסנן כל פעולה שאין לה יעד שניתן לפתוח.
   */
  const configured = card.quickActions.length ? usableActions(card) : defaultActions(card);
  const actions: QuickAction[] = configured.filter((action) => Boolean(actionHref(action, card)));

  // סגירה ב-Escape והחזרת המיקוד לכפתור, אחרת משתמש מקלדת נשאר תלוי.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  // המיקוד עובר לפריט הראשון בפתיחה.
  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  // בלי פעולות אין מה לפתוח, וכפתור ריק רק מכסה תוכן.
  if (!actions.length) return null;

  return (
    <div
      ref={containerRef}
      className="fixed bottom-0 z-50 flex flex-col items-end gap-2"
      /*
       * מיקום לוגי: end נקבע לפי כיוון הדף, כך שבעברית הכפתור נוחת
       * בצד אחד ובאנגלית בצד השני בלי קוד נפרד.
       *
       * ה-padding התחתון מכבד את ה-safe area: במכשירים עם סרגל מחוות
       * הכפתור היה יושב מתחת לאזור הלחיץ.
       */
      style={{
        insetInlineEnd: "1rem",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      {open && (
        <ul
          id={menuId}
          className="mb-1 grid max-h-[60vh] w-60 gap-1 overflow-y-auto rounded-2xl border border-black/5 bg-white p-2 shadow-[0_18px_50px_rgba(11,24,48,.24)]"
        >
          {actions.map((action, index) => {
            const Icon = actionIcons[action.type] ?? ExternalLink;
            const href = actionHref(action, card);
            const internal = opensInSameTab(action.type);

            return (
              <li key={action.id}>
                <a
                  ref={index === 0 ? firstItemRef : undefined}
                  href={href}
                  target={internal ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  onClick={() => {
                    onAction?.(action.type === "save_contact" ? "contact_save" : action.type);
                    setOpen(false);
                  }}
                  className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-[#33415c] transition hover:bg-[#f4f5fa] focus-visible:bg-[#f4f5fa]"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
                    style={{ background: "var(--card-primary)" }}
                  >
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 truncate">{action.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={open ? t.contactFabCloseLabel : t.contactFabOpen}
        className="flex min-h-13 items-center gap-2 rounded-full px-5 text-sm font-extrabold text-white shadow-[0_14px_34px_rgba(11,24,48,.3)] transition active:scale-[.97]"
        style={{ background: "var(--card-primary)" }}
      >
        {open ? <X size={19} aria-hidden="true" /> : <MessageSquareText size={19} aria-hidden="true" />}
        {open ? t.contactFabClose : t.contactFab}
      </button>
    </div>
  );
}

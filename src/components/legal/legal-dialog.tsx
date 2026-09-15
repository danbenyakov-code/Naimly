"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { TermsBody } from "@/components/legal/documents/terms-body";
import { PrivacyBody } from "@/components/legal/documents/privacy-body";
import { AcceptableUseBody } from "@/components/legal/documents/acceptable-use-body";
import { RefundBody } from "@/components/legal/documents/refund-body";
import { CookiesBody } from "@/components/legal/documents/cookies-body";
import { legalDocuments, type LegalDocId } from "@/lib/legal";

/**
 * מסמך משפטי בחלונית, מתוך טופס (REQ-016).
 *
 * הקישור הקודם היה target="_blank": הוא הוציא את הלקוח מהטופס, ובנייד
 * לשונית חדשה פירושה לעיתים קרובות אובדן מה שהוקלד. החלונית משאירה את
 * מצב הטופס בדיוק כפי שהיה — היא לא מנווטת לשום מקום.
 *
 * התוכן מיובא מאותם רכיבים שמרנדרים את העמוד המלא, ולכן אין שתי גרסאות
 * של אותו נוסח.
 */
const bodies: Record<LegalDocId, () => React.JSX.Element> = {
  terms: TermsBody,
  privacy: PrivacyBody,
  "acceptable-use": AcceptableUseBody,
  refund: RefundBody,
  cookies: CookiesBody,
  // אין עמוד נגישות ייעודי; הערך קיים בטיפוס בלבד.
  accessibility: TermsBody,
};

export function LegalDialog({
  docId,
  onClose,
}: {
  docId: LegalDocId;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const doc = legalDocuments.find((item) => item.id === docId);
  const Body = bodies[docId];

  useEffect(() => {
    closeRef.current?.focus();

    /*
     * לכידת מיקוד: בלעדיה Tab יוצא מהחלונית אל הטופס שמאחוריה, ומשתמש
     * מקלדת "מאבד" את הדיאלוג בלי דרך לחזור אליו.
     */
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    // נעילת הגלילה מאחור, אחרת הדף זז בזמן שקוראים את המסמך.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-[#071020]/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_30px_90px_rgba(11,24,48,.3)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#e5e9f1] p-4 sm:p-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-black tracking-[-0.03em]">
              {doc?.title || "מסמך משפטי"}
            </h2>
            {doc?.summary && <p className="mt-0.5 text-xs leading-5 text-[#78859a]">{doc.summary}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="סגירת המסמך וחזרה לטופס"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f0f2f6] text-[#33415c]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* tabIndex מאפשר גלילה במקלדת גם כשאין בתוכן אלמנט ממוקד. */}
        <div tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 text-[#46556c] [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-[#142038] [&_li]:mb-2 [&_p]:mb-4 [&_p]:leading-8 [&_ul]:mr-5 [&_ul]:list-disc sm:p-6">
          <Body />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e9f1] p-4">
          {doc && (
            <a
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[#6d4aff]"
            >
              <ExternalLink size={15} aria-hidden="true" />
              פתיחה בעמוד מלא
            </a>
          )}
          <button type="button" onClick={onClose} className="button-primary min-h-11 px-5 text-sm">
            חזרה לטופס
          </button>
        </footer>
      </div>
    </div>
  );
}

/** קישור שפותח את המסמך בחלונית במקום לנווט. */
export function LegalLink({ docId, children }: { docId: LegalDocId; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-bold text-[#6d4aff] underline underline-offset-2"
      >
        {children}
      </button>
      {open && <LegalDialog docId={docId} onClose={() => setOpen(false)} />}
    </>
  );
}

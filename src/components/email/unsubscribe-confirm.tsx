"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type State = { status: "pending" } | { status: "done" } | { status: "error"; message: string };

/**
 * ההסרה מתבצעת כאן, בדפדפן, ולא בטעינת העמוד בשרת: סורקי קישורים של
 * תיבות דואר פותחים כל קישור במייל, ואסור שפתיחה כזו תסיר לקוח.
 */
export function UnsubscribeConfirm({ token }: { token: string }) {
  const [state, setState] = useState<State>({ status: "pending" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (cancelled) return;
        setState(response.ok && body?.ok ? { status: "done" } : { status: "error", message: body?.error || "משהו השתבש. אפשר לנסות שוב." });
      })
      .catch(() => { if (!cancelled) setState({ status: "error", message: "אין חיבור כרגע. אפשר לנסות שוב בעוד רגע." }); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <section className="card-surface p-6 text-center sm:p-8" aria-live="polite">
      {state.status === "pending" && (
        <>
          <Loader2 size={36} className="mx-auto animate-spin text-[#6d4aff]" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-extrabold">מסירים אותך מהרשימה…</h1>
        </>
      )}
      {state.status === "done" && (
        <>
          <CheckCircle2 size={44} className="mx-auto text-[#0a9b81]" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-black tracking-[-0.03em]">הוסרת מרשימת התפוצה</h1>
          <p className="mt-3 leading-7 text-[#4a5871]">
            לא נשלח לך יותר תזכורות, דוחות או עדכונים.
            מיילים חיוניים על החשבון ימשיכו להגיע: קוד אימות, איפוס סיסמה, אישורי תשלום והתראות על פניות מהכרטיס.
          </p>
          <Link href="/dashboard/settings/notifications" className="button-secondary mt-6 min-h-12 w-full">
            ניהול העדפות דיוור
          </Link>
        </>
      )}
      {state.status === "error" && (
        <>
          <XCircle size={44} className="mx-auto text-[#b7293a]" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-extrabold">לא הצלחנו להסיר אותך</h1>
          <p className="mt-3 leading-7 text-[#4a5871]">{state.message}</p>
          <Link href="/dashboard/settings/notifications" className="button-secondary mt-6 min-h-12 w-full">
            לניהול העדפות דיוור
          </Link>
        </>
      )}
    </section>
  );
}

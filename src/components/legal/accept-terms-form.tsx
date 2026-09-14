"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2, ShieldCheck } from "lucide-react";
import { FormAlert } from "@/components/ui/field";
import { legalDocuments } from "@/lib/legal";
import { acceptTermsAction, type AcceptResult } from "@/app/legal/accept/actions";

/**
 * אישור הנוסח המעודכן.
 *
 * אין כאן כפתור "אחר כך". הסכמה לנוסח קודם אינה הסכמה לנוסח הנוכחי,
 * ותזכורת שאפשר לסגור הייתה משאירה את המערכת פעילה תחת נוסח שהלקוח
 * מעולם לא אישר — בדיוק המצב שהאישור אמור למנוע.
 */
export function AcceptTermsForm({
  fullName,
  previousVersion,
  currentVersion,
  next,
}: {
  fullName: string;
  previousVersion?: string;
  currentVersion: string;
  next: string;
}) {
  const [state, submit, pending] = useActionState<AcceptResult, FormData>(acceptTermsAction, null);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="card-surface p-6 sm:p-9">
        <span className="eyebrow">עדכון מסמכים</span>
        <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
          {fullName ? `${fullName}, ` : ""}עדכנו את תנאי השימוש
        </h1>
        <p className="mt-3 leading-7 text-[#5f6d83]">
          פרסמנו נוסח מעודכן של המסמכים המשפטיים. כדי להמשיך להשתמש במערכת יש לאשר
          אותו. האישור שנתת בעבר תקף לנוסח הקודם בלבד, ולכן הוא נרשם בנפרד.
        </p>

        <dl className="mt-5 grid gap-2 rounded-2xl border border-[#dfe4ec] bg-[#f8f9fc] p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold text-[#8b96a8]">הנוסח שאישרת</dt>
            <dd className="font-bold" dir="ltr">{previousVersion || "טרם אושר נוסח"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-[#8b96a8]">הנוסח המעודכן</dt>
            <dd className="font-bold text-[#4b3bad]" dir="ltr">{currentVersion}</dd>
          </div>
        </dl>

        {state?.ok === false && (
          <div className="mt-5">
            <FormAlert tone="error">{state.error}</FormAlert>
          </div>
        )}

        <ul className="mt-6 grid gap-2">
          {legalDocuments.map((doc) => (
            <li key={doc.id}>
              <Link
                href={doc.href}
                target="_blank"
                className="flex min-h-12 items-center gap-2.5 rounded-xl border border-[#dfe4ec] px-4 text-sm font-bold text-[#33415c] transition hover:border-[#6d4aff] hover:text-[#4b3bad]"
              >
                <FileText size={16} className="shrink-0 text-[#6d4aff]" aria-hidden="true" />
                {doc.title}
              </Link>
            </li>
          ))}
        </ul>

        {/* noValidate משאיר את הודעת השגיאה בעברית שלנו במקום זו של הדפדפן. */}
        <form action={submit} noValidate className="mt-6">
          <input type="hidden" name="next" value={next} />

          <label
            className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-4 text-sm leading-6"
            style={{ borderColor: state?.ok === false ? "#c9304a" : "#dfe4ec" }}
          >
            <input
              type="checkbox"
              name="terms"
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#6d4aff]"
              aria-invalid={state?.ok === false}
            />
            <span className="text-[#4a5871]">
              קראתי ואני מאשר/ת את הנוסח המעודכן של תנאי השימוש, מדיניות הפרטיות,
              מדיניות השימוש המותר, מדיניות הביטולים ומדיניות העוגיות.
            </span>
          </label>

          <button type="submit" disabled={pending} className="button-primary mt-4 min-h-13 w-full">
            {pending ? (
              <>
                <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                רושמים את האישור…
              </>
            ) : (
              <>
                אישור והמשך
                <ArrowLeft size={17} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#758198]">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          האישור נרשם עם גרסת המסמכים, חותמת זמן וכתובת ה־IP שממנה ניתן, ונשמר כתיעוד קבוע.
        </p>
      </div>
    </div>
  );
}

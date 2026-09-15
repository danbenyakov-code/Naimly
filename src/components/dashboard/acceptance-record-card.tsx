"use client";

import { useState } from "react";
import { FileCheck2, Loader2, Mail } from "lucide-react";

/**
 * רשומת ההסכמה של הלקוח, והאפשרות לקבל אותה במייל (REQ-012).
 *
 * תיעוד שקיים במסד אך רק המנהל רואה אינו עונה על הדרישה: הלקוח צריך
 * להיות מסוגל להוכיח בעצמו למה הסכים, מתי, ובאיזו גרסה.
 */
export function AcceptanceRecordCard({
  version,
  acceptedAt,
  email,
  demo,
}: {
  version?: string;
  acceptedAt?: string;
  email: string;
  demo: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const stamp = acceptedAt
    ? new Date(acceptedAt).toLocaleString("he-IL", { dateStyle: "long", timeStyle: "short" })
    : "";

  async function sendCopy() {
    setSending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/legal/my-acceptance", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        setNotice({ ok: false, text: result.error || "לא הצלחנו לשלוח את האישור" });
        return;
      }
      setNotice({ ok: true, text: `האישור נשלח לכתובת ${result.target}` });
    } catch {
      setNotice({ ok: false, text: "אין חיבור לרשת. אפשר לנסות שוב." });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card-surface p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef7f4] text-[#0a7f6b]">
          <FileCheck2 size={21} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-extrabold">אישור תנאי השימוש</h2>
          <p className="text-xs text-[#7d8899]">התיעוד של ההסכמה שנתת, לשמירה אצלך.</p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#e5e9f1] p-3">
          <dt className="text-xs font-bold text-[#8b96a8]">גרסת המסמכים</dt>
          <dd className="mt-0.5 font-bold" dir="ltr">{version || "טרם אושר"}</dd>
        </div>
        <div className="rounded-xl border border-[#e5e9f1] p-3">
          <dt className="text-xs font-bold text-[#8b96a8]">מועד האישור</dt>
          <dd className="mt-0.5 font-bold">{stamp || "—"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="button-secondary min-h-11"
          onClick={() => void sendCopy()}
          disabled={sending || demo || !version}
        >
          {sending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
          {sending ? "שולחים…" : "שליחת אישור למייל שלי"}
        </button>
        {notice && (
          <span role="status" className={notice.ok ? "text-sm font-bold text-[#08735f]" : "text-sm font-bold text-[#a32031]"}>
            {notice.text}
          </span>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-[#8b96a8]">
        האישור יישלח לכתובת <span dir="ltr">{email}</span> ויכלול את הגרסה, המועד, כתובת ה־IP
        ומזהה לציטוט.
      </p>
    </section>
  );
}

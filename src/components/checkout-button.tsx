"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Clock3, Copy, Loader2, ShieldCheck } from "lucide-react";
import type { PlanId } from "@/lib/types";
import { fireworks } from "@/lib/celebrate";
import { legalDocuments } from "@/lib/legal";
import type { BillingCycle } from "@/lib/config";
import { LegalLink } from "@/components/legal/legal-dialog";

type Opened = { reference: string; status: string; reused?: boolean };

/**
 * אין סליקה באתר, ואין תשלום מיידי בלחיצה כאן.
 *
 * הכפתור פותח **בקשת רכישה** בלבד, בסטטוס pending_admin_review. מנהל
 * בודק את הבקשה ושולח קישור תשלום מתוך /admin/payments — רק אז הלקוח
 * מקבל הוראות תשלום, ורק אחרי אימות ידני של המנהל המנוי מופעל. ראו
 * "תהליך רכישה ותשלומים ידניים" ב-docs/qa.
 */
export function CheckoutButton({
  planId,
  planName,
  price,
  cycle = "monthly",
}: {
  planId: PlanId | "extra_card";
  planName: string;
  /** הסכום שייגבה בפועל למחזור הנבחר, כפי שחושב בשרת. */
  price: number;
  cycle?: BillingCycle;
}) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [opened, setOpened] = useState<Opened | null>(null);
  const [copied, setCopied] = useState(false);

  async function start() {
    // האישור נאכף גם בשרת; כאן רק מונעים בקשה שתידחה ממילא.
    if (!accepted) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payments/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, cycle, phone: phone.trim() || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "לא הצלחנו לפתוח את בקשת הרכישה");
      setOpened(result);
      fireworks({ bursts: 3 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "אירעה שגיאה");
    } finally {
      setLoading(false);
    }
  }

  async function copyReference() {
    if (!opened) return;
    try {
      await navigator.clipboard.writeText(opened.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("לא הצלחנו להעתיק. אפשר לסמן ולהעתיק ידנית.");
    }
  }

  if (opened) {
    return (
      <div className="rounded-2xl border border-[#b7e6d8] bg-[#effcf8] p-4 sm:p-5">
        <p className="flex items-center gap-2 font-extrabold text-[#08735f]">
          <Check size={18} />בקשת הרכישה התקבלה
        </p>
        <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-[#0b6353]">
          <Clock3 size={16} className="mt-0.5 shrink-0" />
          אנחנו בודקים את הפרטים לתשלום של {price} ש״ח ונשלח אליך קישור לתשלום בהקדם, במייל. <strong>בשלב זה החבילה עדיין אינה פעילה.</strong>
        </p>

        <div className="mt-4 rounded-xl border border-[#b7e6d8] bg-white p-3">
          <span className="text-xs font-bold text-[#5f6d83]">מספר עסקה — לציין בכל פנייה</span>
          <div className="mt-1 flex items-center justify-between gap-3">
            <strong dir="ltr" className="font-mono text-lg tracking-wider">{opened.reference}</strong>
            <button type="button" onClick={copyReference} className="button-secondary min-h-11 shrink-0 px-3 text-xs">
              {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "הועתק" : "העתקה"}
            </button>
          </div>
        </div>

        <Link href="/dashboard/orders" className="button-primary mt-4 min-h-13 w-full">מעקב אחר ההזמנה<ArrowLeft size={16} /></Link>
        <Link href="/dashboard" className="button-secondary mt-2 min-h-12 w-full">חזרה לאזור האישי</Link>
      </div>
    );
  }

  return (
    <div>
      {error && <p role="alert" className="mb-3 rounded-xl bg-[#fff2f4] p-3 text-sm text-[#a32031]">{error}</p>}

      <label className="field-label">
        <span>טלפון לוואטסאפ <span className="font-normal text-[#8b96a8]">(לא חובה — נשלח אליו את פרטי ההפעלה)</span></span>
        <input
          className="field-input"
          type="tel"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="050-0000000"
          maxLength={30}
        />
      </label>

      <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#dfe4ec] p-3 text-xs leading-6">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#6d4aff]"
        />
        <span className="text-[#4a5871]">
          קראתי ואני מאשר/ת את{" "}
          {legalDocuments.map((doc, index) => (
            <span key={doc.id}>
              {/* REQ-016: חלונית ולא לשונית חדשה. */}
              <LegalLink docId={doc.id}>{doc.title}</LegalLink>
              {index < legalDocuments.length - 2 ? ", " : index === legalDocuments.length - 2 ? " ו" : ""}
            </span>
          ))}
          , ואני מודע/ת לכך שהמנוי מתחדש אוטומטית {cycle === "annual" ? "מדי שנה" : "מדי חודש"} עד לביטולו.
        </span>
      </label>

      <button type="button" className="button-primary mt-4 min-h-14 w-full" onClick={start} disabled={loading || !accepted}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : null}
        {loading ? "שולחים בקשה..." : `שליחת בקשת רכישה — ${planName}`}
        {!loading && <ArrowLeft size={18} />}
      </button>

      <p className="mt-3 flex items-start justify-center gap-2 text-center text-xs leading-5 text-[#758198]">
        <ShieldCheck size={15} className="mt-0.5 shrink-0" />
        התשלום מתבצע ישירות מול העסק לאחר בדיקת הבקשה. המערכת אינה שומרת פרטי אשראי.
      </p>
    </div>
  );
}

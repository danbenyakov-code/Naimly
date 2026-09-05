"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import type { PlanId } from "@/lib/types";

type Opened = { reference: string; whatsappUrl: string; bitPhone: string; reused?: boolean };

/**
 * אין סליקה באתר. הכפתור פותח בקשת תשלום עם אסמכתא, ומעביר לוואטסאפ
 * כדי להשלים את ההעברה בביט מול העסק. ההפעלה מתבצעת לאחר אישור מנהל.
 */
export function CheckoutButton({ planId, planName, price }: { planId: PlanId; planName: string; price: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [opened, setOpened] = useState<Opened | null>(null);
  const [copied, setCopied] = useState(false);

  async function start() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payments/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, phone: phone.trim() || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "לא הצלחנו לפתוח את בקשת התשלום");
      setOpened(result);
      // פתיחה בלשונית חדשה כדי שדף ההזמנה יישאר פתוח עם האסמכתא.
      if (result.whatsappUrl) window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
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
          <Check size={18} />בקשת התשלום נפתחה
        </p>
        <ol className="mt-3 grid gap-2 text-sm leading-6 text-[#0b6353]">
          <li>1. שולחים את ההודעה שנפתחה בוואטסאפ.</li>
          <li>2. מעבירים {price} ש״ח בביט{opened.bitPhone ? ` למספר ${opened.bitPhone}` : ""}.</li>
          <li>3. מצרפים צילום מסך של ההעברה בצ׳אט.</li>
          <li>4. אנחנו מאשרים והמסלול נפתח — בדרך כלל תוך שעות ספורות.</li>
        </ol>

        <div className="mt-4 rounded-xl border border-[#b7e6d8] bg-white p-3">
          <span className="text-xs font-bold text-[#5f6d83]">מספר אסמכתא — לציין בהעברה</span>
          <div className="mt-1 flex items-center justify-between gap-3">
            <strong dir="ltr" className="font-mono text-lg tracking-wider">{opened.reference}</strong>
            <button type="button" onClick={copyReference} className="button-secondary min-h-11 shrink-0 px-3 text-xs">
              {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "הועתק" : "העתקה"}
            </button>
          </div>
        </div>

        {opened.whatsappUrl && (
          <a href={opened.whatsappUrl} target="_blank" rel="noopener noreferrer" className="button-primary mt-4 min-h-13 w-full">
            <MessageCircle size={18} />פתיחת הוואטסאפ שוב
          </a>
        )}
        <Link href="/dashboard" className="button-secondary mt-2 min-h-12 w-full">חזרה לאזור האישי<ArrowLeft size={16} /></Link>
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

      <button type="button" className="button-primary mt-4 min-h-14 w-full" onClick={start} disabled={loading}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
        {loading ? "פותחים בקשה..." : `תשלום בביט — ${planName}`}
        {!loading && <ArrowLeft size={18} />}
      </button>

      <p className="mt-3 flex items-start justify-center gap-2 text-center text-xs leading-5 text-[#758198]">
        <ShieldCheck size={15} className="mt-0.5 shrink-0" />
        התשלום מתבצע ישירות בביט מול העסק. המערכת אינה שומרת פרטי אשראי.
      </p>
    </div>
  );
}

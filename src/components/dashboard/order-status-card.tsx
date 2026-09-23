"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, ExternalLink, Loader2, Mail, MessageCircle } from "lucide-react";
import type { PaymentRequestRecord } from "@/lib/admin-data";
import { customerStatusMessage, purchaseStatusLabels } from "@/lib/purchase-workflow";
import { cn, formatCurrency } from "@/lib/utils";
import { brand } from "@/lib/config";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

const toneByStatus: Record<string, string> = {
  active: "border-[#b7e6d8] bg-[#effcf8]",
  rejected: "border-[#f0bdc3] bg-[#fff2f4]",
  cancelled: "border-[#e2e6ee] bg-[#f6f7fa]",
  expired: "border-[#e2e6ee] bg-[#f6f7fa]",
};

/**
 * מסך "ההזמנה שלי". הטקסט המדויק לכל סטטוס מגיע מ-customerStatusMessage
 * (purchase-workflow.ts) — אותו מקור שהמיילים משתמשים בו, כדי שלא
 * ייווצר פער בין מה שכתוב באתר למה שנשלח במייל.
 *
 * "שילמתי" היא הפעולה היחידה שהלקוח יכול לבצע כאן. היא לא מפעילה
 * שום דבר — רק מסמנת דיווח, וממתינה לבדיקה ידנית של מנהל.
 */
export function OrderStatusCard({ order }: { order: PaymentRequestRecord }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reported, setReported] = useState(order.status !== "payment_link_sent");

  async function reportPaid() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}/report-paid`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "לא הצלחנו לעדכן");
      setReported(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "אירעה שגיאה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={cn("card-surface border p-4 sm:p-5", toneByStatus[order.status] || "border-[#dfe4ec]")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong className="block">{order.planNameSnapshot || order.planId}</strong>
          <span className="mt-0.5 block text-xs text-[#7d8899]">מספר עסקה: <span dir="ltr" className="font-mono">{order.reference}</span></span>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4b3bad] shadow-sm">{purchaseStatusLabels[order.status]}</span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><dt className="text-xs text-[#8b96a8]">תקופת חיוב</dt><dd className="text-sm font-semibold">{order.billingCycle === "annual" ? "שנתי" : "חודשי"}</dd></div>
        <div><dt className="text-xs text-[#8b96a8]">סכום</dt><dd className="text-sm font-semibold">{formatCurrency(order.amount)}</dd></div>
        <div><dt className="text-xs text-[#8b96a8]">נפתח</dt><dd className="text-sm font-semibold">{formatDate(order.createdAt)}</dd></div>
        {order.activatedAt && <div><dt className="text-xs text-[#8b96a8]">הופעל</dt><dd className="text-sm font-semibold">{formatDate(order.activatedAt)}</dd></div>}
      </dl>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/70 p-3 text-sm leading-6 text-[#4a5871]">
        {order.status === "active" ? <Check size={16} className="mt-0.5 shrink-0 text-[#08735f]" /> : <Clock3 size={16} className="mt-0.5 shrink-0 text-[#8a5a00]" />}
        {customerStatusMessage[order.status]}
      </p>

      {error && <p role="alert" className="mt-2 text-sm text-[#a32031]">{error}</p>}

      {order.status === "payment_link_sent" && order.paymentLink && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <a href={order.paymentLink} target="_blank" rel="noopener noreferrer" className="button-primary min-h-12 flex-1">
            <ExternalLink size={16} />פתיחת קישור התשלום
          </a>
          {!reported && (
            <button type="button" disabled={busy} onClick={reportPaid} className="button-secondary min-h-12 flex-1">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}שילמתי — שליחה לבדיקה
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#7d8899]">
        <span className="flex items-center gap-1"><Mail size={13} />{brand.supportEmail}</span>
        {brand.supportWhatsapp && <span className="flex items-center gap-1"><MessageCircle size={13} />{brand.supportWhatsapp}</span>}
      </div>
    </article>
  );
}

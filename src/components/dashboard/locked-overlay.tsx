"use client";

import Link from "next/link";
import { ArrowLeft, Lock, MessageCircle } from "lucide-react";
import type { AccessReason } from "@/lib/plan-access";
import { lockMessages } from "@/lib/plan-access";

const titles: Record<AccessReason, string> = {
  active: "",
  trial: "",
  trial_expired: "תקופת ההתנסות הסתיימה",
  payment_pending: "התשלום ממתין לאישור",
  inactive: "המנוי אינו פעיל",
};

/**
 * באנר נעילה מלאה. מוצג כשאין מנוי בתוקף — אז אין עריכה, אין העלאה,
 * והכרטיס הציבורי מושהה. תמיד מוביל לרכישה.
 */
export function LockedOverlay({ reason }: { reason: AccessReason }) {
  const pending = reason === "payment_pending";

  return (
    <div role="alert" className="mt-4 rounded-2xl border border-[#f0bdc3] bg-[#fff2f4] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#a32031]">
            {pending ? <MessageCircle size={19} /> : <Lock size={19} />}
          </span>
          <div className="min-w-0">
            <strong className="block text-[#8d1f2e]">{titles[reason] || "המנוי אינו פעיל"}</strong>
            <p className="mt-1 text-sm leading-6 text-[#a2434f]">{lockMessages[reason]}</p>
          </div>
        </div>
        {!pending && (
          <Link href="/pricing" className="button-primary min-h-12 w-full shrink-0 sm:w-auto">
            בחירת מסלול<ArrowLeft size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}

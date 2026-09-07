import Link from "next/link";
import { ArrowLeft, Rocket } from "lucide-react";
import { TRIAL_DAYS } from "@/lib/plan-access";

/**
 * מוצג למי שנרשם וטרם פרסם. הספירה מתחילה בפרסום הראשון, ולכן אין כאן
 * טיימר — הצגת שעון שאינו רץ הייתה מבלבלת.
 */
export function TrialPendingNotice() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#d8d0ff] bg-[#f3f0ff] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-[#4636a6]" aria-hidden="true"><Rocket size={19} /></span>
        <div className="min-w-0">
          <strong className="block text-[#4636a6]">{TRIAL_DAYS} ימי ההתנסות עוד לא התחילו</strong>
          <p className="mt-0.5 text-sm leading-6 text-[#5d5188]">
            הספירה מתחילה רק כשתפרסם את הכרטיס בפעם הראשונה — אפשר לבנות אותו בנחת, בלי לחץ של זמן.
            עד אז כל היכולות פתוחות.
          </p>
        </div>
      </div>

      <Link href="/dashboard/card" className="button-primary min-h-12 w-full shrink-0 sm:w-auto">
        בניית הכרטיס<ArrowLeft size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}

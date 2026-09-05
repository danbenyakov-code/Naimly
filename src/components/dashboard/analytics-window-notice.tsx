"use client";

import { History, Lock } from "lucide-react";
import { planLimits, planName, requiredPlanForLimit } from "@/lib/plan-access";
import { useUpgrade } from "@/components/upgrade-dialog";

/** מסביר במפורש עד כמה אחורה המסלול שומר נתונים, ומציע שדרוג כשיש חלון ארוך יותר. */
export function AnalyticsWindowNotice({ planLabel, days }: { planLabel: string; days: number }) {
  const { requestUpgrade } = useUpgrade();
  const nextPlan = requiredPlanForLimit("analyticsDays", days + 1);
  const nextDays = planLimits(nextPlan).analyticsDays;
  if (nextDays <= days) return null;

  const format = (value: number) => (value >= 365 ? `${Math.round(value / 365)} שנים` : `${value} ימים`);

  return (
    <button
      type="button"
      onClick={() => requestUpgrade({
        title: `היסטוריית נתונים ל‑${format(nextDays)}`,
        description: `מסלול ${planLabel} שומר נתונים ל‑${format(days)} אחורה. מסלול ${planName(nextPlan)} מרחיב את ההיסטוריה ל‑${format(nextDays)}, כולל הנתונים שכבר נאספו.`,
        requiredPlan: nextPlan,
      })}
      className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#d5cdf5] bg-[#faf9ff] p-3 text-right text-sm hover:bg-[#f5f2ff]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f1efff] text-[#6d4aff]"><History size={17} /></span>
      <span className="flex-1">
        <strong className="block text-[#4b3bad]">היסטוריה ארוכה יותר זמינה במסלול {planName(nextPlan)}</strong>
        <span className="text-xs text-[#78859a]">כרגע נשמרים {format(days)} אחורה. שדרוג מרחיב ל‑{format(nextDays)}.</span>
      </span>
      <Lock size={15} className="shrink-0 text-[#8b7fd4]" />
    </button>
  );
}

"use client";

import { Check, Lock } from "lucide-react";
import type { FeatureKey } from "@/lib/plan-access";
import { featureLabels, planFeatures, planLimits, planName, requiredPlanForFeature, requiredPlanForLimit } from "@/lib/plan-access";
import type { PlanId } from "@/lib/types";
import { useUpgrade } from "@/components/upgrade-dialog";
import { cn } from "@/lib/utils";

const shownFeatures: FeatureKey[] = ["smartButtons", "video", "carousel", "files", "tracking", "seo", "leadExport", "prioritySupport"];

/** מציג במפורש מה כלול במסלול ומה נעול — כל שורה נעולה פותחת את פופאפ הרכישה. */
export function PlanSummaryCard({ plan, locked = false, galleryUsed, quickActionsUsed }: { plan: PlanId; locked?: boolean; galleryUsed: number; quickActionsUsed: number }) {
  const { requestUpgrade } = useUpgrade();
  const limits = planLimits(plan);
  // כשאין מנוי פעיל, אין יכולות פתוחות בכלל.
  const features = locked
    ? (Object.fromEntries(shownFeatures.map((key) => [key, false])) as Record<FeatureKey, boolean>)
    : planFeatures(plan);

  const usage = [
    { label: "תמונות בגלריה", used: galleryUsed, max: limits.galleryItems, key: "galleryItems" as const },
    { label: "פעולות מהירות", used: quickActionsUsed, max: limits.quickActions, key: "quickActions" as const },
  ];

  return (
    <article className="card-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#6d4aff]">המסלול שלך</p>
          <h2 className="mt-1 text-lg font-extrabold sm:text-xl">
            {plan === "trial" ? "התנסות — כל היכולות פתוחות" : `מסלול ${planName(plan)}`}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => requestUpgrade({ title: "בחירת מסלול", description: "השוואה מלאה בין המסלולים, כולל מה שנשמר ומה שיוסר מהכרטיס שבנית.", requiredPlan: "basic" })}
          className="button-secondary min-h-11 w-full sm:w-auto"
        >
          השוואה ושדרוג
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {usage.map((item) => {
          const percent = item.max ? Math.min(100, Math.round((item.used / item.max) * 100)) : 0;
          const full = item.max > 0 && item.used >= item.max;
          return (
            <div key={item.label} className="rounded-2xl border border-[#e4e8f0] p-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-bold">{item.label}</span>
                <span className={cn("shrink-0 tabular-nums", full ? "font-bold text-[#a73342]" : "text-[#68758a]")} dir="ltr">{item.used} / {item.max}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef0f6]">
                <div className={cn("h-full rounded-full", full ? "bg-[#e05a6c]" : "bg-[#6d4aff]")} style={{ width: `${percent}%` }} />
              </div>
              {full && (
                <button
                  type="button"
                  className="mt-2 min-h-9 text-xs font-bold text-[#6d4aff]"
                  onClick={() => requestUpgrade({ title: `הגעת למכסת ${item.label}`, description: `במסלול ${planName(plan)} ניתן להוסיף עד ${item.max}. שדרוג פותח מכסה גדולה יותר מיד.`, requiredPlan: requiredPlanForLimit(item.key, item.max + 1) })}
                >
                  הגדלת המכסה ←
                </button>
              )}
            </div>
          );
        })}
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {shownFeatures.map((feature) => {
          const included = features[feature];
          const requiredPlan = requiredPlanForFeature(feature);
          return (
            <li key={feature}>
              {included ? (
                <span className="flex min-h-11 items-center gap-2 rounded-xl bg-[#f5f7fa] px-3 py-2 text-sm">
                  <Check size={15} className="shrink-0 text-[#0a9b81]" />
                  <span className="font-semibold">{featureLabels[feature]}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => requestUpgrade({
                    title: featureLabels[feature],
                    description: locked
                      ? `היכולת נעולה כי אין מנוי פעיל. מסלול ${planName(requiredPlan)} ומעלה פותח אותה מיד לאחר אישור התשלום.`
                      : `היכולת אינה כלולה במסלול ${planName(plan)}. היא נפתחת במסלול ${planName(requiredPlan)} ומעלה.`,
                    requiredPlan,
                  })}
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-[#d5cdf5] bg-white px-3 py-2 text-right text-sm hover:bg-[#faf9ff]"
                >
                  <Lock size={15} className="shrink-0 text-[#8b7fd4]" />
                  <span className="min-w-0 flex-1 font-semibold text-[#68758a]">{featureLabels[feature]}</span>
                  <span className="shrink-0 rounded-full bg-[#f1efff] px-2 py-0.5 text-[11px] font-bold text-[#4b3bad]">{planName(requiredPlan)}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

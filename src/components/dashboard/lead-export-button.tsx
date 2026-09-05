"use client";

import Link from "next/link";
import { Download, Lock } from "lucide-react";
import type { PlanId } from "@/lib/types";
import { planName, requiredPlanForFeature } from "@/lib/plan-access";
import { useUpgrade } from "@/components/upgrade-dialog";

/**
 * הכפתור תמיד גלוי. כשהיכולת אינה במסלול הוא מציג מנעול ופותח את פופאפ
 * הרכישה במקום להיעלם — כדי שהלקוח ידע שהיכולת קיימת וניתן לרכוש אותה.
 */
export function LeadExportButton({ unlocked, plan }: { unlocked: boolean; plan: PlanId }) {
  const { requestUpgrade } = useUpgrade();
  const requiredPlan = requiredPlanForFeature("leadExport");

  if (unlocked) {
    return (
      <Link href="/api/leads/export" className="button-secondary self-start">
        <Download size={17} />ייצוא CSV
      </Link>
    );
  }

  return (
    <button
      type="button"
      className="button-secondary self-start border-dashed border-[#d5cdf5] text-[#6d4aff]"
      onClick={() => requestUpgrade({
        title: "ייצוא לידים ל‑CSV",
        description: `ייצוא כל הפניות לקובץ CSV אינו כלול במסלול ${planName(plan)}. הוא נפתח במסלול ${planName(requiredPlan)}, וכל הפניות שכבר נאספו ייוצאו מיד לאחר השדרוג.`,
        requiredPlan,
      })}
    >
      <Lock size={16} />ייצוא CSV
    </button>
  );
}

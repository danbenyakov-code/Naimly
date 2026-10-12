import { Sparkles } from "lucide-react";

import { TRIAL_DAYS } from "@/lib/plan-access";
import { cn } from "@/lib/utils";
/**
 * התווית הכתומה של ההצעה. אותו נוסח כמו במודעות, כדי שמי שלחץ יזהה
 * מיד שהגיע למקום הנכון.
 */
export function TrialBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-[#ff8a00] px-3.5 py-1.5 text-sm font-extrabold text-[#1b1200] shadow-[0_8px_22px_rgba(255,138,0,.35)]", className)}>
      <Sparkles size={15} aria-hidden="true" />
      {TRIAL_DAYS} יום חינם · בלי כרטיס אשראי
    </span>
  );
}

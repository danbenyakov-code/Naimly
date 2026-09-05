import { AlertTriangle, Trash2, XCircle } from "lucide-react";
import type { ImpactItem } from "@/lib/plan-access";

/**
 * מציג במפורש מה ייגרע מהכרטיס אם ייבחר מסלול נמוך מהתוכן שנבנה בפועל.
 * חשוב במיוחד אחרי התנסות עם גישה מלאה — הלקוח חייב לדעת מה יימחק.
 */
export function DowngradeNotice({ targetPlanName, items, compact = false }: { targetPlanName: string; items: ImpactItem[]; compact?: boolean }) {
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-[#f1c9a0] bg-[#fff8ef] p-4">
      <p className="flex items-start gap-2 text-sm font-extrabold text-[#8a4d00]">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <span>מה ישתנה במעבר למסלול {targetPlanName}</span>
      </p>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2 text-sm leading-6 text-[#7a4a10]">
            {item.kind === "removed"
              ? <Trash2 size={15} className="mt-1 shrink-0 text-[#b5561f]" />
              : <XCircle size={15} className="mt-1 shrink-0 text-[#b5561f]" />}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      {!compact && (
        <p className="mt-3 border-t border-[#f1dcc2] pt-3 text-xs leading-5 text-[#8a6a41]">
          הלידים, הצפיות והכתובת האישית שלך נשמרים בכל מקרה. שדרוג חוזר יפתח את היכולות מחדש —
          אך תוכן שנמחק יידרש להעלאה מחדש.
        </p>
      )}
    </div>
  );
}

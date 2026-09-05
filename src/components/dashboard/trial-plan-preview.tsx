"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Check, Sparkles, Trash2, XCircle } from "lucide-react";
import type { ImpactItem } from "@/lib/plan-access";
import type { PlanId } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PlanImpact = { plan: PlanId; name: string; items: ImpactItem[] };

/**
 * בהתנסות כל היכולות פתוחות, ולכן הלקוח עלול לבנות כרטיס שלא יישרד במסלול
 * שיבחר. הפאנל הזה מראה לו מראש, לכל מסלול, מה בדיוק יישמר ומה יימחק.
 */
export function TrialPlanPreview({ impactByPlan }: { impactByPlan: PlanImpact[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PlanId>(impactByPlan[0]?.plan || "basic");

  const affected = impactByPlan.filter((entry) => entry.items.length > 0);
  const active = impactByPlan.find((entry) => entry.plan === selected) || impactByPlan[0];
  if (!active) return null;

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-[#d8d0ff] bg-[#f7f5ff]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-right"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#6d4aff]">
          <Sparkles size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-sm text-[#4636a6]">אתה בונה עם כל היכולות של פרימיום</strong>
          <span className="mt-0.5 block text-xs leading-5 text-[#6d5fb8]">
            {affected.length
              ? "חלק מהתוכן לא ייכלל בכל מסלול — כדאי לבדוק מה יישמר לפני הבחירה"
              : "כל מה שבנית עד כה נשמר בכל אחד מהמסלולים"}
          </span>
        </span>
        <ChevronDown size={18} className={cn("shrink-0 text-[#6d4aff] transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-[#ded8ff] p-4">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {impactByPlan.map((entry) => (
              <button
                key={entry.plan}
                type="button"
                onClick={() => setSelected(entry.plan)}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-bold",
                  selected === entry.plan ? "border-[#6d4aff] bg-white text-[#4b3bad]" : "border-[#ded8ff] text-[#6d5fb8]",
                )}
              >
                {entry.name}
                {entry.items.length > 0
                  ? <span className="rounded-full bg-[#ffe9e9] px-1.5 text-[11px] text-[#a32031]">{entry.items.length}</span>
                  : <Check size={14} className="text-[#0a9b81]" />}
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-xl bg-white p-4">
            {active.items.length === 0 ? (
              <p className="flex items-start gap-2 text-sm leading-6 text-[#08735f]">
                <Check size={16} className="mt-1 shrink-0" />
                כל התוכן שבנית נשמר במעבר למסלול {active.name}.
              </p>
            ) : (
              <>
                <p className="text-sm font-bold text-[#8a4d00]">במעבר למסלול {active.name} יוסרו:</p>
                <ul className="mt-2 grid gap-2">
                  {active.items.map((item) => (
                    <li key={item.key} className="flex items-start gap-2 text-sm leading-6 text-[#5f6d83]">
                      {item.kind === "removed"
                        ? <Trash2 size={15} className="mt-1 shrink-0 text-[#b5561f]" />
                        : <XCircle size={15} className="mt-1 shrink-0 text-[#b5561f]" />}
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Link href={`/checkout?plan=${active.plan}`} className="button-secondary mt-4 min-h-12 w-full">
              בחירת מסלול {active.name}<ArrowLeft size={16} />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

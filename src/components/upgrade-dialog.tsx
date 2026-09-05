"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Lock, Sparkles, Trash2, X, XCircle } from "lucide-react";
import { plans } from "@/lib/config";
import type { CardData, PlanId } from "@/lib/types";
import type { ImpactItem } from "@/lib/plan-access";
import { downgradeImpact, isUpgrade, planName } from "@/lib/plan-access";
import { cn, formatCurrency } from "@/lib/utils";

export type UpgradePrompt = {
  /** מה המשתמש ניסה לעשות. */
  title: string;
  /** למה זה חסום כרגע. */
  description?: string;
  /** המסלול הזול ביותר שפותח את היכולת. */
  requiredPlan: PlanId;
};

type UpgradeContextValue = {
  currentPlan: PlanId;
  /** פותח את הפופאפ. תמיד מוביל למסך רכישה/שדרוג. */
  requestUpgrade: (prompt: UpgradePrompt) => void;
};

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

export function useUpgrade() {
  const context = useContext(UpgradeContext);
  if (!context) throw new Error("useUpgrade must be used inside <UpgradeProvider>");
  return context;
}

export function UpgradeProvider({ currentPlan, card, children }: { currentPlan: PlanId; card?: CardData; children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<UpgradePrompt | null>(null);
  const requestUpgrade = useCallback((next: UpgradePrompt) => setPrompt(next), []);
  const value = useMemo(() => ({ currentPlan, requestUpgrade }), [currentPlan, requestUpgrade]);

  return (
    <UpgradeContext.Provider value={value}>
      {children}
      {prompt && <UpgradeDialog prompt={prompt} currentPlan={currentPlan} card={card} onClose={() => setPrompt(null)} />}
    </UpgradeContext.Provider>
  );
}

function ImpactList({ items }: { items: ImpactItem[] }) {
  if (!items.length) {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-[#08735f]">
        <Check size={13} className="mt-0.5 shrink-0" />כל התוכן שבנית נשמר במסלול הזה.
      </p>
    );
  }
  return (
    <ul className="mt-2 grid gap-1">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-1.5 text-xs leading-5 text-[#a2643a]">
          {item.kind === "removed"
            ? <Trash2 size={12} className="mt-0.5 shrink-0" />
            : <XCircle size={12} className="mt-0.5 shrink-0" />}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function UpgradeDialog({ prompt, currentPlan, card, onClose }: { prompt: UpgradePrompt; currentPlan: PlanId; card?: CardData; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const target = plans.find((plan) => plan.id === prompt.requiredPlan) || plans[plans.length - 1];
  // תמיד מציגים גם את המסלולים שמעל, כדי שאפשר יהיה לשדרג רחוק יותר בלחיצה אחת.
  const options = plans.filter((plan) => plan.id !== "trial" && !isUpgrade(plan.id, prompt.requiredPlan));

  // סגירה ב-Escape ונעילת גלילת הרקע, כדי שהגיליון בנייד לא "יברח".
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[#071020]/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-dialog-title"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      {/* בנייד: גיליון תחתון שנפתח עד 92% מהמסך. במחשב: חלון ממורכז. */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:max-h-[90vh] sm:rounded-3xl sm:p-8"
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#dfe4ec] sm:hidden" />
        <button type="button" onClick={onClose} className="absolute left-4 top-4 hidden h-10 w-10 place-items-center rounded-full bg-[#f0f2f6] text-[#5a677c] sm:grid" aria-label="סגירה">
          <X size={18} />
        </button>

        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f1efff] text-[#6d4aff]">
          <Lock size={22} />
        </span>
        <h2 id="upgrade-dialog-title" className="mt-4 text-xl font-black tracking-[-0.03em] sm:text-2xl">{prompt.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#68758a] sm:text-base sm:leading-7">
          {prompt.description || `היכולת הזו נכללת במסלול ${target.name} ומעלה. המסלול הנוכחי שלך הוא ${planName(currentPlan)}.`}
        </p>

        <div className="mt-5 grid gap-3">
          {options.map((plan) => {
            const impact = card ? downgradeImpact(card, plan.id) : [];
            return (
              <div key={plan.id} className={cn("rounded-2xl border p-4", plan.id === target.id ? "border-[#6d4aff] bg-[#faf9ff] shadow-[0_0_0_3px_#eeeaff]" : "border-[#e2e6ee]")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="text-lg">{plan.name}</strong>
                    {plan.id === target.id && <span className="mr-2 rounded-full bg-[#eeeaff] px-2 py-0.5 text-[11px] font-bold text-[#4b3bad]">פותח את היכולת</span>}
                    <p className="mt-0.5 text-xs text-[#78859a]">{plan.description}</p>
                  </div>
                  <span className="shrink-0 text-left">
                    <strong className="block text-xl">{formatCurrency(plan.price)}</strong>
                    <small className="text-[11px] text-[#8b96a8]">לחודש</small>
                  </span>
                </div>

                {card ? <ImpactList items={impact} /> : (
                  <ul className="mt-3 grid gap-1.5">
                    {plan.features.slice(0, 3).map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-xs text-[#54617a]">
                        <Check size={14} className="shrink-0 text-[#0a9b81]" />{feature}
                      </li>
                    ))}
                  </ul>
                )}

                <Link href={`/checkout?plan=${plan.id}`} className={cn("mt-4 min-h-12 w-full", plan.id === target.id ? "button-primary" : "button-secondary")}>
                  {isUpgrade(currentPlan, plan.id) ? `שדרוג ל${plan.name}` : `בחירת ${plan.name}`}
                  <ArrowLeft size={16} />
                </Link>
              </div>
            );
          })}
        </div>

        <Link href="/pricing" className="mt-5 flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-[#6d4aff]">
          <Sparkles size={15} />השוואת כל המסלולים
        </Link>
        <button type="button" onClick={onClose} className="mt-1 min-h-11 w-full text-center text-sm font-semibold text-[#8b96a8]">
          אולי מאוחר יותר
        </button>
      </div>
    </div>
  );
}

/**
 * עוטף שדה או אזור שאינו כלול במסלול: מציג מנעול, חוסם אינטראקציה
 * ופותח את פופאפ הרכישה בלחיצה.
 */
export function PlanLock({ locked, prompt, children, className }: { locked: boolean; prompt: UpgradePrompt; children: React.ReactNode; className?: string }) {
  const { requestUpgrade } = useUpgrade();
  if (!locked) return <>{children}</>;

  return (
    <div className={cn("relative", className)}>
      <div inert aria-hidden="true" className="pointer-events-none select-none opacity-45 blur-[1.5px]">{children}</div>
      <button
        type="button"
        onClick={() => requestUpgrade(prompt)}
        className="absolute inset-0 grid place-items-center rounded-2xl border-2 border-dashed border-[#c9c0f5] bg-white/70 text-center backdrop-blur-[1px] transition hover:bg-white/85"
      >
        <span className="flex flex-col items-center gap-1 px-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f1efff] text-[#6d4aff]"><Lock size={16} /></span>
          <span className="text-xs font-bold text-[#4b3bad]">{prompt.title}</span>
          <span className="text-[11px] font-semibold text-[#7b6fc4]">זמין במסלול {planName(prompt.requiredPlan)} — לחצו לשדרוג</span>
        </span>
      </button>
    </div>
  );
}

/** תג מנעול קטן לכותרות/כפתורים בודדים. */
export function LockBadge({ prompt }: { prompt: UpgradePrompt }) {
  const { requestUpgrade } = useUpgrade();
  return (
    <button
      type="button"
      onClick={() => requestUpgrade(prompt)}
      className="inline-flex items-center gap-1 rounded-full bg-[#f1efff] px-2 py-1 text-[11px] font-bold text-[#4b3bad] hover:bg-[#e7e2ff]"
    >
      <Lock size={11} />{planName(prompt.requiredPlan)}
    </button>
  );
}

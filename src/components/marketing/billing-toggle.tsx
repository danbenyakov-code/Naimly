"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import {
  ANNUAL_DISCOUNT_PERCENT,
  ANNUAL_MONTHS_CHARGED,
  annualPrice,
  annualSaving,
  plans,
  type BillingCycle,
} from "@/lib/config";
import { TRIAL_DAYS } from "@/lib/plan-access";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * כרטיסי המסלולים עם מתג חודשי/שנתי.
 *
 * REQ-010: החיסכון מוצג בשקלים ולא רק באחוזים. "חוסכים 98 ₪" מובן מיד;
 * "17% הנחה" מחייב את הלקוח לחשב, ורוב האנשים לא יטרחו.
 *
 * המחיר לחודש בחיוב שנתי מוצג גם הוא, כי זו ההשוואה שהלקוח עושה בראש
 * ממילא — ואם לא נציג אותה, הוא יחשב אותה לא נכון.
 */
export function BillingToggle() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const paid = plans.filter((plan) => plan.price > 0);
  const trial = plans.find((plan) => plan.id === "trial");

  return (
    <div>
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex rounded-2xl border border-[#dfe4ec] bg-white p-1" role="group" aria-label="מחזור חיוב">
          {([["monthly", "חודשי"], ["annual", "שנתי"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCycle(value)}
              aria-pressed={cycle === value}
              className={cn(
                "min-h-11 rounded-xl px-5 text-sm font-bold transition",
                cycle === value ? "bg-[#6d4aff] text-white" : "text-[#5f6d83]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="flex items-center gap-1.5 text-sm font-bold text-[#0a9b81]">
          <Sparkles size={15} aria-hidden="true" />
          בחיוב שנתי משלמים על {ANNUAL_MONTHS_CHARGED} חודשים ומקבלים 12
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {trial && (
          <article className="card-surface flex flex-col p-6">
            <h2 className="text-xl font-extrabold">{trial.name}</h2>
            <p className="mt-2 min-h-14 text-sm text-[#607087]">{trial.description}</p>
            <p className="mt-4">
              <strong className="text-4xl">חינם</strong>
              <span className="block text-sm text-[#6b778d]">{TRIAL_DAYS} ימים · ללא כרטיס אשראי</span>
            </p>
            <ul className="my-6 grid flex-1 gap-3 text-sm">
              {trial.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-[#0a9b81]" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="button-secondary w-full">
              התחלה — {TRIAL_DAYS} ימים חינם
            </Link>
          </article>
        )}

        {paid.map((plan) => {
          const annual = annualPrice(plan.price);
          const saving = annualSaving(plan.price);
          const perMonth = Math.round(annual / 12);

          return (
            <article
              key={plan.id}
              className={cn(
                "card-surface relative flex flex-col p-6",
                plan.badge && "border-[#6d4aff] ring-4 ring-[#6d4aff]/8",
              )}
            >
              {plan.badge && (
                <span className="absolute -top-3 right-5 rounded-full bg-[#6d4aff] px-3 py-1 text-xs font-bold text-white">
                  {plan.badge}
                </span>
              )}

              <h2 className="text-xl font-extrabold">{plan.name}</h2>
              <p className="mt-2 min-h-14 text-sm text-[#607087]">{plan.description}</p>

              <p className="mt-4">
                <strong className="text-4xl">{formatCurrency(cycle === "annual" ? annual : plan.price)}</strong>
                <span className="text-sm text-[#6b778d]"> / {cycle === "annual" ? "לשנה" : "לחודש"}</span>
              </p>

              {/* החיסכון בשקלים. אחוז לבדו מחייב את הלקוח לחשב. */}
              <p className="mt-1 min-h-10 text-sm">
                {cycle === "annual" ? (
                  <span className="font-bold text-[#0a9b81]">
                    {formatCurrency(perMonth)} לחודש · חיסכון {formatCurrency(saving)}
                  </span>
                ) : (
                  <span className="text-[#8b96a8]">
                    בחיוב שנתי: {formatCurrency(perMonth)} לחודש ({ANNUAL_DISCOUNT_PERCENT}% פחות)
                  </span>
                )}
              </p>

              <ul className="my-6 grid flex-1 gap-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check size={16} className="mt-0.5 shrink-0 text-[#0a9b81]" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={`/signup?plan=${plan.id}&cycle=${cycle}`}
                className={plan.badge ? "button-primary w-full" : "button-secondary w-full"}
              >
                בחירת {plan.name}
              </Link>
            </article>
          );
        })}
      </div>

      {/*
        * המסמכים המשפטיים קובעים שהמחירים אינם כוללים מע״מ. מחירון
        * ששותק בנקודה הזו יוצר פער בין מה שהלקוח ראה למה שייגבה ממנו.
        */}
      <p className="mt-6 text-center text-sm text-[#718096]">
        המחירים אינם כוללים מע״מ, שיתווסף כדין. {TRIAL_DAYS} ימי התנסות ללא חיוב וללא כרטיס אשראי.
      </p>
    </div>
  );
}

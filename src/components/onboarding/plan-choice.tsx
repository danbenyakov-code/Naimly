"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { FormAlert } from "@/components/ui/field";
import { plans } from "@/lib/config";
import { TRIAL_DAYS } from "@/lib/plan-access";
import { formatCurrency } from "@/lib/utils";
import { startTrialAction, type SelectPlanResult } from "@/app/onboarding/plan/actions";
import { fireworks } from "@/lib/celebrate";
import { PortraitStack } from "@/components/marketing/portrait";

const trial = plans.find((plan) => plan.id === "trial")!;
const paid = plans.filter((plan) => plan.id !== "trial");

/**
 * שער ההצטרפות: בלי בחירה מפורשת אין כניסה לדשבורד.
 *
 * ההתנסות מתחילה כאן ולא בהרשמה — כך הלקוח רואה שעון שרץ מהרגע הראשון,
 * ולא נוחת בדשבורד עם טיימר על אפס בלי להבין מה קיבל.
 */
export function PlanChoice({ fullName }: { fullName: string }) {
  const [state, submit, pending] = useActionState<SelectPlanResult, FormData>(
    async () => {
      /*
       * הפעולה מסתיימת ב-redirect ולכן אין "אחרי". הזיקוקים יוצאים כאן,
       * ורצים על ה-canvas הגלובלי גם תוך כדי המעבר לדשבורד.
       */
      fireworks({ bursts: 4 });
      return startTrialAction();
    },
    null,
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      <header className="text-center">
        <span className="eyebrow">שלב אחרון</span>
        <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
          {fullName ? `${fullName}, ` : ""}איזה מסלול מתאים לך?
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-[#607087] sm:text-lg">
          אי אפשר להיכנס למערכת בלי לבחור — כך תמיד ברור מה כלול ומה השעון מראה.
          אפשר להחליף מסלול בכל רגע, והכרטיס שבנית נשמר.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <PortraitStack ids={["noa", "amir", "maya", "roni", "yael"]} size={36} />
          <span className="text-sm font-bold text-[#607087]">מצטרפים לעסקים שכבר בנו כרטיס</span>
        </div>
      </header>

      {state?.ok === false && (
        <div className="mx-auto mt-6 max-w-2xl">
          <FormAlert tone="error">{state.error}</FormAlert>
        </div>
      )}

      {/* ההתנסות — הבחירה המודגשת */}
      <form action={submit} className="mt-10">
        <article className="card-surface relative border-[#6d4aff] p-6 ring-4 ring-[#6d4aff]/8 sm:p-8">
          <span className="absolute -top-3 right-6 rounded-full bg-[#6d4aff] px-3 py-1 text-xs font-bold text-white">
            מומלץ להתחלה
          </span>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="shrink-0 text-[#6d4aff]" aria-hidden="true" />
                <h2 className="text-2xl font-extrabold">{trial.name} — {TRIAL_DAYS} ימים</h2>
              </div>
              <p className="mt-2 text-[#607087]">{trial.description}</p>
              <ul className="mt-5 grid gap-2.5 text-sm sm:grid-cols-2">
                {trial.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check size={16} className="mt-0.5 shrink-0 text-[#0a9b81]" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="shrink-0 lg:w-64">
              <p className="text-center lg:text-right">
                <strong className="text-4xl">חינם</strong>
                <span className="block text-sm text-[#6b778d]">ללא כרטיס אשראי</span>
              </p>
              <button type="submit" disabled={pending} className="button-primary mt-4 min-h-12 w-full">
                {pending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    מתחילים…
                  </>
                ) : (
                  <>
                    התחלת ההתנסות
                    <ArrowLeft size={16} aria-hidden="true" />
                  </>
                )}
              </button>
              <p className="mt-2 text-center text-xs leading-5 text-[#6b778d] lg:text-right">
                השעון מתחיל עכשיו, ברגע הבחירה.
              </p>
            </div>
          </div>
        </article>
      </form>

      {/* מסלולים בתשלום */}
      <h2 className="mt-12 text-center text-lg font-extrabold sm:text-xl">
        או להתחיל ישירות במסלול בתשלום
      </h2>
      <p className="mt-1.5 text-center text-sm text-[#607087]">
        התשלום מתבצע בביט דרך וואטסאפ. הכרטיס נפתח מיד עם אישור התשלום.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {paid.map((plan) => (
          <article key={plan.id} className="card-surface flex flex-col p-6">
            <h3 className="text-xl font-extrabold">{plan.name}</h3>
            <p className="mt-2 min-h-12 text-sm text-[#607087]">{plan.description}</p>
            <p className="mt-4">
              <strong className="text-3xl">{formatCurrency(plan.price)}</strong>
              <span className="text-sm text-[#6b778d]"> / לחודש</span>
            </p>
            <ul className="my-5 grid flex-1 gap-2.5 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-[#0a9b81]" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link href={`/checkout?plan=${plan.id}`} className="button-secondary min-h-12 w-full">
              בחירת {plan.name}
            </Link>
          </article>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-[#6b778d]">
        רוצה להשוות לעומק?{" "}
        <Link href="/pricing" className="font-bold text-[#6d4aff] underline underline-offset-4">
          טבלת ההשוואה המלאה
        </Link>
      </p>
    </div>
  );
}

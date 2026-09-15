import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, MessageCircle } from "lucide-react";
import { CheckoutButton } from "@/components/checkout-button";
import { DowngradeNotice } from "@/components/downgrade-notice";
import { Logo } from "@/components/logo";
import { annualSaving, billing, billingCycleLabel, cycleAmount, extraCardProduct, isBillingConfigured, isExtraCard, plans, toBillingCycle } from "@/lib/config";
import { getDashboardCard, getViewer } from "@/lib/data";
import { downgradeImpact, resolveAccess, TRIAL_DAYS } from "@/lib/plan-access";
import { formatCurrency } from "@/lib/utils";
import type { PlanId } from "@/lib/types";

export const metadata: Metadata = { title: "השלמת הזמנה", robots: { index: false, follow: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; cycle?: string; canceled?: string }> }) {
  const params = await searchParams;
  /*
   * REQ-011: "כרטיס נוסף" נרכש באותו מסך. הוא אינו מסלול, ולכן מחזור
   * החיוב שלו קבוע חודשי ואין לו מתג שנתי.
   */
  const extra = isExtraCard(params.plan);
  const plan = extra
    ? { id: extraCardProduct.id, name: extraCardProduct.name, price: extraCardProduct.price, description: extraCardProduct.description, features: extraCardProduct.features }
    : plans.find((item) => item.id === params.plan && item.id !== "trial");
  if (!plan) redirect("/pricing");

  // מחזור החיוב מגיע מהמחירון. ערך לא מוכר נופל לחודשי — ברירת המחדל
  // הזולה יותר, כדי שקלט פגום לא יגרור חיוב גבוה מהצפוי.
  const cycle = extra ? ("monthly" as const) : toBillingCycle(params.cycle);
  const amount = cycleAmount(plan.price, cycle);
  const saving = annualSaving(plan.price);

  const viewer = await getViewer();
  if (!viewer) redirect(`/signup?plan=${plan.id}&cycle=${cycle}`);

  const access = resolveAccess(viewer);
  const card = await getDashboardCard(viewer);
  const impact = extra ? [] : downgradeImpact(card, plan.id as PlanId);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(109,74,255,.17),transparent_36%),#f4f6fa] px-4 py-6 sm:py-14">
      <div className="mx-auto max-w-[930px]">
        <div className="mb-6 flex justify-center sm:mb-8"><Logo /></div>

        {params.canceled && (
          <p className="mb-5 rounded-xl border border-[#f1d69a] bg-[#fff8e8] p-3 text-center text-sm text-[#805100]">
            התשלום לא הושלם ולא בוצע חיוב. אפשר לנסות שוב.
          </p>
        )}

        <div className="grid overflow-hidden rounded-3xl border border-[#dfe5ed] bg-white shadow-[0_24px_80px_rgba(11,24,48,.13)] lg:grid-cols-[1fr_.85fr]">
          {/* בנייד סיכום ההזמנה מופיע ראשון, לפני הטופס. */}
          <aside className="order-1 bg-[#0b1020] p-5 text-white sm:p-8 lg:order-2 lg:p-10">
            <h2 className="text-sm font-bold text-[#72e3d3]">סיכום הזמנה</h2>
            <div className="mt-5 flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <strong className="text-lg sm:text-xl">{extra ? plan.name : `מסלול ${plan.name}`}</strong>
                <p className="mt-1 text-sm text-white/55">{billingCycleLabel[cycle]}</p>
              </div>
              <strong className="shrink-0 text-2xl">{formatCurrency(amount)}</strong>
            </div>

            {/* החיסכון מוצג בסיכום ולא רק במחירון — זו הנקודה שבה הלקוח משלם. */}
            {cycle === "annual" && (
              <div className="mt-4 flex justify-between text-sm font-bold text-[#72e3d3]">
                <span>חיסכון מול חיוב חודשי</span>
                <span>{formatCurrency(saving)}</span>
              </div>
            )}

            <div className="mt-4 flex justify-between text-sm text-white/65">
              <span>מע״מ</span>
              <span>כלול במחיר</span>
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
              <span className="font-bold">{cycle === "annual" ? "סה״כ לשנה" : "סה״כ לחודש"}</span>
              <span className="text-left">
                <strong className="text-2xl sm:text-3xl">{formatCurrency(amount)}</strong>
                <small className="block text-white/45">
                  {cycle === "annual" ? `${formatCurrency(Math.round(amount / 12))} לחודש בפועל` : "ניתן לבטל בכל עת"}
                </small>
              </span>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.055] p-4 text-xs leading-6 text-white/70">
              <p className="flex items-center gap-2 font-bold text-[#72e3d3]"><MessageCircle size={14} />תשלום בביט דרך וואטסאפ</p>
              <p className="mt-2">
                פותחים בקשה, מקבלים מספר אסמכתא, ומעבירים את הסכום בביט
                {billing.bitPhone ? ` למספר ${billing.bitPhone}` : ""}. אחרי אימות ההעברה אנחנו מפעילים את המסלול.
              </p>
            </div>
          </aside>

          <section className="order-2 p-5 sm:p-8 lg:order-1 lg:p-10">
            <span className="eyebrow">שלב אחרון</span>
            <h1 className="mt-3 text-2xl font-black tracking-[-0.04em] sm:text-3xl">{extra ? plan.name : `מעבר למסלול ${plan.name}`}</h1>
            <p className="mt-2 break-words text-sm text-[#68758a]">החשבון: {viewer.email}</p>

            {access.trial.active && (
              <p className="mt-4 rounded-xl border border-[#d8d0ff] bg-[#f3f0ff] p-3 text-sm leading-6 text-[#4636a6]">
                אתה בתקופת התנסות של {TRIAL_DAYS} יום עם כל היכולות פתוחות. הבחירה כאן קובעת מה יישאר פתוח בסיומה.
              </p>
            )}

            <ul className="mt-6 grid gap-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check size={17} className="mt-0.5 shrink-0 text-[#0a9b81]" />{feature}
                </li>
              ))}
            </ul>

            {impact.length > 0 && (
              <div className="mt-6">
                <DowngradeNotice targetPlanName={plan.name} items={impact} />
              </div>
            )}

            <div className="mt-6">
              {isBillingConfigured ? (
                <CheckoutButton planId={plan.id as PlanId | "extra_card"} planName={plan.name} price={amount} cycle={cycle} />
              ) : (
                <p role="alert" className="rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-4 text-sm leading-6 text-[#a32031]">
                  מספר הוואטסאפ לתשלומים טרם הוגדר. יש להגדיר <code dir="ltr">NEXT_PUBLIC_BILLING_WHATSAPP</code> לפני פתיחת המכירה.
                </p>
              )}
            </div>
          </section>
        </div>

        <Link href="/pricing" className="mt-6 block py-2 text-center text-sm font-semibold text-[#6d4aff]">
          חזרה לבחירת מסלול
        </Link>
      </div>
    </main>
  );
}

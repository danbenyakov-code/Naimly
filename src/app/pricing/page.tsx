import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { plans } from "@/lib/config";
import { formatCurrency } from "@/lib/utils";
import { TRIAL_DAYS, planFeatures, planLimits } from "@/lib/plan-access";

export const metadata: Metadata = { title: "מחירים", description: "מסלולים גמישים לבניית כרטיס ביקור דיגיטלי לעסק.", alternates: { canonical: "/pricing" } };

// הטבלה נגזרת מאותו מקור שאוכף את המסלולים בשרת וב‑DB, כדי שהשיווק,
// המנעולים בממשק והחסימות בפועל לא ייפרדו זה מזה.
const days = (value: number) => (value >= 365 ? `${Math.round(value / 365)} שנים`.replace("1 שנים", "שנה") : `${value} ימים`);

const rows: Array<[string, ...Array<string | boolean>]> = [
  ["מספר כרטיסים", ...plans.map((plan) => String(planLimits(plan.id).cards))],
  ["פעולות מהירות", ...plans.map((plan) => String(planLimits(plan.id).quickActions))],
  ["תמונות בגלריה", ...plans.map((plan) => String(planLimits(plan.id).galleryItems))],
  ["קישור אישי ו‑QR", ...plans.map(() => true)],
  ["טופס לידים וניהול פניות", ...plans.map(() => true)],
  ["כפתורים חכמים", ...plans.map((plan) => planFeatures(plan.id).smartButtons)],
  ["המלצות לקוחות", ...plans.map((plan) => planFeatures(plan.id).testimonials)],
  ["וידג׳ט סרטון", ...plans.map((plan) => planFeatures(plan.id).video)],
  ["גלריית קרוסלה", ...plans.map((plan) => planFeatures(plan.id).carousel)],
  ["קבצים להורדה", ...plans.map((plan) => planFeatures(plan.id).files)],
  ["היסטוריית נתונים", ...plans.map((plan) => days(planLimits(plan.id).analyticsDays))],
  ["Meta Pixel ו‑Google Analytics", ...plans.map((plan) => planFeatures(plan.id).tracking)],
  ["SEO מתקדם", ...plans.map((plan) => planFeatures(plan.id).seo)],
  ["ייצוא לידים ל‑CSV", ...plans.map((plan) => planFeatures(plan.id).leadExport)],
  ["תמיכה מועדפת", ...plans.map((plan) => planFeatures(plan.id).prioritySupport)],
];

function Value({ value }: { value: string | boolean }) {
  if (value === true) return <Check size={18} className="mx-auto text-[#0a9b81]" aria-label="כלול" />;
  if (value === false) return <Minus size={18} className="mx-auto text-[#9aa4b4]" aria-label="לא כלול" />;
  return <>{value}</>;
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main>
        <section className="bg-[radial-gradient(circle_at_50%_0%,rgba(109, 74, 255,.18),transparent_43%),#f6f7fb] py-16 text-center sm:py-24">
          <div className="container-shell"><span className="eyebrow">מחירים ברורים. ללא הפתעות.</span><h1 className="mt-5 text-4xl font-black tracking-[-0.05em] sm:text-6xl">המסלול שמתאים לעסק שלך.</h1><p className="mx-auto mt-4 max-w-2xl text-lg text-[#607087]">מתחילים ב‑{TRIAL_DAYS} ימי התנסות מלאים, ללא כרטיס אשראי. אפשר לשדרג, לשנות מסלול או לבטל בכל עת — והכרטיס שבניתם נשמר.</p></div>
        </section>
        <section className="py-14 sm:py-20">
          <div className="container-shell grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <article key={plan.id} className={`card-surface relative flex flex-col p-6 ${plan.badge ? "border-[#6d4aff] ring-4 ring-[#6d4aff]/8" : ""}`}>
                {plan.badge && <span className="absolute -top-3 right-5 rounded-full bg-[#6d4aff] px-3 py-1 text-xs font-bold text-white">{plan.badge}</span>}
                <h2 className="text-xl font-extrabold">{plan.name}</h2><p className="mt-2 min-h-14 text-sm text-[#607087]">{plan.description}</p>
                <p className="mt-4"><strong className="text-4xl">{formatCurrency(plan.price)}</strong><span className="text-sm text-[#6b778d]"> / לחודש</span></p>
                <ul className="my-6 grid flex-1 gap-3 text-sm">{plan.features.map((feature) => <li key={feature} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#0a9b81]" />{feature}</li>)}</ul>
                <Link href={plan.id === "trial" ? "/signup" : `/signup?plan=${plan.id}`} className={plan.badge ? "button-primary w-full" : "button-secondary w-full"}>{plan.id === "trial" ? `התחלה — ${TRIAL_DAYS} ימים חינם` : "בחירת מסלול"}</Link>
              </article>
            ))}
          </div>
        </section>
        <section className="pb-20">
          <div className="container-shell card-surface table-scroll">
            <table className="w-full min-w-[760px] border-collapse text-center text-sm">
              <caption className="px-6 py-6 text-right text-xl font-extrabold">מה כלול בכל מסלול<span className="mt-1 block text-sm font-medium text-[#68758a]">יכולת שאינה כלולה נשארת גלויה במערכת ונעולה — אפשר לשדרג בכל רגע ולפתוח אותה מיד.</span></caption>
              <thead><tr className="border-y border-[#e5e9f1] bg-[#f8f9fc]"><th className="p-4 text-right">יכולת</th>{plans.map((plan) => <th key={plan.id} className="p-4">{plan.name}{plan.id === "trial" && <span className="mt-0.5 block text-[11px] font-normal text-[#6d4aff]">{TRIAL_DAYS} יום</span>}</th>)}</tr></thead>
              <tbody>{rows.map(([label, ...values]) => <tr key={String(label)} className="border-b border-[#edf0f5]"><th className="p-4 text-right font-medium">{label}</th>{values.map((value, index) => <td key={index} className="p-4 text-[#5f6d83]"><Value value={value as string | boolean} /></td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

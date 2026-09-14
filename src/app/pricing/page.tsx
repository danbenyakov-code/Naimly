import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BillingToggle } from "@/components/marketing/billing-toggle";
import { plans } from "@/lib/config";
import { TRIAL_DAYS, planFeatures, planLimits } from "@/lib/plan-access";

export const metadata: Metadata = {
  title: "מחירים",
  description: "מסלולים גמישים לבניית כרטיס ביקור דיגיטלי לעסק, עם השוואה מלאה של מה כלול בכל מסלול.",
  alternates: { canonical: "/pricing" },
};

/*
 * הטבלה נגזרת מאותו מקור שאוכף את המסלולים בשרת וב‑DB, כדי שהשיווק,
 * המנעולים בממשק והחסימות בפועל לא ייפרדו זה מזה.
 *
 * השורות מקובצות לפי מה שמעניין את הלקוח — כמה הוא מקבל, מה תמיד כלול,
 * ומה פותח לו שיווק ונתונים — ולא לפי המבנה הפנימי של הקוד.
 */
const days = (value: number) => {
  if (value >= 730) return "שנתיים";
  if (value >= 365) return "שנה";
  return `${value} ימים`;
};

/**
 * מכסה אפס פירושה "לא כלול", ולא "0".
 *
 * מספר עירום בטבלה מחייב את הקורא לפרש אותו; סימן "לא כלול" מובן מיד,
 * ומקבל גם תווית נגישה.
 */
const count = (value: number, singular: string, plural: string) => {
  if (value === 0) return false;
  return value === 1 ? singular : `${value} ${plural}`;
};

type Row = [string, ...Array<string | boolean>];
type Group = { title: string; note?: string; rows: Row[] };

const groups: Group[] = [
  {
    title: "מה מקבלים",
    note: "המספרים הם מכסות בפועל — המערכת חוסמת מעבר להן.",
    rows: [
      ["כרטיסים בחשבון", ...plans.map((plan) => count(planLimits(plan.id).cards, "כרטיס אחד", "כרטיסים"))],
      ["תמונות בגלריה", ...plans.map((plan) => count(planLimits(plan.id).galleryItems, "תמונה אחת", "תמונות"))],
      ["פעולות מהירות", ...plans.map((plan) => count(planLimits(plan.id).quickActions, "פעולה אחת", "פעולות"))],
      ["סרטונים בכרטיס", ...plans.map((plan) => count(planLimits(plan.id).videos, "סרטון אחד", "סרטונים"))],
      ["קבצים להורדה", ...plans.map((plan) => count(planLimits(plan.id).files, "קובץ אחד", "קבצים"))],
    ],
  },
  {
    title: "כלול בכל מסלול",
    note: "הבסיס שכל כרטיס מקבל, גם במסלול הזול ביותר.",
    rows: [
      ["קישור אישי וקוד QR", ...plans.map(() => true)],
      ["טופס פניות עם התראה למייל", ...plans.map(() => true)],
      ["שמירת איש קשר בלחיצה", ...plans.map(() => true)],
      ["ניהול הפניות באזור האישי", ...plans.map(() => true)],
      ["כפתורי פעולה חכמים", ...plans.map((plan) => planFeatures(plan.id).smartButtons)],
      ["המלצות לקוחות", ...plans.map((plan) => planFeatures(plan.id).testimonials)],
    ],
  },
  {
    title: "שיווק, מדידה ונתונים",
    note: "מה שהופך את הכרטיס מכרטיס ביקור לכלי שיווק.",
    rows: [
      ["היסטוריית נתונים", ...plans.map((plan) => days(planLimits(plan.id).analyticsDays))],
      ["Google Analytics ו‑Tag Manager", ...plans.map((plan) => planFeatures(plan.id).tracking)],
      ["Meta Pixel", ...plans.map((plan) => planFeatures(plan.id).tracking)],
      ["SEO מתקדם — אזור שירות ותמונת שיתוף", ...plans.map((plan) => planFeatures(plan.id).seo)],
      ["גלריית קרוסלה", ...plans.map((plan) => planFeatures(plan.id).carousel)],
      ["ייצוא הפניות לקובץ CSV", ...plans.map((plan) => planFeatures(plan.id).leadExport)],
    ],
  },
];

function Value({ value }: { value: string | boolean }) {
  if (value === true) return <Check size={18} className="mx-auto text-[#0a9b81]" aria-label="כלול" />;
  if (value === false) return <Minus size={18} className="mx-auto text-[#9aa4b4]" aria-label="לא כלול" />;
  return <span className="font-semibold text-[#33415c]">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main>
        <section className="bg-[radial-gradient(circle_at_50%_0%,rgba(109, 74, 255,.18),transparent_43%),#f6f7fb] py-16 text-center sm:py-24">
          <div className="container-shell">
            <span className="eyebrow">מחירים ברורים. ללא הפתעות.</span>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] sm:text-6xl">המסלול שמתאים לעסק שלך.</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-[#607087]">
              מתחילים ב‑{TRIAL_DAYS} ימי התנסות עם כל היכולות פתוחות, ללא כרטיס אשראי.
              אפשר לשדרג, לשנות מסלול או לבטל בכל עת — והכרטיס שבניתם נשמר.
            </p>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="container-shell">
            <BillingToggle />
          </div>
        </section>

        <section className="pb-20">
          <div className="container-shell card-surface table-scroll">
            <table className="w-full min-w-[760px] border-collapse text-center text-sm">
              <caption className="px-6 py-6 text-right text-xl font-extrabold">
                השוואה מלאה
                <span className="mt-1 block text-sm font-medium text-[#68758a]">
                  יכולת שאינה כלולה נשארת גלויה במערכת ונעולה — אפשר לשדרג בכל רגע ולפתוח אותה מיד.
                </span>
              </caption>

              <thead>
                <tr className="border-y border-[#e5e9f1] bg-[#f8f9fc]">
                  <th scope="col" className="p-4 text-right">יכולת</th>
                  {plans.map((plan) => (
                    <th key={plan.id} scope="col" className="p-4">
                      {plan.name}
                      {plan.id === "trial" && (
                        <span className="mt-0.5 block text-[11px] font-normal text-[#6d4aff]">{TRIAL_DAYS} יום חינם</span>
                      )}
                      {plan.badge && (
                        <span className="mt-0.5 block text-[11px] font-normal text-[#6d4aff]">{plan.badge}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              {groups.map((group) => (
                <tbody key={group.title}>
                  <tr className="bg-[#fbfbfe]">
                    <th scope="colgroup" colSpan={plans.length + 1} className="border-y border-[#edf0f5] p-3 text-right">
                      <span className="text-sm font-extrabold text-[#4b3bad]">{group.title}</span>
                      {group.note && <span className="mr-2 text-xs font-normal text-[#8b96a8]">{group.note}</span>}
                    </th>
                  </tr>
                  {group.rows.map(([label, ...values]) => (
                    <tr key={String(label)} className="border-b border-[#edf0f5]">
                      <th scope="row" className="p-4 text-right font-medium">{label}</th>
                      {values.map((value, index) => (
                        <td key={index} className="p-4 text-[#5f6d83]">
                          <Value value={value as string | boolean} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

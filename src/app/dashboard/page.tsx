import Link from "next/link";
import { ArrowLeft, BarChart3, Eye, MessageSquareText, MousePointerClick, QrCode, Sparkles, UserPlus } from "lucide-react";
import { getAnalyticsSummary, getDashboardCard, getViewer } from "@/lib/data";
import { formatCompact } from "@/lib/utils";
import { resolveAccess } from "@/lib/plan-access";
import { TrialTimer } from "@/components/trial-timer";
import { LockedOverlay } from "@/components/dashboard/locked-overlay";
import { TrialPendingNotice } from "@/components/dashboard/trial-pending-notice";
import { PlanSummaryCard } from "@/components/dashboard/plan-summary-card";

export default async function DashboardPage() {
  const viewer = await getViewer();
  if (!viewer) return null;
  const [card, analytics] = await Promise.all([getDashboardCard(viewer), getAnalyticsSummary(viewer)]);
  const access = resolveAccess(viewer);
  const trial = access.trial;
  const stats = [
    { label: "צפיות ב‑30 יום", value: formatCompact(analytics.views), icon: Eye, change: "+18%" },
    { label: "לחיצות", value: formatCompact(analytics.clicks), icon: MousePointerClick, change: "+12%" },
    { label: "פניות חדשות", value: analytics.leads.toString(), icon: MessageSquareText, change: "+7" },
    { label: "שמירת איש קשר", value: analytics.contactSaves.toString(), icon: UserPlus, change: "+9%" },
  ];

  return (
    <div className="mx-auto max-w-[1260px]">
      {viewer.demo && <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-[#d8d0ff] bg-[#f3f0ff] p-4 text-sm text-[#4636a6] sm:flex-row sm:items-center"><span><strong>מצב הדגמה:</strong> כל המסכים פעילים עם נתוני דוגמה. חיבור Supabase יפעיל חשבונות ונתונים אמיתיים.</span><Link href="/dashboard/settings" className="font-bold underline underline-offset-4">פרטי החיבור</Link></div>}
      {access.locked
        ? <div className="mb-5"><LockedOverlay reason={access.reason} /></div>
        : trial.pending
          ? <div className="mb-5"><TrialPendingNotice /></div>
          : trial.active && <div className="mb-5"><TrialTimer endsAt={trial.endsAt} /></div>}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-bold text-[#6d4aff]">סקירת פעילות</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">מה קורה בכרטיס שלך</h1><p className="mt-1 text-sm text-[#718096]">הנתונים החשובים והפעולות הבאות במקום אחד.</p></div>
        <div className="flex gap-2"><Link href={`/${card.slug}`} target="_blank" className="button-secondary"><Eye size={17} />צפייה בכרטיס</Link><Link href="/dashboard/card" className="button-primary">עריכת הכרטיס <ArrowLeft size={17} /></Link></div>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="מדדים מרכזיים">
        {stats.map(({ label, value, icon: Icon, change }) => <article key={label} className="card-surface p-5"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#efecff] text-[#6d4aff]"><Icon size={21} /></span><span className="rounded-full bg-[#e9fbf7] px-2 py-1 text-[11px] font-bold text-[#08735f]">{change}</span></div><strong className="mt-4 block text-3xl tracking-tight">{value}</strong><span className="text-sm text-[#718096]">{label}</span></article>)}
      </section>

      <div className="mt-6"><PlanSummaryCard plan={access.plan} locked={access.locked} galleryUsed={card.gallery.length} quickActionsUsed={card.quickActions.length} /></div>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <article className="card-surface p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold">פעילות בשבוע האחרון</h2><p className="text-xs text-[#7a8799]">צפיות ולחיצות על הכרטיס</p></div><Link href="/dashboard/analytics" className="text-sm font-bold text-[#6d4aff]">לכל הנתונים</Link></div>
          <div className="mt-7 flex h-52 items-end gap-2 sm:gap-4" aria-label="גרף פעילות שבועי">
            {analytics.daily.slice(-7).map((item) => {
              const max = Math.max(...analytics.daily.map((day) => day.views), 1);
              return <div key={item.date} className="flex h-full flex-1 flex-col justify-end gap-2 text-center"><div className="relative mx-auto flex h-[165px] w-full max-w-10 items-end overflow-hidden rounded-t-lg bg-[#eef0f6]"><span className="block w-full rounded-t-lg bg-[linear-gradient(180deg,#6d4aff,#7d6ff0)]" style={{ height: `${Math.max(8, (item.views / max) * 100)}%` }} title={`${item.views} צפיות`} /></div><span className="text-[11px] text-[#778397]">{item.date}</span></div>;
            })}
          </div>
        </article>
        <aside className="card-surface overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#0b1020,#2c2b70)] p-6 text-white"><div className="flex items-center gap-2 text-sm font-bold text-[#70e3d3]"><Sparkles size={16} />המלצה לשיפור</div><h2 className="mt-3 text-xl font-extrabold">הוספת המלצה יכולה להגדיל פניות.</h2><p className="mt-2 text-sm leading-6 text-white/65">בכרטיס שלך כבר יש {card.testimonials.length} המלצות. מומלץ להציג לפחות שלוש.</p><Link href="/dashboard/card#testimonials" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-white">הוספת המלצה <ArrowLeft size={16} /></Link></div>
          <div className="p-5"><h3 className="text-sm font-extrabold">קיצורי דרך</h3><div className="mt-3 grid gap-2"><Link href="/dashboard/card" className="flex items-center justify-between rounded-xl bg-[#f4f5f9] p-3 text-sm font-semibold"><span className="flex items-center gap-2"><QrCode size={17} className="text-[#6d4aff]" />הורדת QR</span><ArrowLeft size={15} /></Link><Link href="/dashboard/analytics" className="flex items-center justify-between rounded-xl bg-[#f4f5f9] p-3 text-sm font-semibold"><span className="flex items-center gap-2"><BarChart3 size={17} className="text-[#6d4aff]" />דו״ח ביצועים</span><ArrowLeft size={15} /></Link></div></div>
        </aside>
      </section>
    </div>
  );
}

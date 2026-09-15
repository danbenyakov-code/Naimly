import Link from "next/link";
import { ArrowLeft, BarChart3, Clock3, Eye, MessageSquareText, MousePointerClick, QrCode, Sparkles, UserPlus } from "lucide-react";
import { getAnalyticsSummary, getDashboardCard, getUserCards, getViewer } from "@/lib/data";
import { formatCompact } from "@/lib/utils";
import { effectiveMaxCards, planName, resolveAccess } from "@/lib/plan-access";
import { TrialTimer } from "@/components/trial-timer";
import { LockedOverlay } from "@/components/dashboard/locked-overlay";
import { PlanSummaryCard } from "@/components/dashboard/plan-summary-card";
import { CardSwitcher } from "@/components/dashboard/card-switcher";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return null;
  const params = await searchParams;
  const [card, cards] = await Promise.all([getDashboardCard(viewer, params.card), getUserCards(viewer)]);
  const analytics = await getAnalyticsSummary(viewer, card.id);
  const access = resolveAccess(viewer);
  const maxCards = effectiveMaxCards(viewer);
  const selectedCardId = card.id;
  const trial = access.trial;
  /*
   * QA-017: כאן הוצגו מגמות קבועות בקוד — "+18%", "+12%" — ליד נתונים
   * אמיתיים, כולל אפסים. חשבון חדש בלי פעילות הציג "עלייה של 18%"
   * מול אפס צפיות. מדד שלא נמדד לא מוצג.
   *
   * המגמה תחזור כשיהיה חלון השוואה אמיתי; עד אז מוצג נפח הנתונים.
   */
  const stats = [
    { label: "צפיות ב‑30 יום", value: formatCompact(analytics.views), icon: Eye, raw: analytics.views },
    { label: "לחיצות", value: formatCompact(analytics.clicks), icon: MousePointerClick, raw: analytics.clicks },
    { label: "פניות חדשות", value: analytics.leads.toString(), icon: MessageSquareText, raw: analytics.leads },
    { label: "שמירת איש קשר", value: analytics.contactSaves.toString(), icon: UserPlus, raw: analytics.contactSaves },
  ];

  return (
    <div className="mx-auto max-w-[1260px]">
      {/* REQ-011: מעבר בין כרטיסים בכל מסך, לא רק בעורך. */}
      <CardSwitcher
        cards={cards}
        activeId={selectedCardId}
        maxCards={maxCards}
        planName={planName(access.plan)}
        canAdd={maxCards > cards.length && !access.locked}
        canBuy={!access.locked}
        demo={viewer.demo}
        basePath="/dashboard"
      />
      {viewer.demo && <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-[#d8d0ff] bg-[#f3f0ff] p-4 text-sm text-[#4636a6] sm:flex-row sm:items-center"><span><strong>מצב הדגמה:</strong> כל המסכים פעילים עם נתוני דוגמה. חיבור Supabase יפעיל חשבונות ונתונים אמיתיים.</span><Link href="/dashboard/settings" className="font-bold underline underline-offset-4">פרטי החיבור</Link></div>}
      {access.locked
        ? <div className="mb-5"><LockedOverlay reason={access.reason} /></div>
        : trial.active && <div className="mb-5"><TrialTimer endsAt={trial.endsAt} /></div>}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-bold text-[#6d4aff]">סקירת פעילות</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">מה קורה בכרטיס שלך</h1><p className="mt-1 text-sm text-[#718096]">הנתונים החשובים והפעולות הבאות במקום אחד.</p></div>
        <div className="flex gap-2">{card.isPublished
          ? <Link href={`/${card.slug}`} target="_blank" className="button-secondary"><Eye size={17} />צפייה בכרטיס</Link>
          : <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#fff6e5] px-3 py-2 text-sm font-bold text-[#8a5a00]"><Clock3 size={16} aria-hidden="true" />הכרטיס בטיוטה</span>}
          <Link href="/dashboard/card" className="button-primary">{card.isPublished ? "עריכת הכרטיס" : "השלמת הכרטיס ופרסום"} <ArrowLeft size={17} /></Link></div>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="מדדים מרכזיים">
        {stats.map(({ label, value, icon: Icon, raw }) => <article key={label} className="card-surface p-5"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#efecff] text-[#6d4aff]"><Icon size={21} /></span>{raw === 0 && <span className="rounded-full bg-[#f1f3f7] px-2 py-1 text-[11px] font-bold text-[#7c8799]">אין מספיק נתונים</span>}</div><strong className="mt-4 block text-3xl tracking-tight">{value}</strong><span className="text-sm text-[#718096]">{label}</span></article>)}
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

import { BarChart3, Eye, MessageSquareText, MousePointerClick, UserPlus } from "lucide-react";
import { getAnalyticsSummary, getViewer } from "@/lib/data";
import { formatCompact } from "@/lib/utils";
import { planName, resolveAccess } from "@/lib/plan-access";
import { AnalyticsWindowNotice } from "@/components/dashboard/analytics-window-notice";

const actionLabels: Record<string, string> = { phone: "טלפון", whatsapp: "WhatsApp", whatsapp_primary: "WhatsApp ראשי", email: "אימייל", contact_save: "שמירת איש קשר", map: "ניווט", website: "אתר", share: "שיתוף" };

export default async function AnalyticsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;
  const analytics = await getAnalyticsSummary(viewer);
  // חלון הנתונים נקבע לפי המסלול, ולכן הכותרות משקפות אותו במקום מספר קבוע.
  const access = resolveAccess(viewer);
  const analyticsDays = access.limits.analyticsDays;
  const windowLabel = analyticsDays >= 365 ? `${Math.round(analyticsDays / 365)} השנים האחרונות`.replace("1 השנים", "השנה") : `${analyticsDays} הימים האחרונים`;
  const metrics = [
    { label: "צפיות", value: formatCompact(analytics.views), icon: Eye, note: `ב־${windowLabel}` },
    { label: "לחיצות", value: formatCompact(analytics.clicks), icon: MousePointerClick, note: `${analytics.views ? Math.round((analytics.clicks / analytics.views) * 100) : 0}% מהצפיות` },
    { label: "פניות", value: analytics.leads.toString(), icon: MessageSquareText, note: `${analytics.conversionRate}% המרה` },
    { label: "שמירות", value: analytics.contactSaves.toString(), icon: UserPlus, note: "שמירת איש קשר" },
  ];
  const maxViews = Math.max(...analytics.daily.map((item) => item.views), 1);

  return (
    <div className="mx-auto max-w-[1260px]">
      <div><p className="text-sm font-bold text-[#6d4aff]">אנליטיקה</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">הביצועים של הכרטיס</h1><p className="mt-1 text-sm text-[#718096]">צפיות, פעולות ופניות ב־{windowLabel}.</p></div>
      <AnalyticsWindowNotice planLabel={planName(access.plan)} days={analyticsDays} />
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, note }) => <article key={label} className="card-surface p-5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#efecff] text-[#6d4aff]"><Icon size={21} /></span><strong className="mt-4 block text-3xl tracking-tight">{value}</strong><span className="text-sm font-semibold">{label}</span><p className="mt-1 text-xs text-[#7d8899]">{note}</p></article>)}
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <article className="card-surface p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9fbf7] text-[#0b8b74]"><BarChart3 size={20} /></span><div><h2 className="font-extrabold">מגמת פעילות</h2><p className="text-xs text-[#7d8899]">צפיות בכרטיס לפי יום</p></div></div>{analytics.daily.length ? <div className="mt-8 flex h-72 items-end gap-2 sm:gap-4">{analytics.daily.map((item) => <div key={item.date} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2 text-center"><div className="flex h-[230px] flex-col items-center justify-end gap-1"><span className="text-[11px] font-bold tabular-nums text-[#4b3bad]">{item.views}</span><span className="block w-full max-w-12 rounded-t-xl bg-[linear-gradient(180deg,#6d4aff,#8b7ff1)]" style={{ height: `${Math.max(4, (item.views / maxViews) * 100)}%` }} title={`${item.views} צפיות`} /></div><span className="truncate text-[11px] text-[#7d8899]">{item.date}</span></div>)}</div> : <div className="mt-8 grid h-60 place-items-center rounded-2xl bg-[#f6f7fa] text-sm text-[#7d8899]">הנתונים יופיעו לאחר צפיות ראשונות בכרטיס</div>}</article>
        <article className="card-surface p-5 sm:p-7"><h2 className="font-extrabold">פעולות פופולריות</h2><p className="text-xs text-[#7d8899]">מה הלקוחות עושים בכרטיס</p><div className="mt-6 grid gap-5">{analytics.actions.length ? analytics.actions.map((action) => <div key={action.label}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold">{actionLabels[action.label] || action.label}</span><span className="text-[#69768a]">{action.value} · {action.percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf0f5]"><span className="block h-full rounded-full bg-[#16bba4]" style={{ width: `${action.percent}%` }} /></div></div>) : <p className="rounded-xl bg-[#f6f7fa] p-4 text-sm text-[#7d8899]">אין עדיין פעולות להצגה.</p>}</div></article>
      </section>
      <aside className="mt-5 rounded-2xl border border-[#d9d1ff] bg-[#f5f2ff] p-5 text-sm text-[#5d5188]"><strong className="text-[#5134cc]">איך לקרוא את הנתונים?</strong> שיעור המרה מחושב לפי מספר הפניות חלקי מספר הצפיות. לחיצה על WhatsApp או טלפון אינה בהכרח פנייה שהושלמה.</aside>
    </div>
  );
}

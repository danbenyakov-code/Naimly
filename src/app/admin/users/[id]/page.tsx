import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, ExternalLink, Mail, MessageCircle } from "lucide-react";
import { PlanStateBadge, StageBadge } from "@/components/admin/user-control-badges";
import { TestAccountToggle } from "@/components/admin/test-account-toggle";
import { getViewer } from "@/lib/data";
import {
  eventDetail,
  eventLabel,
  formatDateTime,
  phoneSourceLabel,
  toControlUser,
  whatsappLink,
} from "@/lib/user-control";
import { getUserControlDetail } from "@/lib/user-control-data";

export const metadata: Metadata = { title: "פרטי משתמש", robots: { index: false, follow: false } };

const dayFormat = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });

/** אירועים יזומים על ידי הלקוח בולטים יותר מאירועי מערכת. */
const quietEvents = new Set(["email_sent", "app_visit", "logged_in"]);

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const detail = await getUserControlDetail(viewer, id);
  if (!detail) notFound();

  const user = toControlUser(detail.row);
  const { row, events } = detail;

  const days = new Map<string, typeof events>();
  for (const event of events) {
    const key = dayFormat.format(new Date(event.created_at));
    days.set(key, [...(days.get(key) || []), event]);
  }

  const facts: Array<[string, React.ReactNode]> = [
    ["אימייל", <span key="email" dir="ltr">{user.email}</span>],
    ["טלפון", user.phone ? <span key="phone"><span dir="ltr">{user.phone}</span>{user.phoneSource && <span className="mr-1.5 text-xs text-[#7d8899]">({phoneSourceLabel[user.phoneSource]})</span>}</span> : "לא ידוע"],
    ["נרשם", formatDateTime(user.signedUpAt)],
    ["מקור הגעה", user.signupSource || "לא ידוע"],
    ["אימת מייל", row.email_confirmed_at ? formatDateTime(row.email_confirmed_at) : "לא"],
    ["התחברות אחרונה", formatDateTime(row.last_sign_in_at) || "-"],
    ["כניסה אחרונה למערכת", formatDateTime(row.last_app_visit_at) || "-"],
    ["מסלול", user.plan],
    ["בחר מסלול", formatDateTime(row.plan_selected_at) || "לא"],
    ["סיום ניסיון", formatDateTime(row.trial_ends_at) || "-"],
    ["ימים שנותרו לניסיון", user.trialDaysLeft === null ? "-" : <span key="days" className={user.trialDaysLeft <= 3 ? "font-extrabold text-[#c42b3f]" : ""}>{user.trialDaysLeft}</span>],
    ["תוקף המנוי", row.subscription_status === "active" ? formatDateTime(row.current_period_end) : "-"],
    ["כרטיסים", `${user.cardCount} (${row.published_count || 0} מפורסמים)`],
    ["צפיות / לחיצות / פניות", `${user.views} / ${user.clicks} / ${user.leads}`],
  ];

  const firstName = user.name === "ללא שם" ? "" : user.name.split(/\s+/)[0];
  const greeting = firstName ? `היי ${firstName}, כאן NAIMLY 👋` : "היי, כאן NAIMLY 👋";

  return (
    <div className="mx-auto max-w-[1100px]">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm font-bold text-[#6d4aff] hover:underline">
        <ArrowRight size={16} aria-hidden="true" />
        חזרה לבקרת משתמשים
      </Link>

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">{user.name}</h1>
          {user.businessName && <p className="mt-1 text-[#4a5871]">{user.businessName}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StageBadge stage={user.stage} />
            <PlanStateBadge state={user.planState} />
            {user.isTest && <span className="rounded-full bg-[#fff4e6] px-2.5 py-1 text-xs font-bold text-[#9a5800]">חשבון בדיקה: לא נספר בסיכומים</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <TestAccountToggle userId={user.id} isTest={user.isTest} />
          {user.phone ? (
            <a href={whatsappLink(user.phone, greeting)} target="_blank" rel="noopener noreferrer" className="button-primary min-h-11 gap-2 px-4 text-sm">
              <MessageCircle size={16} aria-hidden="true" />
              פתח וואטסאפ
            </a>
          ) : (
            <span className="button-secondary min-h-11 cursor-not-allowed gap-2 px-4 text-sm opacity-50" aria-disabled="true" title="לא נמצא מספר טלפון">
              <MessageCircle size={16} aria-hidden="true" />
              אין טלפון
            </span>
          )}
          {user.email && (
            <a href={`mailto:${user.email}`} className="button-secondary min-h-11 gap-2 px-4 text-sm">
              <Mail size={16} aria-hidden="true" />
              מייל
            </a>
          )}
          {user.cardSlug && user.published && (
            <a href={`/${user.cardSlug}`} target="_blank" rel="noopener noreferrer" className="button-secondary min-h-11 gap-2 px-4 text-sm">
              <ExternalLink size={16} aria-hidden="true" />
              לכרטיס
            </a>
          )}
        </div>
      </header>

      <section className="card-surface mt-6 p-5" aria-label="פרטי המשתמש">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-bold text-[#7d8899]">{label}</dt>
              <dd className="mt-0.5 break-words text-sm font-semibold text-[#18243a]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card-surface mt-5 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-extrabold">ציר זמן</h2>
          <span className="text-xs text-[#7d8899]">{events.length} אירועים, מהחדש לישן</span>
        </div>

        {events.length === 0 && <p className="mt-4 text-sm text-[#7d8899]">עדיין אין אירועים למשתמש הזה.</p>}

        <div className="mt-4 grid gap-6">
          {[...days.entries()].map(([day, items]) => (
            <div key={day}>
              <h3 className="sticky top-0 bg-white py-1 text-xs font-extrabold text-[#5f6d83]">{day}</h3>
              <ol className="mt-2 grid gap-1 border-r-2 border-[#e7eaf1] pr-4">
                {items.map((event) => {
                  const detailText = eventDetail(event.event_type, event.metadata);
                  const restored = event.metadata?.source === "backfill";
                  const quiet = quietEvents.has(event.event_type);
                  return (
                    <li key={event.id} className="relative flex flex-wrap items-baseline gap-x-2 py-1 text-sm">
                      <span className={`absolute -right-[21px] top-2.5 h-2.5 w-2.5 rounded-full ${quiet ? "bg-[#c5ccd8]" : "bg-[#6d4aff]"}`} aria-hidden="true" />
                      <time dateTime={event.created_at} className="w-12 shrink-0 text-xs tabular-nums text-[#7d8899]">{timeFormat.format(new Date(event.created_at))}</time>
                      <span className={quiet ? "text-[#5f6d83]" : "font-bold text-[#18243a]"}>{eventLabel(event.event_type)}</span>
                      {detailText && <span className="text-xs text-[#5f6d83]">{detailText}</span>}
                      {restored && <span className="rounded bg-[#f2f4f8] px-1.5 text-[10px] font-bold text-[#7d8899]" title="שוחזר מנתונים קיימים. השעה מדויקת.">משוחזר</span>}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

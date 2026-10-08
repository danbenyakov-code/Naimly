import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarClock, CreditCard, Hourglass, Percent, Rocket, UserPlus, Users } from "lucide-react";
import { UsersControl } from "@/components/admin/users-control";
import { brand } from "@/lib/config";
import { getViewer } from "@/lib/data";
import { buildControlView } from "@/lib/user-control";
import { getUsersOverview } from "@/lib/user-control-data";

export const metadata: Metadata = { title: "בקרת משתמשים", robots: { index: false, follow: false } };

export default async function AdminUsersPage() {
  const viewer = await getViewer();
  // ההגנה כאן כפולה ל-layout בכוונה: הנתונים נקראים עם מפתח השירות.
  if (!viewer || viewer.role !== "admin") redirect("/dashboard");

  const rows = await getUsersOverview(viewer);
  const { users, summary } = buildControlView(rows);

  const stats = [
    { label: "סה״כ נרשמים", value: summary.total, hint: "ללא חשבונות מנהל", icon: Users, color: "bg-[#efecff] text-[#6d4aff]" },
    { label: "נרשמו השבוע", value: summary.signedUpThisWeek, hint: "7 הימים האחרונים", icon: UserPlus, color: "bg-[#e8f4ff] text-[#1f5f9e]" },
    { label: "בניסיון פעיל", value: summary.activeTrials, hint: "ניסיון שעדיין רץ", icon: Hourglass, color: "bg-[#e9fbf7] text-[#08735f]" },
    { label: "ניסיון מסתיים ב־3 ימים", value: summary.trialsEndingSoon, hint: "הזמן לפנות אליהם", icon: CalendarClock, color: "bg-[#fff0f2] text-[#b7293a]" },
    { label: "משלמים", value: summary.paying, hint: "מנוי בתשלום בתוקף", icon: CreditCard, color: "bg-[#fff4e6] text-[#aa6100]" },
    { label: "מנרשם לכרטיס מפורסם", value: `${summary.signupToPublishedPercent}%`, hint: `${summary.published} מתוך ${summary.total}`, icon: Rocket, color: "bg-[#efecff] text-[#6d4aff]" },
    { label: "מניסיון לתשלום", value: `${summary.trialToPaidPercent}%`, hint: `${summary.trialsConverted} מתוך ${summary.trialsFinished} ניסיונות שהסתיימו`, icon: Percent, color: "bg-[#e9fbf7] text-[#08735f]" },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <div>
        <p className="text-sm font-bold text-[#6d4aff]">Admin</p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">בקרת משתמשים</h1>
        <p className="mt-1 text-sm text-[#718096]">איפה כל לקוח נמצא במסע: מהרשמה, דרך כרטיס מפורסם, ועד תשלום.</p>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-7" aria-label="סיכום">
        {stats.map(({ label, value, hint, icon: Icon, color }) => (
          <article key={label} className="card-surface p-4">
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${color}`}><Icon size={18} aria-hidden="true" /></span>
            <strong className="mt-3 block text-2xl tracking-tight">{value}</strong>
            <span className="block text-sm font-bold text-[#334155]">{label}</span>
            <span className="block text-xs text-[#7d8899]">{hint}</span>
          </article>
        ))}
      </section>

      <UsersControl users={users} siteUrl={brand.siteUrl} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, BarChart3, CreditCard, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users, X } from "lucide-react";
import { useState } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/logo";
import type { Viewer } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { planName, resolveAccess } from "@/lib/plan-access";
import { TrialTimer } from "@/components/trial-timer";
import { UpgradeProvider } from "@/components/upgrade-dialog";
import { AppChrome } from "@/components/app-chrome";

const navItems = [
  { href: "/dashboard", label: "סקירה", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/card", label: "הכרטיס שלי", icon: CreditCard },
  { href: "/dashboard/analytics", label: "נתונים", icon: BarChart3 },
  { href: "/dashboard/leads", label: "פניות", icon: Users },
  { href: "/dashboard/settings", label: "הגדרות", icon: Settings },
];

export function DashboardShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = viewer.role === "admin"
    ? [...navItems, { href: "/admin", label: "ניהול המערכת", icon: ShieldCheck }, { href: "/admin/approvals", label: "אישורים ולקוחות", icon: BadgeCheck }]
    : navItems;
  const access = resolveAccess(viewer);
  const trial = access.trial;

  const navigation = (
    <nav className="grid gap-1.5" aria-label="ניווט אזור אישי">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors", active ? "bg-[#eeeaff] text-[#4b3bad]" : "text-[#66748a] hover:bg-[#f3f5f9] hover:text-[#18243a]")}>
            <Icon size={19} strokeWidth={active ? 2.4 : 2} />{label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <UpgradeProvider currentPlan={access.plan}>
    <AppChrome variant="dashboard" />
    <div className="min-h-screen bg-[#f3f5f9] lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="fixed inset-y-0 right-0 z-50 hidden w-[250px] border-l border-[#e1e6ee] bg-white px-4 py-5 lg:flex lg:flex-col">
        <div className="px-2"><Logo href="/dashboard" /></div>
        <div className="mt-8 flex-1">{navigation}</div>
        <div className="rounded-2xl bg-[#0b1020] p-4 text-white">
          <p className="text-xs font-bold text-[#74e5d5]">מסלול {planName(access.plan)}</p>
          <p className="mt-1 text-sm text-white/75">
            {trial.expired ? "ההתנסות הסתיימה" : trial.pending ? "ההתנסות טרם התחילה" : trial.active ? "תקופת ההתנסות פעילה" : viewer.subscriptionStatus === "active" ? "המנוי פעיל" : "המנוי אינו פעיל"}
          </p>
          {trial.pending
            ? <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs leading-5 text-white/75">הספירה תתחיל בפרסום הראשון של הכרטיס.</p>
            : (trial.active || trial.expired) && <div className="mt-3"><TrialTimer endsAt={trial.endsAt} variant="compact" /></div>}
          <Link href="/pricing" className="mt-3 inline-flex text-xs font-bold text-white underline underline-offset-4">
            {trial.active || trial.expired ? "בחירת מסלול" : "ניהול המסלול"}
          </Link>
        </div>
        <form action={logoutAction} className="mt-3"><button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#78859a] hover:bg-[#fff1f3] hover:text-[#b7293a]"><LogOut size={18} />יציאה</button></form>
      </aside>

      <div className="lg:col-start-2">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#e1e6ee] bg-white/92 px-4 backdrop-blur-lg sm:px-7">
          <div className="flex items-center gap-3">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-[#dfe5ef] lg:hidden" onClick={() => setOpen(true)} aria-label="פתיחת תפריט"><Menu size={20} /></button>
            <div><p className="text-sm font-extrabold">שלום, {viewer.fullName.split(" ")[0]}</p><p className="hidden text-xs text-[#7b8799] sm:block">הכרטיס שלך מוכן לעבוד</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/card" className="grid h-10 w-10 place-items-center rounded-xl text-[#647188] hover:bg-[#f2f4f8]" aria-label="עריכת הכרטיס"><CreditCard size={19} /></Link>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eae7ff] text-sm font-extrabold text-[#4d3db5]" aria-label={`חשבון ${viewer.fullName}`}>{initials(viewer.fullName)}</div>
          </div>
        </header>
        <main className="p-4 pb-24 sm:p-7 lg:pb-8">{children}</main>
      </div>

      {open && <div className="fixed inset-0 z-[60] bg-[#0b1020]/45 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={cn("fixed inset-y-0 right-0 z-[70] flex w-[290px] max-w-[88vw] flex-col bg-white p-5 shadow-2xl transition-transform lg:hidden", open ? "translate-x-0" : "translate-x-full")} aria-hidden={!open}>
        <div className="flex items-center justify-between"><Logo href="/dashboard" /><button type="button" className="grid h-10 w-10 place-items-center rounded-xl bg-[#f2f4f8]" onClick={() => setOpen(false)} aria-label="סגירת תפריט"><X size={20} /></button></div>
        <div className="mt-8 flex-1">{navigation}</div>
        <form action={logoutAction}><button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#b7293a]"><LogOut size={18} />יציאה</button></form>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[#dfe5ef] bg-white px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(11,24,48,.08)] lg:hidden" aria-label="ניווט מהיר">
        {navItems.slice(0, 4).map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} className={cn("grid min-h-14 place-items-center gap-0.5 rounded-xl text-[11px] font-bold", active ? "text-[#4b3bad]" : "text-[#7b8799]")}><Icon size={20} /><span>{label}</span></Link>;
        })}
      </nav>
    </div>
    </UpgradeProvider>
  );
}

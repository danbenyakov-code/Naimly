import Link from "next/link";
import { CheckCircle2, CreditCard, Database, KeyRound, LifeBuoy, Mail, Server, UserRound } from "lucide-react";
import { brand, plans } from "@/lib/config";
import { getViewer } from "@/lib/data";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { formatCurrency } from "@/lib/utils";
import { TRIAL_DAYS, resolveAccess } from "@/lib/plan-access";
import { TrialTimer } from "@/components/trial-timer";
import { updateProfileAction } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return null;
  const params = await searchParams;
  const access = resolveAccess(viewer);
  const plan = plans.find((item) => item.id === access.plan) || plans[0];
  const paymentConfigured = Boolean(process.env.PAYMENT_API_URL && process.env.PAYMENT_API_SECRET);
  const trial = access.trial;

  return (
    <div className="mx-auto max-w-[1060px]">
      <div><p className="text-sm font-bold text-[#6d4aff]">חשבון והגדרות</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">הגדרות</h1><p className="mt-1 text-sm text-[#718096]">פרטי חשבון, מסלול וחיבורי המערכת.</p></div>
      {params.message && <p role="status" className="mt-5 rounded-xl border border-[#b7e6d8] bg-[#effcf8] p-3 text-sm text-[#08735f]">{params.message}</p>}
      {params.error && <p role="alert" className="mt-5 rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm text-[#a32031]">{params.error}</p>}
      <div className="mt-6 grid gap-5">
        <section className="card-surface p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#efecff] text-[#6d4aff]"><UserRound size={21} /></span><div><h2 className="font-extrabold">פרטי חשבון</h2><p className="text-xs text-[#7d8899]">הפרטים המשמשים להתחברות ולניהול.</p></div></div><form action={updateProfileAction} className="mt-6 grid gap-4 sm:grid-cols-2"><label className="field-label"><span>שם מלא<span className="required-field">חובה</span></span><input className="field-input" name="fullName" defaultValue={viewer.fullName} required minLength={2} maxLength={80} /></label><label className="field-label">אימייל<input className="field-input bg-[#f5f6f8]" value={viewer.email} readOnly dir="ltr" /></label><div className="sm:col-span-2"><button className="button-primary" type="submit">שמירת פרטים</button></div></form></section>
        <section className="card-surface p-5 sm:p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e9fbf7] text-[#08735f]"><CreditCard size={21} /></span><div><h2 className="font-extrabold">המסלול שלך: {plan.name}</h2><p className="text-sm text-[#6f7c90]">{plan.price ? `${formatCurrency(plan.price)} לחודש` : "תקופת ניסיון"} · {viewer.subscriptionStatus === "active" ? "פעיל" : trial.expired ? `ההתנסות בת ${TRIAL_DAYS} הימים הסתיימה` : trial.pending ? `התנסות בת ${TRIAL_DAYS} ימים — תתחיל בפרסום הראשון` : trial.active ? `בתקופת התנסות — נותרו ${trial.daysLeft} ימים` : viewer.subscriptionStatus}</p></div></div><Link href="/pricing" className="button-secondary">{trial.active || trial.expired ? "בחירת מסלול" : "שינוי מסלול"}</Link></div>{!trial.pending && (trial.active || trial.expired) && <div className="mt-5"><TrialTimer endsAt={trial.endsAt} /></div>}<div className="mt-5 grid gap-2 sm:grid-cols-2">{plan.features.slice(0, 6).map((feature) => <span key={feature} className="flex items-center gap-2 text-sm text-[#5f6d83]"><CheckCircle2 size={16} className="text-[#0a9b81]" />{feature}</span>)}</div></section>
        <section className="card-surface p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff4e6] text-[#aa6100]"><Server size={21} /></span><div><h2 className="font-extrabold">סטטוס חיבורי Production</h2><p className="text-xs text-[#7d8899]">מוצג רק סטטוס ההגדרה — לעולם לא ערכי המפתחות.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Connection icon={Database} label="מסד נתונים והתחברות" active={isSupabaseConfigured} /><Connection icon={KeyRound} label="פעולות שרת מאובטחות" active={isSupabaseAdminConfigured} /><Connection icon={CreditCard} label="סליקה" active={paymentConfigured} /></div>{viewer.demo && <p className="mt-4 rounded-xl bg-[#f6f7fa] p-3 text-xs leading-5 text-[#6e7a8d]">המערכת פועלת כרגע במצב הדגמה. לאחר הוספת משתני הסביבה ב‑Vercel, החשבונות, הכרטיסים והלידים יישמרו ב‑Supabase.</p>}</section>
        <section className="grid gap-4 sm:grid-cols-2"><a href={`mailto:${brand.supportEmail}`} className="card-surface flex items-center gap-4 p-5 transition-transform hover:-translate-y-0.5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#efecff] text-[#6d4aff]"><LifeBuoy size={21} /></span><span><strong className="block">צריכים עזרה?</strong><span className="text-sm text-[#718096]">יצירת קשר עם התמיכה</span></span></a><Link href="/forgot-password" className="card-surface flex items-center gap-4 p-5 transition-transform hover:-translate-y-0.5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f0f3f7] text-[#526078]"><Mail size={21} /></span><span><strong className="block">אבטחה וסיסמה</strong><span className="text-sm text-[#718096]">שליחת קישור לאיפוס</span></span></Link></section>
      </div>
    </div>
  );
}

function Connection({ icon: Icon, label, active }: { icon: typeof Database; label: string; active: boolean }) {
  return <div className="rounded-2xl border border-[#e0e5ed] p-4"><Icon size={19} className={active ? "text-[#0a9b81]" : "text-[#9aa4b4]"} /><strong className="mt-3 block text-sm">{label}</strong><span className={`mt-1 inline-flex items-center gap-1.5 text-xs font-bold ${active ? "text-[#08735f]" : "text-[#8a95a7]"}`}><span className={`h-2 w-2 rounded-full ${active ? "bg-[#16bba4]" : "bg-[#b6becb]"}`} />{active ? "מחובר" : "ממתין להגדרה"}</span></div>;
}

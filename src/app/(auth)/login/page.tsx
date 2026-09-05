import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loginAction, magicLinkAction } from "../actions";

export const metadata: Metadata = { title: "כניסה למערכת", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return (
    <AuthShell title="טוב לראות אותך שוב" description="נכנסים וממשיכים לנהל את הכרטיס והפניות." footer={<>עדיין אין לך חשבון? <Link href="/signup" className="font-bold text-[#6d4aff]">מתחילים בחינם</Link></>}>
      {!isSupabaseConfigured && <div className="mb-5 rounded-xl border border-[#f1d69a] bg-[#fff8e8] p-3 text-sm text-[#805100]">מצב הדגמה פעיל: כל פרטי כניסה יעבירו אותך למערכת לדוגמה.</div>}
      {params.error && <div role="alert" className="mb-5 rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm text-[#a32031]">{params.error}</div>}
      {params.message && <div role="status" className="mb-5 rounded-xl border border-[#b7e6d8] bg-[#effcf8] p-3 text-sm text-[#08735f]">{params.message}</div>}
      <form action={loginAction} className="grid gap-4">
        <label className="field-label"><span>אימייל<span className="required-field">חובה</span></span><input className="field-input" type="email" name="email" autoComplete="email" placeholder="name@business.co.il" required /></label>
        <label className="field-label"><span>סיסמה<span className="required-field">חובה</span></span><input className="field-input" type="password" name="password" autoComplete="current-password" placeholder="לפחות 8 תווים" minLength={8} required /></label>
        <div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-semibold text-[#6d4aff]">שכחתי סיסמה</Link></div>
        <button className="button-primary mt-1 w-full" type="submit"><KeyRound size={17} />כניסה למערכת</button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-[#8a95a7]"><span className="h-px flex-1 bg-[#e2e6ee]" />או כניסה ללא סיסמה<span className="h-px flex-1 bg-[#e2e6ee]" /></div>
      <form action={magicLinkAction} className="grid gap-3 rounded-2xl bg-[#f6f7fb] p-4">
        <label className="field-label"><span>אימייל לקבלת קישור<span className="required-field">חובה</span></span><input className="field-input" type="email" name="email" autoComplete="email" placeholder="name@business.co.il" required /></label>
        <button className="button-secondary w-full" type="submit"><Mail size={17} />שליחת קישור חד־פעמי</button>
      </form>
    </AuthShell>
  );
}

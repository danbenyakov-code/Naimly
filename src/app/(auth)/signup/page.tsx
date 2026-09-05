import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { signupAction } from "../actions";

export const metadata: Metadata = { title: "פתיחת חשבון", robots: { index: false, follow: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; plan?: string }> }) {
  const params = await searchParams;
  const selectedPlan = ["basic", "pro", "premium"].includes(params.plan || "") ? params.plan : "";
  return (
    <AuthShell title={selectedPlan ? "עוד דקה והכרטיס שלך מתחיל" : "בואו נבנה את הכרטיס שלך"} description={selectedPlan ? "פותחים חשבון מאובטח וממשיכים לתשלום." : "14 ימי ניסיון. אין צורך בכרטיס אשראי."} footer={<>כבר יש לך חשבון? <Link href="/login" className="font-bold text-[#6d4aff]">כניסה</Link></>}>
      {!isSupabaseConfigured && <div className="mb-5 rounded-xl border border-[#d5ccff] bg-[#f5f2ff] p-3 text-sm text-[#4b3bad]">מצב הדגמה פעיל: הטופס יפתח את סביבת הניהול לדוגמה.</div>}
      {params.error && <div role="alert" className="mb-5 rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm text-[#a32031]">{params.error}</div>}
      <form action={signupAction} className="grid gap-4">
        <input type="hidden" name="plan" value={selectedPlan || ""} />
        <label className="field-label"><span>שם מלא<span className="required-field">חובה</span></span><input className="field-input" name="fullName" autoComplete="name" placeholder="ישראל ישראלי" minLength={2} required /></label>
        <label className="field-label"><span>אימייל עסקי<span className="required-field">חובה</span></span><input className="field-input" type="email" name="email" autoComplete="email" placeholder="name@business.co.il" required /></label>
        <label className="field-label"><span>סיסמה<span className="required-field">חובה</span></span><input className="field-input" type="password" name="password" autoComplete="new-password" placeholder="לפחות 8 תווים" minLength={8} required /></label>
        <label className="flex items-start gap-2 text-xs leading-5 text-[#607087]"><input type="checkbox" className="mt-1" required /><span>קראתי ואני מאשר/ת את <Link href="/legal/terms" className="font-semibold text-[#6d4aff]">תנאי השימוש</Link> ואת <Link href="/legal/privacy" className="font-semibold text-[#6d4aff]">מדיניות הפרטיות</Link>.</span></label>
        <button className="button-primary mt-1 w-full" type="submit">{selectedPlan ? "פתיחת חשבון והמשך לתשלום" : "פתיחת חשבון והתחלה"} <ArrowLeft size={17} /></button>
      </form>
      <p className="mt-5 text-center text-xs leading-5 text-[#7c8799]">הסיסמה אינה נשלחת במייל. נשלח קישור אימות מאובטח לכתובת שהזנת.</p>
    </AuthShell>
  );
}

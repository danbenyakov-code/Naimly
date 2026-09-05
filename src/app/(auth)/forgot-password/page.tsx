import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { forgotPasswordAction } from "../actions";

export const metadata: Metadata = { title: "איפוס סיסמה", robots: { index: false, follow: false } };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return (
    <AuthShell title="איפוס סיסמה" description="נשלח אליך קישור מאובטח ליצירת סיסמה חדשה." footer={<Link href="/login" className="font-bold text-[#6d4aff]">חזרה לכניסה</Link>}>
      {params.error && <div role="alert" className="mb-5 rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm text-[#a32031]">{params.error}</div>}
      {params.message && <div role="status" className="mb-5 rounded-xl border border-[#b7e6d8] bg-[#effcf8] p-3 text-sm text-[#08735f]">{params.message}</div>}
      <form action={forgotPasswordAction} className="grid gap-4">
        <label className="field-label"><span>אימייל<span className="required-field">חובה</span></span><input className="field-input" type="email" name="email" autoComplete="email" placeholder="name@business.co.il" required /></label>
        <button className="button-primary w-full" type="submit"><Mail size={17} />שליחת קישור לאיפוס</button>
      </form>
    </AuthShell>
  );
}

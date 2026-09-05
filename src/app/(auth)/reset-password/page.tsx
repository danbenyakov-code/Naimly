import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { updatePasswordAction } from "../actions";

export const metadata: Metadata = { title: "סיסמה חדשה", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <AuthShell title="בחירת סיסמה חדשה" description="הסיסמה צריכה להכיל לפחות 8 תווים." footer={<Link href="/login" className="font-bold text-[#6d4aff]">חזרה לכניסה</Link>}>
      {params.error && <div role="alert" className="mb-5 rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm text-[#a32031]">{params.error}</div>}
      <form action={updatePasswordAction} className="grid gap-4">
        <label className="field-label"><span>סיסמה חדשה<span className="required-field">חובה</span></span><input className="field-input" type="password" name="password" autoComplete="new-password" minLength={8} required /></label>
        <button className="button-primary w-full" type="submit"><KeyRound size={17} />עדכון הסיסמה</button>
      </form>
    </AuthShell>
  );
}

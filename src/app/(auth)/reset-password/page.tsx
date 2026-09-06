import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";

export const metadata: Metadata = { title: "סיסמה חדשה", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <AuthShell footer={<Link href="/login" className="font-bold text-[#6d4aff]">חזרה לכניסה</Link>}>
      <div>
        <h1 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">בחירת סיסמה חדשה</h1>
        <p className="mt-1.5 text-[#607087]">
          לפחות {PASSWORD_MIN_LENGTH} תווים, עם אות גדולה, אות קטנה, ספרה ותו מיוחד.
        </p>
      </div>

      {params.error && (
        <div role="alert" className="mt-5 rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm text-[#a32031]">{params.error}</div>
      )}

      <div className="mt-6">
        <ResetPasswordForm />
      </div>
    </AuthShell>
  );
}

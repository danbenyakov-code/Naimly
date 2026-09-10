import type { Metadata } from "next";
import Link from "next/link";
import { safeInternalPath } from "@/lib/safe-url";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "כניסה למערכת", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ mode?: string; plan?: string; next?: string; error?: string; message?: string }> }) {
  const params = await searchParams;
  const plan = ["basic", "pro", "premium"].includes(params.plan || "") ? params.plan! : "";
  const mode = params.mode === "signup" ? "signup" : params.mode === "forgot" ? "forgot" : "login";
  /*
   * הפעולה בשרת ממילא מריצה safeInternalPath, ולכן next חיצוני אינו
   * מפנה לשום מקום. עדיין מסננים כאן: אין סיבה שכתובת בשליטת תוקף
   * תגיע ל-DOM, ובלי זה סורק אבטחה מדווח על השתקפות בכל ריצה.
   */
  const rawNext = params.next || "";
  const safeNext = rawNext && safeInternalPath(rawNext, "") === rawNext ? rawNext : "";


  return (
    <AuthShell
      footer={
        <>
          צריכים עזרה? <Link href="/contact" className="font-bold text-[#6d4aff]">דברו איתנו</Link>
        </>
      }
    >
      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-xl border border-[#d5ccff] bg-[#f5f2ff] p-3 text-sm leading-6 text-[#4b3bad]">
          <strong>מצב הדגמה פעיל.</strong> כל פרטי כניסה יעבירו אותך למערכת לדוגמה — אין צורך בסיסמה אמיתית.
        </div>
      )}
      {params.error && (
        <div role="alert" className="mb-5 rounded-xl border border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm text-[#a32031]">{params.error}</div>
      )}
      {params.message && (
        <div role="status" className="mb-5 rounded-xl border border-[#b7e6d8] bg-[#effcf8] p-3 text-sm text-[#08735f]">{params.message}</div>
      )}

      <AuthForm initialMode={mode} plan={plan} next={safeNext} />
    </AuthShell>
  );
}

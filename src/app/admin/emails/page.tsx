import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { SendTestEmail } from "@/components/admin/send-test-email";
import { getViewer } from "@/lib/data";
import { isResendConfigured, isSmtpConfigured } from "@/lib/email";
import { runLifecycleEmails, type LifecycleReport } from "@/lib/lifecycle-runner";
import { previewIds, previewTitles, renderPreview } from "@/emails/previews";

export const metadata: Metadata = { title: "מיילים", robots: { index: false, follow: false } };

const typeLabels: Record<string, string> = {
  trial_ending_3d: "3 ימים לפני סוף הניסיון",
  trial_ending_1d: "יום לפני סוף הניסיון",
  trial_ended: "הניסיון הסתיים",
  weekly_report: "דוח שבועי",
  weekly_tips: "דוח שבועי: טיפים",
};

const statusLabels: Record<string, string> = { dry_run: "יישלח", skipped: "לא יישלח (ביטל דיוור)", sent: "נשלח", failed: "נכשל" };

function StatusLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#0a9b81]" aria-hidden="true" /> : <CircleAlert size={18} className="mt-0.5 shrink-0 text-[#aa6100]" aria-hidden="true" />}
      <span>{children}</span>
    </li>
  );
}

export default async function AdminEmailsPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") redirect("/dashboard");

  const enabled = process.env.EMAIL_AUTOMATIONS_ENABLED !== "false";
  let plan: LifecycleReport | null = null;
  let planError = "";
  if (!viewer.demo) {
    try {
      plan = await runLifecycleEmails({ dryRun: true, forceWeekly: true });
    } catch (error) {
      planError = error instanceof Error ? error.message : String(error);
    }
  }
  const previews = await Promise.all(previewIds.map(async (id) => ({ id, title: previewTitles[id], ...(await renderPreview(id)) })));

  return (
    <div className="mx-auto max-w-[1260px]">
      <p className="text-sm font-bold text-[#6d4aff]">Admin</p>
      <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">מיילים</h1>
      <p className="mt-1 text-sm text-[#718096]">מיילי סיום ניסיון, דוח שבועי והתראות. הטקסטים נערכים בקובץ src/emails/copy.ts.</p>

      <section className="card-surface mt-6 p-5">
        <h2 className="font-extrabold">מצב השליחה</h2>
        <ul className="mt-3 grid gap-2">
          <StatusLine ok={isResendConfigured}>
            {isResendConfigured ? "השליחה עוברת דרך Resend, מהדומיין של NAIMLY." : isSmtpConfigured ? "השליחה עוברת כרגע דרך Gmail (SMTP). מומלץ לעבור ל־Resend: מגבלת נפח, ומיילים שיווקיים מ־Gmail נוטים להגיע לספאם." : "אין ספק מיילים מוגדר. שום מייל לא יישלח."}
          </StatusLine>
          <StatusLine ok={enabled}>
            {enabled ? "שליחה אוטומטית פעילה: כל יום ב־09:00 (ודוח שבועי בימי ראשון). לעצירת חירום: EMAIL_AUTOMATIONS_ENABLED=false ב־Vercel." : "שליחה אוטומטית כבויה (EMAIL_AUTOMATIONS_ENABLED=false ב־Vercel). הקרון מחשב מי היה מקבל מה, אבל לא שולח."}
          </StatusLine>
          <StatusLine ok={Boolean(process.env.CRON_SECRET)}>
            {process.env.CRON_SECRET ? "CRON_SECRET מוגדר." : "CRON_SECRET חסר: המשימות המתוזמנות חסומות."}
          </StatusLine>
        </ul>
      </section>

      <section className="card-surface mt-5 overflow-hidden">
        <div className="border-b border-[#e2e6ee] p-5">
          <h2 className="font-extrabold">אם המערכת הייתה רצה עכשיו</h2>
          <p className="mt-0.5 text-xs text-[#7d8899]">חישוב בלבד, שום דבר לא נשלח. הדוח השבועי נכלל כאן תמיד, ובפועל יוצא רק בימי ראשון.</p>
        </div>
        {planError && <p className="p-5 text-sm text-[#a32031]">החישוב נכשל: {planError}</p>}
        {plan && plan.entries.length === 0 && <p className="p-5 text-sm text-[#7d8899]">אף לקוח לא מקבל מייל היום.</p>}
        {plan && plan.entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead className="bg-[#f8f9fc] text-xs text-[#68758a]"><tr><th className="p-3">לקוח</th><th className="p-3">מייל</th><th className="p-3">נושא</th><th className="p-3">סטטוס</th></tr></thead>
              <tbody>
                {plan.entries.map((entry) => (
                  <tr key={`${entry.userId}-${entry.type}`} className="border-t border-[#edf0f5]">
                    <td className="p-3"><Link href={`/admin/users/${entry.userId}`} className="font-bold text-[#6d4aff] hover:underline" dir="ltr">{entry.email}</Link></td>
                    <td className="p-3">{typeLabels[entry.type] || entry.type}</td>
                    <td className="p-3 text-xs text-[#4a5871]">{entry.status === "dry_run" ? entry.detail : ""}</td>
                    <td className="p-3 text-xs font-bold">{statusLabels[entry.status] || entry.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <h2 className="mt-8 text-lg font-extrabold">התבניות</h2>
      <div className="mt-3 grid gap-5 lg:grid-cols-2">
        {previews.map((preview) => (
          <article key={preview.id} className="card-surface overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-[#e2e6ee] p-4">
              <h3 className="font-extrabold">{preview.title}</h3>
              <p className="text-xs text-[#5f6d83]"><span className="font-bold">נושא: </span>{preview.subject}</p>
              <SendTestEmail id={preview.id} />
            </div>
            <iframe title={preview.title} srcDoc={preview.html} sandbox="" className="h-[640px] w-full bg-[#f4f6fa]" />
          </article>
        ))}
      </div>
    </div>
  );
}
